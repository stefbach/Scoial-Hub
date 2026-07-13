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
  /** Token utilisateur enregistré avec le connecteur Meta Ads (lecture des pubs). */
  adsToken?: string;
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
    adsToken: ads.access_token || undefined,
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
  id: string;
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  conversions: number;
  currency: string;
}
export interface AdAccountData {
  account?: { id: string; name: string; currency: string; amountSpent: number };
  campaigns: AdCampaignRow[];
}

/** Somme des actions de conversion (achats, leads, inscriptions) renvoyées par Meta. */
function sumConversions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  const CONV = /purchase|lead|complete_registration|add_to_cart|initiate_checkout|subscribe|contact|submit_application/i;
  let total = 0;
  for (const a of actions as Array<Record<string, unknown>>) {
    if (CONV.test(String(a.action_type ?? ""))) total += Number(a.value ?? 0);
  }
  return total;
}

/** Presets de période Meta acceptés (sécurise l'entrée). */
const VALID_DATE_PRESETS = new Set([
  "today", "yesterday", "this_month", "last_month", "this_quarter", "last_quarter",
  "this_year", "last_year", "last_7d", "last_14d", "last_30d", "last_90d", "maximum",
]);

/**
 * Lecture réelle : compte + campagnes (liste + métriques) via Marketing API.
 * `datePreset` contrôle la fenêtre des métriques (défaut "maximum" = durée de
 * vie du compte, pour ne jamais afficher 0 alors qu'il existe de la data).
 */
export async function fetchAdAccountData(
  userToken: string,
  adAccountId: string,
  datePreset = "maximum"
): Promise<AdAccountData> {
  const preset = VALID_DATE_PRESETS.has(datePreset) ? datePreset : "maximum";
  const out: AdAccountData = { campaigns: [] };
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  // Appels Graph indépendants en parallèle (compte, liste campagnes, métriques).
  const [acc, list, ins] = await Promise.all([
    gget(`${act}?fields=name,currency,amount_spent`, userToken),
    gget(`${act}/campaigns?fields=id,name,objective,effective_status&limit=40`, userToken),
    gget(`${act}/insights?level=campaign&fields=campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions&date_preset=${preset}&limit=200`, userToken),
  ]);

  const currency = String(acc?.currency ?? "EUR");
  if (acc) {
    out.account = { id: act, name: String(acc.name ?? ""), currency, amountSpent: Number(acc.amount_spent ?? 0) };
  }
  const camps = (list?.data as Array<Record<string, unknown>>) ?? [];
  type Metrics = { spend: number; impressions: number; reach: number; clicks: number; ctr: number; cpc: number; cpm: number; frequency: number; conversions: number };
  const byId = new Map<string, Metrics>();
  for (const r of (ins?.data as Array<Record<string, unknown>>) ?? []) {
    byId.set(String(r.campaign_id ?? ""), {
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      reach: Number(r.reach ?? 0),
      clicks: Number(r.clicks ?? 0),
      ctr: Number(r.ctr ?? 0),
      cpc: Number(r.cpc ?? 0),
      cpm: Number(r.cpm ?? 0),
      frequency: Number(r.frequency ?? 0),
      conversions: sumConversions(r.actions),
    });
  }

  out.campaigns = camps.map((c) => {
    const id = String(c.id ?? "");
    const m = byId.get(id) ?? { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, frequency: 0, conversions: 0 };
    return {
      id,
      name: String(c.name ?? ""),
      status: String(c.effective_status ?? ""),
      objective: String(c.objective ?? ""),
      spend: m.spend,
      impressions: m.impressions,
      reach: m.reach,
      clicks: m.clicks,
      // CTR/CPC : valeurs Meta si présentes, sinon recalculées.
      ctr: m.ctr || (m.impressions ? +(m.clicks / m.impressions * 100).toFixed(2) : 0),
      cpc: m.cpc || (m.clicks ? +(m.spend / m.clicks).toFixed(2) : 0),
      cpm: m.cpm,
      frequency: m.frequency,
      conversions: m.conversions,
      currency,
    };
  }).sort((a, b) => b.spend - a.spend).slice(0, 25);

  return out;
}

// ── Performance détaillée (séries quotidiennes + lignes par publicité) ────────

export interface AdDaySeries {
  spend: number[]; impressions: number[]; clicks: number[]; conversions: number[]; ctr: number[]; cpc: number[];
}
export interface AdPerfRow {
  id: string; name: string; campaignName: string; adSetName: string;
  status: string; platform: "facebook" | "instagram";
  spend: number; impressions: number; clicks: number; ctr: number; cpc: number; conversions: number; cpa: number;
  currency: string;
}
export interface AdPerformance {
  account?: { id: string; name: string; currency: string };
  totals: { spend: number; impressions: number; reach: number; clicks: number; conversions: number; ctr: number; cpc: number; currency: string; count: number };
  series: AdDaySeries;
  ads: AdPerfRow[];
}

/** Construit le paramètre de période Meta : time_range (since/until) ou date_preset. */
function dateParam(opts: { datePreset?: string; since?: string; until?: string }): string {
  if (opts.since && opts.until) {
    return `time_range=${encodeURIComponent(JSON.stringify({ since: opts.since, until: opts.until }))}`;
  }
  const p = opts.datePreset && VALID_DATE_PRESETS.has(opts.datePreset) ? opts.datePreset : "maximum";
  return `date_preset=${p}`;
}

/** Devine la plateforme à partir des noms (heuristique, sans breakdown). */
function guessPlatform(...names: string[]): "facebook" | "instagram" {
  return /insta|instagram|\big\b|reel|story/i.test(names.join(" ")) ? "instagram" : "facebook";
}

/**
 * Performance réelle pour la page Performance Ads : séries jour par jour (graphe),
 * totaux agrégés (KPI) et lignes par publicité (tableau), sur la période choisie.
 */
export async function fetchAdPerformance(
  userToken: string,
  adAccountId: string,
  opts: { datePreset?: string; since?: string; until?: string } = {}
): Promise<AdPerformance> {
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const dp = dateParam(opts);

  // Appels Graph indépendants lancés EN PARALLÈLE (latence ÷ ~5).
  const [acc, ser, totIns, adIns, adsMeta] = await Promise.all([
    gget(`${act}?fields=name,currency`, userToken),
    gget(`${act}/insights?fields=spend,impressions,clicks,actions&time_increment=1&${dp}&limit=500`, userToken),
    gget(`${act}/insights?fields=spend,impressions,reach,clicks,actions&${dp}&limit=1`, userToken),
    gget(`${act}/insights?level=ad&fields=ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks,ctr,cpc,actions&${dp}&limit=300`, userToken),
    gget(`${act}/ads?fields=id,effective_status&limit=500`, userToken),
  ]);

  const currency = String(acc?.currency ?? "EUR");
  const account = acc ? { id: act, name: String(acc.name ?? ""), currency } : undefined;

  // 1) Série quotidienne (time_increment=1) au niveau compte.
  const days = ((ser?.data as Array<Record<string, unknown>>) ?? [])
    .slice()
    .sort((a, b) => String(a.date_start ?? "").localeCompare(String(b.date_start ?? "")));
  const series: AdDaySeries = { spend: [], impressions: [], clicks: [], conversions: [], ctr: [], cpc: [] };
  for (const r of days) {
    const sp = Number(r.spend ?? 0), im = Number(r.impressions ?? 0), cl = Number(r.clicks ?? 0), cv = sumConversions(r.actions);
    series.spend.push(sp); series.impressions.push(im); series.clicks.push(cl); series.conversions.push(cv);
    series.ctr.push(im ? +(cl / im * 100).toFixed(2) : 0);
    series.cpc.push(cl ? +(sp / cl).toFixed(2) : 0);
  }

  // 2) Totaux agrégés (une ligne au niveau compte).
  const tr = ((totIns?.data as Array<Record<string, unknown>>) ?? [])[0] ?? {};
  const tSpend = Number(tr.spend ?? 0), tImpr = Number(tr.impressions ?? 0), tClicks = Number(tr.clicks ?? 0);

  // 3) Lignes par publicité + statut réel.
  const statusById = new Map<string, string>();
  for (const a of (adsMeta?.data as Array<Record<string, unknown>>) ?? []) {
    statusById.set(String(a.id ?? ""), String(a.effective_status ?? ""));
  }

  const ads: AdPerfRow[] = ((adIns?.data as Array<Record<string, unknown>>) ?? []).map((r) => {
    const id = String(r.ad_id ?? "");
    const spend = Number(r.spend ?? 0), impressions = Number(r.impressions ?? 0), clicks = Number(r.clicks ?? 0);
    const conversions = sumConversions(r.actions);
    const campaignName = String(r.campaign_name ?? ""), adSetName = String(r.adset_name ?? ""), name = String(r.ad_name ?? "");
    return {
      id, name, campaignName, adSetName,
      status: statusById.get(id) ?? "",
      platform: guessPlatform(name, adSetName, campaignName),
      spend, impressions, clicks,
      ctr: Number(r.ctr ?? 0) || (impressions ? +(clicks / impressions * 100).toFixed(2) : 0),
      cpc: Number(r.cpc ?? 0) || (clicks ? +(spend / clicks).toFixed(2) : 0),
      conversions,
      cpa: conversions ? +(spend / conversions).toFixed(2) : 0,
      currency,
    };
  }).sort((a, b) => b.spend - a.spend).slice(0, 50);

  return {
    account,
    totals: {
      spend: tSpend, impressions: tImpr, reach: Number(tr.reach ?? 0), clicks: tClicks,
      conversions: sumConversions(tr.actions),
      ctr: tImpr ? +(tClicks / tImpr * 100).toFixed(2) : 0,
      cpc: tClicks ? +(tSpend / tClicks).toFixed(2) : 0,
      currency, count: ads.length,
    },
    series,
    ads,
  };
}

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
  /** Portée & vues organiques cumulées sur 28 j (best-effort, selon permissions). */
  reach?: number;
  views?: number;
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

  // Portée & vues organiques sur 28 j (best-effort — nécessite read_insights).
  let reach = 0, views = 0;
  if (ctx.pageId) {
    const pi = await gget(`${ctx.pageId}/insights?metric=page_impressions_unique,page_impressions&period=days_28`, token);
    for (const m of (pi?.data as Array<Record<string, unknown>>) ?? []) {
      const vals = (m.values as Array<{ value?: number }>) ?? [];
      const v = Number(vals[vals.length - 1]?.value ?? 0);
      if (m.name === "page_impressions_unique") reach += v;
      else if (m.name === "page_impressions") views += v;
    }
  }
  if (ctx.igId) {
    const igi = await gget(`${ctx.igId}/insights?metric=reach&period=days_28`, token);
    for (const m of (igi?.data as Array<Record<string, unknown>>) ?? []) {
      const vals = (m.values as Array<{ value?: number }>) ?? [];
      if (m.name === "reach") reach += Number(vals[vals.length - 1]?.value ?? 0);
    }
  }
  if (reach > 0) out.reach = reach;
  if (views > 0) out.views = views;

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
