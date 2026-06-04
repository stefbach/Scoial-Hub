// Sélection de la Page Facebook (et du compte Instagram Business lié) après OAuth.
// Le token renvoyé par l'OAuth est un token UTILISATEUR : pour publier il faut
// le token de PAGE + l'ID de Page (et l'ID du compte IG Business lié). On liste
// les Pages de l'utilisateur, on choisit celle qui correspond à la société, et
// on enregistre les bons identifiants dans sh_channel_connections.

const V = process.env.META_API_VERSION ?? "v21.0";

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;      // token de PAGE (publication)
  igId?: string;            // Instagram Business Account lié
  igUsername?: string;
  picture?: string;
  fanCount?: number;
}

/** Liste les Pages gérées par l'utilisateur (avec token de page + IG lié). */
export async function fetchMetaPages(userToken: string): Promise<MetaPage[]> {
  const url =
    `https://graph.facebook.com/${V}/me/accounts` +
    `?fields=id,name,access_token,fan_count,picture{url},instagram_business_account{id,username}` +
    `&limit=100&access_token=${encodeURIComponent(userToken)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    if (!Array.isArray(json.data)) return [];
    return json.data.map((p) => {
      const ig = p.instagram_business_account as { id?: string; username?: string } | undefined;
      const pic = p.picture as { data?: { url?: string } } | undefined;
      return {
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        accessToken: String(p.access_token ?? ""),
        igId: ig?.id ? String(ig.id) : undefined,
        igUsername: ig?.username ? String(ig.username) : undefined,
        picture: pic?.data?.url ? String(pic.data.url) : undefined,
        fanCount: typeof p.fan_count === "number" ? p.fan_count : undefined,
      };
    });
  } catch {
    return [];
  }
}

// ── Contexte Meta stocké pour une société ────────────────────────────────────

export interface MetaContext {
  userToken?: string;
  pageToken?: string;
  pageId?: string;
  igId?: string;
  adAccountId?: string;
}

/** Lit les tokens/ids Meta enregistrés pour une société. */
export async function getMetaContext(companyId: string): Promise<MetaContext> {
  const { listConnections } = await import("@/lib/repositories/channel-connections");
  const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
  const rows = await listConnections(await resolveCompanyUuid(companyId));
  const fb = rows.find((r) => r.channel === "facebook")?.config ?? {};
  const ig = rows.find((r) => r.channel === "instagram")?.config ?? {};
  const ads = rows.find((r) => r.channel === "meta_ads")?.config ?? {};
  return {
    userToken: fb.user_access_token || undefined,
    pageToken: fb.page_access_token || undefined,
    pageId: fb.page_id || undefined,
    igId: ig.ig_business_account_id || undefined,
    adAccountId: ads.ad_account_id || undefined,
  };
}

// ── Comptes publicitaires (Meta Ads) ─────────────────────────────────────────

export interface AdAccount {
  id: string;          // sans préfixe act_
  name: string;
  currency: string;
  status: number;      // 1 = actif
  amountSpent: number; // unités mineures (centimes)
}

export async function fetchAdAccounts(userToken: string): Promise<AdAccount[]> {
  const url =
    `https://graph.facebook.com/${V}/me/adaccounts` +
    `?fields=account_id,name,currency,account_status,amount_spent&limit=100&access_token=${encodeURIComponent(userToken)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    if (!Array.isArray(json.data)) return [];
    return json.data.map((a) => ({
      id: String(a.account_id ?? ""),
      name: String(a.name ?? ""),
      currency: String(a.currency ?? "EUR"),
      status: Number(a.account_status ?? 0),
      amountSpent: Number(a.amount_spent ?? 0),
    }));
  } catch {
    return [];
  }
}

export function pickAdAccountForCompany(accounts: AdAccount[], companyName: string): AdAccount | null {
  if (accounts.length === 0) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cn = norm(companyName);
  const active = accounts.filter((a) => a.status === 1);
  const pool = active.length ? active : accounts;
  if (cn) {
    const exact = pool.find((a) => norm(a.name) === cn);
    if (exact) return exact;
    const partial = pool.find((a) => {
      const an = norm(a.name);
      return an && (an.includes(cn) || cn.includes(an));
    });
    if (partial) return partial;
  }
  // À défaut : le compte actif le plus utilisé.
  return [...pool].sort((a, b) => b.amountSpent - a.amountSpent)[0];
}

/** Enregistre le connecteur Meta Ads (lecture) pour une société. */
export async function storeMetaAds(companyId: string, account: AdAccount, userToken: string): Promise<void> {
  const { upsertConnection } = await import("@/lib/repositories/channel-connections");
  const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
  await upsertConnection(
    await resolveCompanyUuid(companyId),
    "meta_ads",
    {
      ad_account_id: account.id,
      access_token: userToken,
      account_name: account.name,
      currency: account.currency,
      connected_via: "oauth",
    },
    "connected"
  );
}

export interface AdCampaignRow {
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  currency: string;
}
export interface AdAccountData {
  account?: { id: string; name: string; currency: string; amountSpent: number };
  campaigns: AdCampaignRow[];
}

/** Lecture réelle : compte + campagnes (liste + dépense 90 j) via Marketing API. */
export async function fetchAdAccountData(userToken: string, adAccountId: string): Promise<AdAccountData> {
  const out: AdAccountData = { campaigns: [] };
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const currency = await (async () => {
    const acc = await gget(`${act}?fields=name,currency,amount_spent`, userToken);
    if (acc) {
      out.account = { id: act, name: String(acc.name ?? ""), currency: String(acc.currency ?? "EUR"), amountSpent: Number(acc.amount_spent ?? 0) };
      return String(acc.currency ?? "EUR");
    }
    return "EUR";
  })();

  // Liste des campagnes (même sans dépense récente).
  const list = await gget(`${act}/campaigns?fields=name,objective,effective_status&limit=40`, userToken);
  const camps = (list?.data as Array<Record<string, unknown>>) ?? [];

  // Dépense 90 j par campagne (fusionnée par nom).
  const ins = await gget(`${act}/insights?level=campaign&fields=campaign_name,spend,impressions,clicks&date_preset=last_90d&limit=100`, userToken);
  const spendByName = new Map<string, { spend: number; impressions: number; clicks: number }>();
  for (const r of (ins?.data as Array<Record<string, unknown>>) ?? []) {
    spendByName.set(String(r.campaign_name ?? ""), {
      spend: Number(r.spend ?? 0), impressions: Number(r.impressions ?? 0), clicks: Number(r.clicks ?? 0),
    });
  }

  out.campaigns = camps.map((c) => {
    const name = String(c.name ?? "");
    const m = spendByName.get(name) ?? { spend: 0, impressions: 0, clicks: 0 };
    return {
      name,
      status: String(c.effective_status ?? ""),
      objective: String(c.objective ?? ""),
      spend: m.spend, impressions: m.impressions, clicks: m.clicks,
      currency,
    };
  }).sort((a, b) => b.spend - a.spend).slice(0, 25);

  return out;
}

// ── Insights / données réelles d'une Page + compte Instagram ─────────────────

export interface MetaPost {
  id: string;
  message: string;
  url?: string;
  image?: string;
  createdAt?: string;
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface MetaInsights {
  facebook?: { id: string; name: string; fanCount: number; followers: number; picture?: string };
  instagram?: { id: string; username: string; followers: number; mediaCount: number; picture?: string };
  facebookPosts: MetaPost[];
  instagramPosts: MetaPost[];
}

async function gget(path: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const j = (await res.json()) as Record<string, unknown>;
    if (j && (j as { error?: unknown }).error) return null;
    return j;
  } catch {
    return null;
  }
}

/** Récupère les vraies stats + posts récents de la Page FB et du compte IG. */
export async function fetchMetaInsights(ctx: MetaContext): Promise<MetaInsights> {
  const out: MetaInsights = { facebookPosts: [], instagramPosts: [] };
  const token = ctx.pageToken;
  if (!token) return out;

  if (ctx.pageId) {
    const p = await gget(`${ctx.pageId}?fields=id,name,fan_count,followers_count,picture{url}`, token);
    if (p) {
      const pic = p.picture as { data?: { url?: string } } | undefined;
      out.facebook = {
        id: String(p.id ?? ctx.pageId),
        name: String(p.name ?? ""),
        fanCount: Number(p.fan_count ?? 0),
        followers: Number(p.followers_count ?? p.fan_count ?? 0),
        picture: pic?.data?.url,
      };
    }
    const posts = await gget(`${ctx.pageId}/posts?fields=message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count),comments.summary(total_count)&limit=12`, token);
    const arrP = (posts?.data as Array<Record<string, unknown>>) ?? [];
    out.facebookPosts = arrP.map((m) => {
      const reactions = m.reactions as { summary?: { total_count?: number } } | undefined;
      const comments = m.comments as { summary?: { total_count?: number } } | undefined;
      const shares = m.shares as { count?: number } | undefined;
      return {
        id: String(m.id ?? ""),
        message: String(m.message ?? ""),
        url: m.permalink_url ? String(m.permalink_url) : undefined,
        image: m.full_picture ? String(m.full_picture) : undefined,
        createdAt: m.created_time ? String(m.created_time) : undefined,
        likes: reactions?.summary?.total_count,
        comments: comments?.summary?.total_count,
        shares: shares?.count,
      };
    });
  }

  if (ctx.igId) {
    const ig = await gget(`${ctx.igId}?fields=username,followers_count,media_count,profile_picture_url`, token);
    if (ig) {
      out.instagram = {
        id: ctx.igId,
        username: String(ig.username ?? ""),
        followers: Number(ig.followers_count ?? 0),
        mediaCount: Number(ig.media_count ?? 0),
        picture: ig.profile_picture_url ? String(ig.profile_picture_url) : undefined,
      };
    }
    const media = await gget(`${ctx.igId}/media?fields=caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=12`, token);
    const arrM = (media?.data as Array<Record<string, unknown>>) ?? [];
    out.instagramPosts = arrM.map((m) => ({
      id: String(m.id ?? ""),
      message: String(m.caption ?? ""),
      url: m.permalink ? String(m.permalink) : undefined,
      image: m.media_url ? String(m.media_url) : undefined,
      createdAt: m.timestamp ? String(m.timestamp) : undefined,
      likes: typeof m.like_count === "number" ? m.like_count : undefined,
      comments: typeof m.comments_count === "number" ? m.comments_count : undefined,
    }));
  }

  return out;
}

/** Choisit la Page la plus proche du nom de la société (exact → inclus → 1ère). */
export function pickPageForCompany(pages: MetaPage[], companyName: string): MetaPage | null {
  if (pages.length === 0) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cn = norm(companyName);
  if (cn) {
    const exact = pages.find((p) => norm(p.name) === cn);
    if (exact) return exact;
    const partial = pages.find((p) => {
      const pn = norm(p.name);
      return pn && (pn.includes(cn) || cn.includes(pn));
    });
    if (partial) return partial;
  }
  return pages[0];
}

/** Récupère le nom de la société (pour le matching de Page). */
export async function getCompanyName(companyUuid: string): Promise<string> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const sb = createAdminClient();
    if (!sb) return "";
    const { data } = await sb
      .from("sh_companies")
      .select("name")
      .eq("id", companyUuid)
      .maybeSingle();
    return data?.name ? String(data.name) : "";
  } catch {
    return "";
  }
}

/**
 * Enregistre les connexions Facebook + Instagram à partir de la Page choisie.
 * Un seul OAuth connecte donc les deux réseaux (ils partagent la Page + le token).
 */
export async function storeMetaConnections(
  companyId: string,
  page: MetaPage,
  userToken?: string
): Promise<void> {
  const { upsertConnection } = await import("@/lib/repositories/channel-connections");
  const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
  const uuid = await resolveCompanyUuid(companyId);

  const pagesMeta = JSON.stringify({ id: page.id, name: page.name });

  // Facebook : id de Page + token de Page (+ token UTILISATEUR pour lister
  // toutes les Pages plus tard via le sélecteur).
  await upsertConnection(
    uuid,
    "facebook",
    {
      page_id: page.id,
      page_access_token: page.accessToken,
      account_name: page.name,
      connected_via: "oauth",
      selected_page: pagesMeta,
      ...(userToken ? { user_access_token: userToken } : {}),
    },
    "connected"
  );

  // Instagram : seulement si un compte IG Business est lié à la Page
  if (page.igId) {
    await upsertConnection(
      uuid,
      "instagram",
      {
        ig_business_account_id: page.igId,
        page_access_token: page.accessToken,
        account_name: page.igUsername ? `@${page.igUsername}` : page.name,
        connected_via: "oauth",
        selected_page: pagesMeta,
      },
      "connected"
    );
  }

  // Meta Ads : auto-configuration (lecture) en sélectionnant le compte pub
  // qui correspond le mieux à la société. Non bloquant.
  if (userToken) {
    try {
      const accounts = await fetchAdAccounts(userToken);
      // Le nom de société n'est pas dispo ici → on matche sur le nom de la Page.
      const acct = pickAdAccountForCompany(accounts, page.name);
      if (acct) await storeMetaAds(companyId, acct, userToken);
    } catch {
      /* non bloquant */
    }
  }
}
