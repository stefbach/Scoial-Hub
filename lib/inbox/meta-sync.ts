// Synchronisation des messages Meta (commentaires Facebook + Instagram, messages
// privés Messenger + IG DM, avis de la Page) vers la messagerie, et envoi des
// réponses vers la plateforme.
// Utilise le token de PAGE stocké pour la société (cf. meta-pages.getMetaContext).

import { getMetaContext } from "@/lib/connectors/meta-pages";
import { ingestMessage } from "@/lib/repositories/inbox";
import type { InboxChannel } from "@/lib/inbox/types";

const V = process.env.META_API_VERSION ?? "v21.0";

/** Edge Graph imbriqué (data + pagination). */
interface GraphEdge {
  data?: Array<Record<string, unknown>>;
  paging?: { next?: string };
}

/**
 * GET Graph. En cas d'erreur Graph, le message est collecté dans `errs`
 * (au lieu d'être avalé) pour être remonté à l'utilisateur : c'est souvent
 * une permission manquante qui explique des messages « invisibles ».
 */
async function gget(
  path: string,
  token: string,
  errs?: string[]
): Promise<Record<string, unknown> | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      `https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const j = (await res.json()) as Record<string, unknown>;
    const err = (j as { error?: { message?: string } }).error;
    if (err) {
      if (err.message) errs?.push(err.message);
      // Trace serveur (visible dans les logs Vercel) — sans le token.
      console.error("[meta-sync] Graph refuse", path.split("?")[0], "→", err.message);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

export interface SyncResult {
  imported: number;
  scanned: number;
  available: boolean;
  comments: number;
  dms: number;
  reviews: number;
  note?: string;
}

/** Suit la pagination Graph (champ paging.next) jusqu'à `maxPages`. */
async function gpaged(
  startPath: string,
  token: string,
  maxPages = 5,
  errs?: string[]
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let page = await gget(startPath, token, errs);
  let guard = 0;
  while (page && guard < maxPages) {
    const data = (page.data as Array<Record<string, unknown>>) ?? [];
    out.push(...data);
    const next = (page.paging as { next?: string })?.next;
    if (!next || data.length === 0) break;
    guard++;
    try {
      const res = await fetch(next, { cache: "no-store" });
      page = (await res.json()) as Record<string, unknown>;
      if ((page as { error?: unknown }).error) break;
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Épuise un edge IMBRIQUÉ (ex. les commentaires d'un post, les messages d'une
 * conversation) en suivant son propre paging.next. Sans cela, seule la première
 * page (25–50 éléments) de chaque fil était importée.
 */
async function drainEdge(
  edge: GraphEdge | undefined,
  maxPages = 3,
  errs?: string[]
): Promise<Array<Record<string, unknown>>> {
  const out = [...(edge?.data ?? [])];
  let next = edge?.paging?.next;
  let guard = 0;
  while (next && guard < maxPages) {
    guard++;
    try {
      const res = await fetch(next, { cache: "no-store" });
      const j = (await res.json()) as GraphEdge & { error?: { message?: string } };
      if (j.error) {
        if (j.error.message) errs?.push(j.error.message);
        break;
      }
      out.push(...(j.data ?? []));
      next = j.paging?.next;
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Normalise un horodatage Graph en ISO 8601 : Meta renvoie selon les endpoints
 * un ISO avec offset compact ("2026-07-01T10:00:00+0000"), des secondes Unix
 * (webhooks feed) ou des millisecondes (webhooks messaging).
 */
export function graphTimeToIso(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
    const d = new Date(v > 1e12 ? v : v * 1000);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Résumé lisible des erreurs Graph rencontrées (dédupliquées). */
function buildNote(errs: string[]): string | undefined {
  if (errs.length === 0) return undefined;
  const uniq = [...new Set(errs)].slice(0, 2).join(" · ");
  return `Certains contenus n'ont pas pu être lus (${uniq}). Si les permissions ont changé, reconnectez votre Page Meta depuis Comptes.`;
}

/**
 * Permissions nécessaires à la messagerie. Sans certaines d'entre elles
 * (ex. pages_read_user_content), Meta ne renvoie PAS d'erreur : il masque
 * silencieusement les contenus des visiteurs — d'où des messages « manquants »
 * inexplicables. On vérifie donc ce que le token accorde réellement.
 */
const REQUIRED_PERMS = [
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_engagement",
  "pages_messaging",
  "instagram_manage_comments",
  "instagram_manage_messages",
] as const;

async function missingPermissions(userToken: string | undefined, errs: string[]): Promise<string[]> {
  if (!userToken) return [];
  const res = await gget("me/permissions?limit=100", userToken, errs);
  const rows = (res?.data as Array<{ permission?: string; status?: string }>) ?? [];
  if (rows.length === 0) return [];
  const granted = new Set(rows.filter((r) => r.status === "granted").map((r) => String(r.permission)));
  return REQUIRED_PERMS.filter((p) => !granted.has(p));
}

/**
 * Importe TOUS les messages récupérables — comme la boîte de réception
 * Meta Business Suite : commentaires FB (posts de la Page ET des visiteurs,
 * réponses en fil incluses), commentaires IG (+ réponses), messages privés
 * Messenger + IG DM, et avis/recommandations de la Page.
 * Idempotent (externalId unique).
 */
export async function syncMetaComments(companyId: string, budgetMs = 48_000): Promise<SyncResult> {
  const ctx = await getMetaContext(companyId);
  const token = ctx.pageToken;
  if (!token) {
    return { imported: 0, scanned: 0, comments: 0, dms: 0, reviews: 0, available: false, note: "Page Meta non connectée." };
  }

  let comments = 0;
  let dms = 0;
  let reviews = 0;
  let scanned = 0;
  const errs: string[] = [];

  // Budget temps : la route serverless est tuée à 60 s (504). On s'arrête
  // PROPREMENT avant, en gardant tout ce qui est déjà importé — l'import est
  // idempotent, chaque relance reprend là où la précédente s'est arrêtée.
  const deadline = Date.now() + budgetMs;
  let partial = false;
  const timeUp = (): boolean => {
    if (Date.now() >= deadline) {
      partial = true;
      return true;
    }
    return false;
  };

  /** Insère une liste de messages EN PARALLÈLE (idempotent) ; renvoie le nb inséré. */
  async function ingestAll(inputs: Array<Parameters<typeof ingestMessage>[1]>): Promise<number> {
    const results = await Promise.all(inputs.map((i) => ingestMessage(companyId, i)));
    return results.filter(Boolean).length;
  }

  // Fenêtre RÉCENTE commune (90 jours). Graph sert les fils de commentaires du
  // plus ANCIEN au plus récent quel que soit le tri demandé : sur un post
  // boosté très commenté, les commentaires du jour sont au-delà des pages
  // parcourues — `since` est le SEUL moyen fiable de les obtenir.
  const RECENT_SINCE = Math.floor(Date.now() / 1000) - 90 * 24 * 3600;

  /** Pages étrangères repérées dans le fil (crossposts, pages sœurs). */
  const siblingPages = new Set<string>();

  // Pages connectées par d'AUTRES sociétés : jamais importées ici — verrou
  // anti-fuite entre sociétés (constaté : commentaires TIBOK dans l'inbox OCC).
  const otherCompaniesPages = new Set<string>();
  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
    const sb = createAdminClient();
    if (sb) {
      const uuid = await resolveCompanyUuid(companyId);
      const { data } = await sb
        .from("sh_channel_connections")
        .select("company_id, config")
        .eq("channel", "facebook");
      for (const r of (data ?? []) as Array<{ company_id: string; config?: { page_id?: string } }>) {
        const pid = r.config?.page_id;
        if (pid && String(r.company_id) !== uuid) otherCompaniesPages.add(String(pid));
      }
    }
  } catch {
    /* démo sans Supabase */
  }

  /** GET en essayant plusieurs tokens (page connectée, page partenaire, user). */
  async function ggetFirst(path: string, tokens: Array<string | undefined>): Promise<Record<string, unknown> | null> {
    const tried = new Set<string>();
    const local: string[] = [];
    for (const t of tokens) {
      if (!t || tried.has(t)) continue;
      tried.add(t);
      const r = await gget(path, t, local);
      if (r) return r;
    }
    if (local.length > 0) errs.push(local[local.length - 1]);
    return null;
  }

  /**
   * Lit les commentaires RÉCENTS d'un post : order=reverse_chronological
   * (documenté, honoré avec le filtre par défaut) + arrêt dès que la fenêtre
   * RECENT_SINCE est dépassée. Ne dépend NI de `since` (non documenté sur
   * l'edge /comments, peut vider la réponse en silence) NI des compteurs
   * summary (bornes non garanties) NI du format ?ids= (tout-ou-rien : un id
   * mort invalidait le comptage de 50 posts d'un coup).
   */
  async function readRecentComments(
    objectId: string,
    tokens: Array<string | undefined>
  ): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    let page = await ggetFirst(
      `${objectId}/comments?order=reverse_chronological&limit=50&fields=id,from,message,created_time`,
      tokens
    );
    let guard = 0;
    while (page && guard < 4) {
      const data = (page.data as Array<Record<string, unknown>>) ?? [];
      for (const c of data) {
        const iso = graphTimeToIso(c.created_time);
        if (iso && new Date(iso).getTime() < RECENT_SINCE * 1000) return out; // fenêtre dépassée
        out.push(c);
      }
      const next = (page.paging as { next?: string })?.next;
      if (!next || data.length === 0) break;
      guard++;
      try {
        const res = await fetch(next, { cache: "no-store" });
        page = (await res.json()) as Record<string, unknown>;
        if ((page as { error?: { message?: string } }).error) {
          const msg = (page as { error?: { message?: string } }).error?.message;
          if (msg) errs.push(msg);
          break;
        }
      } catch {
        break;
      }
    }
    return out;
  }

  // ── Facebook : publications → commentaires ──────────────────────────────────
  // edge "feed" : posts de la Page ET des VISITEURS. edge "ads_posts" : posts
  // publicitaires (y compris dark posts, absents du feed) — c'est là que
  // tombent la plupart des commentaires récents quand des pubs tournent.
  // Méthode : liste des posts → comptage batch des commentaires → lecture
  // DIRECTE de chaque post commenté avec la fenêtre `since` (les expansions de
  // champ servent les fils du plus ancien au plus récent et coupent à ~200 :
  // sur un post boosté très commenté, les commentaires du jour étaient perdus).
  async function fbPostComments(
    edge: "feed" | "ads_posts",
    pageId: string = ctx.pageId!,
    pageToken: string = token!
  ): Promise<void> {
    // include_inline_create : indispensable pour les pubs à créa FLEXIBLE/
    // dynamique (ex. campagnes de formulaires) — leurs posts sombres sont
    // créés « inline » et n'apparaissent dans ads_posts qu'avec ce paramètre.
    const inline = edge === "ads_posts" ? "&include_inline_create=true" : "";
    // ads_posts : listing PROFOND (500) — un post boosté peut être ancien
    // (créé il y a plus d'un an) tout en recevant des commentaires AUJOURD'HUI,
    // et la lecture bornée à la fenêtre récente rend chaque post bon marché.
    const posts = await gpaged(
      `${pageId}/${edge}?fields=id,permalink_url${inline}&limit=50`,
      pageToken,
      edge === "ads_posts" ? 10 : 6,
      errs
    );
    const permalinkById = new Map<string, string>();
    for (const p of posts) {
      const id = String(p.id ?? "");
      if (!id) continue;
      const permalink = p.permalink_url ? String(p.permalink_url) : "";
      permalinkById.set(id, permalink);
      // Post du fil appartenant à une AUTRE page (crosspost, page sœur,
      // page de localisation) : signalé pour diagnostic — c'est souvent là
      // que vivent les commentaires « introuvables ».
      const m = permalink.match(/facebook\.com\/(\d{6,})\//);
      if (m && m[1] !== pageId && ctx.pageId && m[1] !== ctx.pageId) siblingPages.add(m[1]);
    }
    // TOUS les posts listés sont lus (l'arrêt à la fenêtre RECENT_SINCE rend
    // chaque lecture bon marché : 1 appel pour un post sans activité récente).
    const toRead = [...permalinkById.keys()];

    async function readPost(pid: string): Promise<void> {
      const list = await readRecentComments(pid, [pageToken, token]);
      const inputs: Array<Parameters<typeof ingestMessage>[1]> = [];
      for (const c of list) {
        scanned++;
        const from = c.from as { name?: string; id?: string } | undefined;
        // On ignore les commentaires écrits par la Page elle-même.
        if (from?.id && (from.id === pageId || from.id === ctx.pageId)) continue;
        const text = String(c.message ?? "");
        // Texte vide = sticker/photo ou contenu caviardé par Meta (post d'une
        // page dont on n'est pas admin) : rien d'actionnable, on n'insère pas.
        if (!text) continue;
        inputs.push({
          channel: "facebook",
          externalId: String(c.id ?? ""),
          kind: "comment",
          text,
          authorName: from?.name ?? "Utilisateur Facebook",
          authorHandle: from?.id ? String(from.id) : undefined,
          permalink: permalinkById.get(pid) || undefined,
          receivedAt: graphTimeToIso(c.created_time),
          // Page homonyme : mémorise la propriétaire pour répondre en son nom.
          raw: pageId !== ctx.pageId
            ? { ...(c as Record<string, unknown>), _sh_owner_page: pageId }
            : (c as Record<string, unknown>),
        });
      }
      const n = await ingestAll(inputs);
      comments += n;
    }
    for (let i = 0; i < toRead.length && !timeUp(); i += 5) {
      await Promise.all(toRead.slice(i, i + 5).map((pid) => readPost(pid)));
    }
  }

  // ── Messenger : conversations privées (fils paginés) ────────────────────────
  async function messengerDms(
    pageId: string = ctx.pageId!,
    pageToken: string = token!
  ): Promise<void> {
    const convos = await gpaged(
      `${pageId}/conversations?fields=updated_time,messages.limit(25){id,message,from,created_time}&limit=50`,
      pageToken,
      3,
      errs
    );
    for (const conv of convos) {
      if (timeUp()) return;
      const msgs = await drainEdge(conv.messages as GraphEdge | undefined, 3, errs);
      const inputs: Array<Parameters<typeof ingestMessage>[1]> = [];
      for (const m of msgs) {
        const from = m.from as { name?: string; id?: string; email?: string } | undefined;
        // On ignore les messages envoyés par la Page elle-même.
        if (from?.id && (from.id === pageId || (ctx.pageId && from.id === ctx.pageId))) continue;
        const text = String(m.message ?? "");
        if (!text) continue;
        scanned++;
        inputs.push({
          channel: "facebook",
          externalId: String(m.id ?? ""),
          kind: "dm",
          text,
          authorName: from?.name ?? "Messenger",
          authorHandle: from?.id ? String(from.id) : undefined,
          receivedAt: graphTimeToIso(m.created_time),
          // Page homonyme : la réponse Send API devra partir de CETTE page.
          raw: pageId !== ctx.pageId
            ? { ...(m as Record<string, unknown>), _sh_owner_page: pageId }
            : (m as Record<string, unknown>),
        });
      }
      {
        const n = await ingestAll(inputs);
        dms += n;
      }
    }
  }

  // ── Avis / recommandations de la Page ────────────────────────────────────────
  // Visibles dans Meta Business Suite ; externalId = open_graph_story pour
  // pouvoir y répondre publiquement (POST /{story-id}/comments).
  async function pageRatings(): Promise<void> {
    const ratings = await gpaged(
      `${ctx.pageId}/ratings?fields=review_text,created_time,recommendation_type,reviewer{id,name},open_graph_story{id}&limit=50`,
      token!,
      2,
      errs
    );
    for (const r of ratings) {
      const text = String(r.review_text ?? "");
      if (!text) continue; // note sans texte : rien à traiter
      scanned++;
      const reviewer = r.reviewer as { id?: string; name?: string } | undefined;
      const story = (r.open_graph_story as { id?: string } | undefined)?.id;
      const inserted = await ingestMessage(companyId, {
        channel: "facebook",
        externalId: story ?? `review-${reviewer?.id ?? "anon"}-${String(r.created_time ?? "")}`,
        kind: "review",
        text,
        authorName: reviewer?.name ?? "Avis Facebook",
        authorHandle: reviewer?.id ? String(reviewer.id) : undefined,
        receivedAt: graphTimeToIso(r.created_time),
        raw: r as Record<string, unknown>,
      });
      if (inserted) reviews++;
    }
  }

  // ── Instagram : médias → commentaires + réponses en fil ─────────────────────
  async function igComments(): Promise<void> {
    const media = await gpaged(
      `${ctx.igId}/media?fields=permalink,comments.limit(50){id,text,timestamp,username,replies.limit(25){id,text,timestamp,username}}&limit=25`,
      token!,
      4,
      errs
    );
    for (const m of media) {
      if (timeUp()) return;
      const permalink = m.permalink ? String(m.permalink) : undefined;
      const top = await drainEdge(m.comments as GraphEdge | undefined, 3, errs);
      // Aplati : commentaires de premier niveau + leurs réponses en fil.
      const all: Array<Record<string, unknown>> = [];
      for (const c of top) {
        all.push(c);
        all.push(...(((c.replies as GraphEdge | undefined)?.data) ?? []));
      }
      const inputs: Array<Parameters<typeof ingestMessage>[1]> = [];
      for (const c of all) {
        scanned++;
        const username = c.username ? String(c.username) : undefined;
        inputs.push({
          channel: "instagram",
          externalId: String(c.id ?? ""),
          kind: "comment",
          text: String(c.text ?? ""),
          authorName: username ? `@${username}` : "Utilisateur Instagram",
          authorHandle: username,
          permalink,
          receivedAt: graphTimeToIso(c.timestamp),
          raw: c as Record<string, unknown>,
        });
      }
      {
        const n = await ingestAll(inputs);
        comments += n;
      }
    }
  }

  // ── Publicités EN COURS : commentaires sur les posts réels des créas ────────
  // /ads_posts ne suffit pas : les créas dynamiques et les placements Instagram
  // portent leurs commentaires sur des posts « dark » invisibles autrement.
  // On passe par le compte publicitaire (Marketing API) : chaque pub expose le
  // post réellement diffusé (effective_object_story_id côté FB,
  // effective_instagram_media_id côté IG) → on lit ses commentaires directement.
  const adStats = {
    accounts: 0,
    ads: 0,
    stories: 0,
    media: 0,
    /** Posts pubs d'autres Pages GÉRÉES par l'utilisateur (lus avec leur token). */
    partnerStories: 0,
    partnerPages: "",
    /** Posts pubs de Pages NON accessibles (ni connectée, ni gérée). */
    foreignStories: 0,
    foreignPages: "",
    /** Commentaires pub effectivement importés pour la société. */
    imported: 0,
    /** Pubs ACTIVES dont la créa n'expose AUCUN post/média (créa flexible). */
    activesSansPost: 0,
    /** Posts pubs ACTIFS de la page connectée. */
    ownActive: 0,
  };
  async function adCreativeComments(): Promise<void> {
    const adsToken = ctx.adsToken ?? ctx.userToken;
    if (!adsToken) return;

    // TOUS les comptes pub accessibles : le compte enregistré (choisi par
    // similarité de nom) n'est pas forcément celui qui diffuse les pubs en
    // cours. L'appartenance à la société est garantie plus bas par page/IG.
    const accounts = new Set<string>();
    if (ctx.adAccountId) {
      accounts.add(ctx.adAccountId.startsWith("act_") ? ctx.adAccountId : `act_${ctx.adAccountId}`);
    }
    const accs = await gpaged(`me/adaccounts?fields=account_id&limit=50`, adsToken, 1, errs);
    for (const a of accs) {
      if (a.account_id) accounts.add(`act_${String(a.account_id)}`);
    }
    adStats.accounts = accounts.size;

    // Pages GÉRÉES par l'utilisateur (même Business Suite) : id, nom et surtout
    // TOKEN de chaque page — indispensable pour lire les posts pubs publiés
    // sous une autre identité de Page que celle connectée (erreur #10 sinon).
    const pageTokenById = new Map<string, string>();
    const pageNameById = new Map<string, string>();
    const registerPages = (pages: Array<Record<string, unknown>>) => {
      for (const p of pages) {
        const id = String(p.id ?? "");
        if (!id) continue;
        if (p.access_token && !pageTokenById.has(id)) pageTokenById.set(id, String(p.access_token));
        if (p.name && !pageNameById.has(id)) pageNameById.set(id, String(p.name));
      }
    };
    registerPages(await gpaged(`me/accounts?fields=id,name,access_token&limit=100`, adsToken, 2, errs));
    // Pages du BUSINESS MANAGER : l'écran de sélection Facebook ne partage avec
    // l'app que les pages cochées — les autres pages du Business (ex. pages
    // « funnel » qui portent les pubs) n'apparaissent pas dans me/accounts.
    // business_management permet de les découvrir ET d'obtenir leur token.
    const businesses = await gpaged(`me/businesses?fields=id,name&limit=25`, adsToken, 1, errs);
    for (const b of businesses.slice(0, 5)) {
      const bid = String(b.id ?? "");
      if (!bid) continue;
      registerPages(await gpaged(`${bid}/owned_pages?fields=id,name,access_token&limit=100`, adsToken, 2, errs));
      registerPages(await gpaged(`${bid}/client_pages?fields=id,name,access_token&limit=100`, adsToken, 2, errs));
    }

    const storyIds: string[] = [];
    const igMediaIds: string[] = [];
    const activeStories = new Set<string>();
    const activeMedia = new Set<string>();
    /** Posts pubs d'autres pages gérées, lus avec le token de LEUR page. */
    const partnerStories: Array<{ sid: string; owner: string }> = [];
    const partnerByPage = new Map<string, number>();
    /** Token de page candidat pour lire chaque média IG pub (page de la créa). */
    const mediaHintToken = new Map<string, string>();
    const foreignByPage = new Map<string, number>();
    const foreignSample = new Map<string, { adName: string; act: string; active: boolean }>();
    // Les comptes ont des CENTAINES de vieilles pubs et l'endpoint /ads les
    // sert des plus anciennes aux plus récentes : sans filtre serveur, les
    // pubs EN COURS n'apparaissent même pas dans les 300 premières (constaté :
    // uniquement des commentaires 2013-2025). On demande donc à Meta les pubs
    // ACTIVES directement, puis une page de pubs récentes en complément.
    const ADS_FIELDS =
      "fields=name,effective_status,creative{effective_object_story_id,object_story_id,effective_instagram_media_id}";
    const allAds: Array<Record<string, unknown>> = [];
    const seenAds = new Set<string>();
    const pushAds = (ads: Array<Record<string, unknown>>, act: string) => {
      for (const a of ads) {
        const id = String(a.id ?? "");
        if (id && seenAds.has(id)) continue;
        if (id) seenAds.add(id);
        allAds.push({ ...a, _act: act });
      }
    };
    for (const act of [...accounts].slice(0, 5)) {
      // 1) Pubs EN DIFFUSION (filtre serveur) — la priorité absolue.
      pushAds(
        await gpaged(
          `${act}/ads?${ADS_FIELDS}&effective_status=${encodeURIComponent('["ACTIVE"]')}&limit=100`,
          adsToken,
          3,
          errs
        ),
        act
      );
      // 2) Complément : une page de pubs tous statuts (récemment arrêtées…).
      pushAds(await gpaged(`${act}/ads?${ADS_FIELDS}&limit=100`, adsToken, 1, errs), act);
    }
    adStats.ads = allAds.length;
    {
      const active = allAds.filter((a) => String(a.effective_status ?? "") === "ACTIVE");
      const rest = allAds.filter((a) => String(a.effective_status ?? "") !== "ACTIVE");
      for (const a of [...active, ...rest]) {
        const isActive = String(a.effective_status ?? "") === "ACTIVE";
        const cr = a.creative as
          | { effective_object_story_id?: string; object_story_id?: string; effective_instagram_media_id?: string }
          | undefined;
        const sid = String(cr?.effective_object_story_id ?? cr?.object_story_id ?? "");
        const mid = cr?.effective_instagram_media_id ? String(cr.effective_instagram_media_id) : "";
        const owner = sid ? sid.split("_")[0] : "";
        if (sid) {
          if (ctx.pageId && owner === ctx.pageId) {
            // Post de LA page connectée de la société.
            if (!storyIds.includes(sid)) storyIds.push(sid);
            if (isActive) activeStories.add(sid);
          } else if (otherCompaniesPages.has(owner)) {
            // Page connectée par une AUTRE société : ses contenus lui
            // appartiennent — jamais importés ici (anti-fuite).
          } else if (pageTokenById.has(owner)) {
            // Pub publiée sous une autre Page GÉRÉE par l'utilisateur (même
            // Business Suite, ex. page « funnel ») : on lit ses commentaires
            // avec le token de cette page — quel que soit le compte pub.
            if (partnerStories.length < 200 && !partnerStories.some((s) => s.sid === sid)) {
              partnerStories.push({ sid, owner });
              partnerByPage.set(owner, (partnerByPage.get(owner) ?? 0) + 1);
            }
          } else {
            // Page ni connectée ni gérée : diagnostic uniquement — on retient
            // un EXEMPLE (nom de la pub + compte) pour que l'utilisateur
            // reconnaisse SA campagne dans la bannière.
            foreignByPage.set(owner, (foreignByPage.get(owner) ?? 0) + 1);
            if (!foreignSample.has(owner)) {
              foreignSample.set(owner, {
                adName: String(a.name ?? ""),
                act: String((a as { _act?: string })._act ?? ""),
                active: isActive,
              });
            }
          }
        }
        // Média IG : pubs de la page connectée ou d'une page gérée (jamais
        // celles d'une page appartenant à une autre société).
        if (mid && !otherCompaniesPages.has(owner) && (!owner || (ctx.pageId && owner === ctx.pageId) || pageTokenById.has(owner))) {
          if (!igMediaIds.includes(mid)) igMediaIds.push(mid);
          if (isActive) activeMedia.add(mid);
          const hint = pageTokenById.get(owner);
          if (hint && !mediaHintToken.has(mid)) mediaHintToken.set(mid, hint);
        }
        // Créa flexible/dynamique : aucun post ni média exposé — ses
        // commentaires ne sont atteignables que via ads_posts
        // include_inline_create (cf. fbPostComments).
        if (isActive && !sid && !mid) adStats.activesSansPost++;
      }
    }
    adStats.ownActive = activeStories.size;
    adStats.stories = storyIds.length;
    adStats.media = igMediaIds.length;
    adStats.partnerStories = partnerStories.length;
    adStats.partnerPages = [...partnerByPage.entries()]
      .map(([id, n]) => `${pageNameById.get(id) ?? id} (${n} pubs)`)
      .join(" · ");
    adStats.foreignStories = [...foreignByPage.values()].reduce((s, n) => s + n, 0);
    adStats.foreignPages = [...foreignByPage.entries()]
      .slice(0, 5)
      .map(([id, n]) => {
        const s = foreignSample.get(id);
        const ex = s?.adName ? ` — ex. « ${s.adName} »${s.active ? " (ACTIVE)" : ""}, compte ${s.act.replace("act_", "")}` : "";
        return `Page ${pageNameById.get(id) ?? id} : ${n} pubs${ex}`;
      })
      .join(" · ");

    // À lire : TOUS les posts pubs de la page connectée (l'arrêt à la fenêtre
    // RECENT_SINCE rend chaque lecture bon marché — plus aucun pré-comptage
    // batch : le format ?ids= est tout-ou-rien et un seul id mort invalidait
    // le comptage de 50 posts d'un coup), plus les posts pubs des pages
    // partenaires (lus avec le token de LEUR page).
    const storiesToRead: Array<{ sid: string; readToken: string; owner: string }> = [
      ...new Set([...storyIds, ...activeStories]),
    ]
      .slice(0, 100)
      .map((sid) => ({ sid, readToken: token!, owner: ctx.pageId ?? "" }));
    for (const { sid, owner } of partnerStories.slice(0, 150)) {
      const t = pageTokenById.get(owner);
      if (t) storiesToRead.push({ sid, readToken: t, owner });
    }
    // Médias IG : tous ceux collectés, actifs en tête (pré-comptage supprimé,
    // cf. commentaire storiesToRead).
    const mediaToRead = [...new Set([...activeMedia, ...igMediaIds])].slice(0, 100);

    // Commentaires Facebook sur les posts publicitaires — lectures par lots de
    // 5 en parallèle, insertions parallèles, arrêt propre au budget temps.
    // Fenêtre `since` commune (cf. RECENT_SINCE) : seul moyen fiable d'obtenir
    // les commentaires récents sur les gros fils.
    async function readAdStory(sid: string, readToken: string, owner: string): Promise<void> {
      const list = await readRecentComments(sid, [readToken, adsToken]);
      const inputs: Array<Parameters<typeof ingestMessage>[1]> = [];
      for (const c of list) {
        scanned++;
        const from = c.from as { name?: string; id?: string } | undefined;
        // Réponses de la Page (connectée ou partenaire) : nos propres échos.
        if (from?.id && (from.id === ctx.pageId || from.id === owner)) continue;
        const text = String(c.message ?? "");
        if (!text) continue; // sticker/photo ou contenu caviardé : inexploitable
        inputs.push({
          channel: "facebook",
          externalId: String(c.id ?? ""),
          kind: "comment",
          text,
          authorName: from?.name ?? "Utilisateur Facebook",
          authorHandle: from?.id ? String(from.id) : undefined,
          permalink: `https://www.facebook.com/${sid}`,
          receivedAt: graphTimeToIso(c.created_time),
          // _sh_owner_page : la Page qui possède le post — la RÉPONSE devra
          // partir avec le token de CETTE page (cf. deliverMetaReply).
          raw: { ...(c as Record<string, unknown>), _sh_owner_page: owner },
        });
      }
      const n = await ingestAll(inputs);
      comments += n;
      adStats.imported += n;
    }
    for (let i = 0; i < storiesToRead.length && !timeUp(); i += 5) {
      await Promise.all(storiesToRead.slice(i, i + 5).map((s) => readAdStory(s.sid, s.readToken, s.owner)));
    }

    // Commentaires Instagram sur les médias publicitaires : token de la page
    // connectée, puis token de la page de la créa, puis token utilisateur.
    async function readAdMedia(mid: string): Promise<void> {
      const first = await ggetFirst(`${mid}/comments?fields=id,text,timestamp,username&limit=50`, [
        token,
        mediaHintToken.get(mid),
        adsToken,
      ]);
      const list = await drainEdge((first ?? undefined) as GraphEdge | undefined, 4, errs);
      const inputs: Array<Parameters<typeof ingestMessage>[1]> = [];
      for (const c of list) {
        scanned++;
        const username = c.username ? String(c.username) : undefined;
        inputs.push({
          channel: "instagram",
          externalId: String(c.id ?? ""),
          kind: "comment",
          text: String(c.text ?? ""),
          authorName: username ? `@${username}` : "Utilisateur Instagram",
          authorHandle: username,
          receivedAt: graphTimeToIso(c.timestamp),
          raw: c as Record<string, unknown>,
        });
      }
      const n = await ingestAll(inputs);
      comments += n;
      adStats.imported += n;
    }
    for (let i = 0; i < mediaToRead.length && !timeUp(); i += 5) {
      await Promise.all(mediaToRead.slice(i, i + 5).map((mid) => readAdMedia(mid)));
    }
  }

  // ── Instagram DM : conversations privées (via la Page, platform=instagram) ──
  async function igDms(): Promise<void> {
    const igConvos = await gpaged(
      `${ctx.pageId}/conversations?platform=instagram&fields=updated_time,messages.limit(25){id,message,from,created_time}&limit=50`,
      token!,
      3,
      errs
    );
    for (const conv of igConvos) {
      if (timeUp()) return;
      const msgs = await drainEdge(conv.messages as GraphEdge | undefined, 3, errs);
      const inputs: Array<Parameters<typeof ingestMessage>[1]> = [];
      for (const m of msgs) {
        const from = m.from as { username?: string; id?: string } | undefined;
        if (from?.id && ctx.igId && from.id === ctx.igId) continue;
        const text = String(m.message ?? "");
        if (!text) continue;
        scanned++;
        inputs.push({
          channel: "instagram",
          externalId: String(m.id ?? ""),
          kind: "dm",
          text,
          authorName: from?.username ? `@${from.username}` : "DM Instagram",
          // IMPORTANT : l'ID (IGSID) — c'est lui que la Send API accepte comme
          // destinataire. Le username ne permet PAS de répondre.
          authorHandle: from?.id ? String(from.id) : undefined,
          receivedAt: graphTimeToIso(m.created_time),
          raw: m as Record<string, unknown>,
        });
      }
      {
        const n = await ingestAll(inputs);
        dms += n;
      }
    }
  }

  // Sections lancées EN PARALLÈLE : la route serverless est bornée à 60 s, en
  // séquentiel une grosse Page dépassait le délai et perdait la fin de l'import.
  // ── Temps réel : abonne la Page au webhook de l'app (idempotent) ────────────
  // C'est le mécanisme qu'utilise Business Suite : chaque nouveau commentaire
  // (posts sombres et boosts anciens inclus) et chaque DM arrive instantanément
  // sur /api/inbox/webhook — le polling ne sert plus que de rattrapage.
  async function subscribePageWebhook(): Promise<void> {
    if (!ctx.pageId) return;
    try {
      const res = await fetch(`https://graph.facebook.com/${V}/${ctx.pageId}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          subscribed_fields: "feed,messages,message_echoes",
          access_token: token!,
        }).toString(),
      });
      const j = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (j.error?.message) errs.push(`Webhook non abonné : ${j.error.message}`);
    } catch {
      /* réseau : le prochain passage réessaiera */
    }
  }

  // ── Pages HOMONYMES du Business : même nom que la page connectée ────────────
  // (ex. seconde page « Obesity Care Clinic » qui porte les posts boostés et
  // leurs commentaires). On lit AUSSI leur fil, leurs posts pubs et leurs
  // conversations, avec LEUR token — les réponses partiront en leur nom
  // (raw._sh_owner_page → deliverMetaReply).
  async function homonymPages(): Promise<Array<{ id: string; token: string }>> {
    const adsToken = ctx.adsToken ?? ctx.userToken;
    if (!ctx.pageId || !adsToken) return [];
    const self = await gget(`${ctx.pageId}?fields=name`, token!, errs);
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const selfName = norm(String(self?.name ?? ""));
    if (!selfName) return [];
    const out: Array<{ id: string; token: string }> = [];
    const pages = await gpaged(`me/accounts?fields=id,name,access_token&limit=100`, adsToken, 2, errs);
    for (const p of pages) {
      const id = String(p.id ?? "");
      if (!id || id === ctx.pageId || otherCompaniesPages.has(id)) continue;
      if (!p.access_token || norm(String(p.name ?? "")) !== selfName) continue;
      out.push({ id, token: String(p.access_token) });
    }
    return out.slice(0, 2);
  }

  const jobs: Array<Promise<void>> = [];
  if (ctx.pageId) jobs.push(subscribePageWebhook(), fbPostComments("feed"), fbPostComments("ads_posts"), messengerDms(), pageRatings(), adCreativeComments());
  if (ctx.pageId) {
    for (const twin of await homonymPages()) {
      jobs.push(
        fbPostComments("feed", twin.id, twin.token),
        fbPostComments("ads_posts", twin.id, twin.token),
        messengerDms(twin.id, twin.token)
      );
    }
  }
  if (ctx.igId) jobs.push(igComments());
  if (ctx.igId && ctx.pageId) jobs.push(igDms());
  const [missing] = await Promise.all([missingPermissions(ctx.userToken, errs), ...jobs]);

  // Diagnostic prioritaire : des permissions absentes du token = contenus
  // masqués EN SILENCE par Meta (aucune erreur). On le dit explicitement.
  let note = buildNote(errs);
  // Pages SŒURS détectées dans le fil (crossposts / pages de localisation /
  // seconde page au même nom) : c'est le suspect n°1 des « commentaires
  // visibles dans Business Suite mais absents ici » — Business Suite agrège
  // TOUTES les pages du Business, l'app ne lit que la page connectée.
  if (siblingPages.size > 0) {
    const named: string[] = [];
    for (const pid of [...siblingPages].slice(0, 3)) {
      const info = await gget(`${pid}?fields=name`, ctx.userToken ?? token, []);
      named.push(info?.name ? `« ${String(info.name)} » (${pid})` : pid);
    }
    note =
      `Votre fil référence des publications d'une autre Page de votre Business : ${named.join(" · ")}. ` +
      `Si vos commentaires « manquants » sont sur cette Page (posts boostés compris), connectez-LA : ` +
      `Comptes → reconnecter Facebook → cocher cette Page.` +
      (note ? ` ${note}` : "");
  }
  // Pubs renvoyant vers des Pages NI connectées NI gérées par l'utilisateur :
  // leurs commentaires sont hors de portée des accès actuels — on le dit
  // nommément quand aucun commentaire pub n'a pu être importé par ailleurs.
  if (adStats.foreignStories > 0 && adStats.imported === 0) {
    note =
      `Vos publicités renvoient vers des Pages non accessibles avec vos accès actuels — ${adStats.foreignPages} ` +
      `(${adStats.foreignStories} pubs). Ajoutez ces Pages à votre Business (ou connectez-les dans Comptes) ` +
      `pour importer leurs commentaires.` +
      (note ? ` ${note}` : "");
  }
  if (missing.length > 0) {
    note =
      `Permissions Meta manquantes sur le token actuel : ${missing.join(", ")}. ` +
      `Reconnectez votre Page Meta (Comptes → Facebook) pour les accorder — sans elles, ` +
      `Meta masque une partie des messages sans renvoyer d'erreur.` +
      (note ? ` ${note}` : "");
  }
  // Budget temps atteint : tout ce qui est importé est conservé — la relance
  // reprend là où on s'est arrêté (import idempotent, actifs lus en premier).
  if (partial) {
    note =
      `Synchronisation partielle (beaucoup de contenus à parcourir) : cliquez à nouveau ` +
      `« Synchroniser Meta » pour continuer l'import.` +
      (note ? ` ${note}` : "");
  }
  console.warn("[inbox/sync]", JSON.stringify({ companyId, comments, dms, reviews, scanned, partial, siblings: [...siblingPages].slice(0, 5), ads: adStats, missing, errs: [...new Set(errs)].slice(0, 5) }));

  return {
    imported: comments + dms + reviews,
    scanned,
    comments,
    dms,
    reviews,
    available: true,
    note,
  };
}

export interface DeliverResult {
  delivered: boolean;
  error?: string;
}

/** Cible d'envoi : un commentaire (réponse publique) ou un DM (réponse privée). */
export interface DeliverTarget {
  channel: InboxChannel;
  kind: "comment" | "dm" | "mention" | "review";
  externalId?: string;
  /** Pour un DM : l'identifiant de l'expéditeur (PSID Messenger / IGSID). */
  authorHandle?: string;
  /**
   * "private" sur un commentaire : bascule la réponse en MESSAGE PRIVÉ à son
   * auteur (Private Replies de la Send API — une seule réponse privée par
   * commentaire, fenêtre de 7 jours côté Meta). Défaut : réponse publique.
   */
  visibility?: "public" | "private";
  /**
   * Page propriétaire du post commenté quand ce n'est PAS la page connectée
   * (pubs publiées sous une autre Page du Business) : la réponse doit partir
   * avec le token de CETTE page. Alimenté par raw._sh_owner_page à la sync.
   */
  ownerPageId?: string;
}

/** Token d'une Page gérée (me/accounts, puis pages du Business Manager). */
async function managedPageToken(pageId: string, userToken?: string): Promise<string | null> {
  if (!userToken) return null;
  const find = (res: Record<string, unknown> | null): string | null => {
    for (const p of (res?.data as Array<{ id?: string; access_token?: string }>) ?? []) {
      if (String(p.id ?? "") === pageId && p.access_token) return String(p.access_token);
    }
    return null;
  };
  const direct = find(await gget(`me/accounts?fields=id,access_token&limit=100`, userToken));
  if (direct) return direct;
  const businesses = await gget(`me/businesses?fields=id&limit=25`, userToken);
  for (const b of (businesses?.data as Array<{ id?: string }>) ?? []) {
    if (!b.id) continue;
    for (const edge of ["owned_pages", "client_pages"]) {
      const hit = find(await gget(`${b.id}/${edge}?fields=id,access_token&limit=100`, userToken));
      if (hit) return hit;
    }
  }
  return null;
}

async function metaPost(path: string, params: Record<string, string>): Promise<DeliverResult> {
  try {
    const res = await fetch(`https://graph.facebook.com/${V}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const json = (await res.json()) as { id?: string; message_id?: string; error?: { message?: string } };
    if (json.error) return { delivered: false, error: json.error.message ?? "Erreur Meta." };
    return { delivered: Boolean(json.id || json.message_id) };
  } catch (e) {
    return { delivered: false, error: e instanceof Error ? e.message : "Échec réseau." };
  }
}

/**
 * Envoie une réponse vers la plateforme.
 * - Commentaire FB / avis FB : POST /{comment-or-story-id}/comments
 * - Commentaire IG           : POST /{ig-comment-id}/replies
 * - DM Messenger + DM IG     : POST /{page-id}/messages (Send API — les DM
 *   Instagram passent aussi par le nœud de la PAGE avec le token de Page ;
 *   fenêtre de réponse 24 h côté Meta)
 * Dégradation : si pas de token / cible manquante → delivered=false avec message.
 */
export async function deliverMetaReply(
  companyId: string,
  target: DeliverTarget,
  body: string
): Promise<DeliverResult> {
  const { channel, kind, externalId, authorHandle, visibility, ownerPageId } = target;
  if (channel !== "facebook" && channel !== "instagram") {
    return { delivered: false, error: `Envoi automatique non géré pour ${channel}.` };
  }
  const ctx = await getMetaContext(companyId);
  const token = ctx.pageToken;
  if (!token) return { delivered: false, error: "Page Meta non connectée." };

  // Post d'une AUTRE Page du Business (pub « partenaire ») : la réponse part
  // avec le token et l'identité de CETTE page.
  let sendToken = token;
  let senderPage = ctx.pageId;
  if (ownerPageId && ownerPageId !== ctx.pageId) {
    const alt = await managedPageToken(ownerPageId, ctx.userToken ?? ctx.adsToken);
    if (alt) {
      sendToken = alt;
      senderPage = ownerPageId;
    }
  }

  // ── Bascule public → privé : réponse privée à un commentaire ──────────────
  // Private Replies : le destinataire est le COMMENTAIRE (recipient.comment_id),
  // Meta route le message vers son auteur en DM. Même nœud Page pour FB et IG.
  if (visibility === "private" && kind !== "dm") {
    if (!externalId) return { delivered: false, error: "Identifiant de commentaire manquant." };
    const senderNode = senderPage ?? (channel === "instagram" ? ctx.igId : undefined);
    if (!senderNode) return { delivered: false, error: "Compte expéditeur introuvable." };
    return metaPost(`${senderNode}/messages`, {
      recipient: JSON.stringify({ comment_id: externalId }),
      message: JSON.stringify({ text: body }),
      access_token: sendToken,
    });
  }

  // ── Messages privés (Send API) ─────────────────────────────────────────────
  if (kind === "dm") {
    if (!authorHandle) return { delivered: false, error: "Destinataire du message privé inconnu." };
    // Messenger ET Instagram : l'envoi se fait via le nœud de la PAGE liée
    // (token de Page). On garde l'ID IG en secours si la Page manque.
    const senderNode = ctx.pageId ?? (channel === "instagram" ? ctx.igId : undefined);
    if (!senderNode) return { delivered: false, error: "Compte expéditeur introuvable." };
    return metaPost(`${senderNode}/messages`, {
      recipient: JSON.stringify({ id: authorHandle }),
      message: JSON.stringify({ text: body }),
      messaging_type: "RESPONSE",
      access_token: token,
    });
  }

  // ── Commentaires, avis, mentions (réponse publique) ────────────────────────
  if (!externalId) return { delivered: false, error: "Identifiant de message manquant." };
  const path = channel === "instagram" ? `${externalId}/replies` : `${externalId}/comments`;
  return metaPost(path, { message: body, access_token: sendToken });
}
