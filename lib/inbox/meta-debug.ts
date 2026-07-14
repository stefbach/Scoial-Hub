// Diagnostic TEMPORAIRE (lecture seule) : localiser le post qui porte des
// commentaires récents visibles dans Business Suite mais introuvables par la
// sync. Appelé par le cron inbox-sync ; résultats journalisés ([inbox/debug])
// et lus dans les logs Vercel. À retirer une fois la cause identifiée.

import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

/** Page du Business référencée par le fil mais illisible avec les accès actuels. */
const MYSTERY_PAGE = "883412421445921";
/** Ne journalise que les commentaires postérieurs à cette date. */
const RECENT = "2026-06-25";

async function g(path: string, token: string): Promise<Record<string, unknown> | { __err: string }> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      `https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const j = (await res.json()) as Record<string, unknown>;
    const err = (j as { error?: { message?: string } }).error;
    if (err) return { __err: err.message ?? "erreur Graph" };
    return j;
  } catch (e) {
    return { __err: e instanceof Error ? e.message : "réseau" };
  }
}

function log(what: string, data: unknown): void {
  console.warn("[inbox/debug]", what, JSON.stringify(data));
}

interface PostRow {
  id?: string;
  permalink_url?: string;
  comments?: {
    summary?: { total_count?: number };
    data?: Array<{ id?: string; message?: string; created_time?: string; from?: { name?: string } }>;
  };
}

/**
 * Pour la société dont la Page connectée matche /obes/i :
 * 1) demande à Graph, pour CHAQUE post du fil et des posts pubs, le total de
 *    commentaires et les 2 plus récents (expansion summary en tri inverse) —
 *    identifie directement le post qui porte les commentaires de juillet ;
 * 2) journalise les créas FLEXIBLES des pubs ACTIVES du compte pub principal
 *    (asset_feed_spec : le texte « Free Weight Loss Surgery Abroad! » peut y
 *    vivre sans apparaître dans name/title/body) ;
 * 3) sonde la Page mystère (l'accès a-t-il été accordé depuis ?).
 */
export async function debugMetaAds(companyId: string): Promise<void> {
  const ctx = await getMetaContext(companyId);
  if (!/obes/i.test(ctx.pageName ?? "")) return;
  const token = ctx.pageToken ?? ctx.userToken;
  if (!token) return;
  const deadline = Date.now() + 15_000;

  // 1) Post(s) à commentaires récents — la question posée directement à Graph.
  const expansion =
    `comments.summary(true).order(reverse_chronological).limit(2)` +
    `{id,message,created_time,from}`;
  for (const edge of ["feed", "ads_posts?include_inline_create=true&"]) {
    const base = edge.includes("?") ? edge : `${edge}?`;
    let pages = 0;
    let posts = 0;
    let withComments = 0;
    let r = await g(`${ctx.pageId}/${base}fields=id,permalink_url,${expansion}&limit=100`, token);
    while (pages < 8 && Date.now() < deadline) {
      pages++;
      if ((r as { __err?: string }).__err) {
        log(`${edge} page ${pages}`, r);
        break;
      }
      const rows = ((r as { data?: PostRow[] }).data ?? []);
      posts += rows.length;
      for (const p of rows) {
        const total = p.comments?.summary?.total_count ?? 0;
        if (total === 0) continue;
        withComments++;
        const latest = p.comments?.data ?? [];
        const isRecent = latest.some((c) => String(c.created_time ?? "") >= RECENT);
        if (isRecent || withComments <= 5) {
          log(isRecent ? "POST À COMMENTAIRES RÉCENTS" : "post commenté (ancien)", {
            edge: edge.replace(/\?.*$/, ""),
            post: p.id,
            lien: p.permalink_url,
            total,
            derniers: latest.map((c) => ({
              quand: c.created_time,
              qui: c.from?.name ?? null,
              texte: String(c.message ?? "").slice(0, 50),
            })),
          });
        }
      }
      // paging.next est une URL complète (token inclus) : on la suit telle quelle.
      const next = (r as { paging?: { next?: string } }).paging?.next;
      if (!next || rows.length === 0) break;
      try {
        const res = await fetch(next, { cache: "no-store" });
        r = (await res.json()) as Record<string, unknown>;
        if ((r as { error?: { message?: string } }).error) {
          r = { __err: ((r as { error?: { message?: string } }).error?.message) ?? "erreur Graph" };
        }
      } catch {
        break;
      }
    }
    log(`${edge.replace(/\?.*$/, "")} bilan`, { pages, posts, commentés: withComments });
  }

  // 2) Créas flexibles des pubs ACTIVES du compte principal.
  const reader = ctx.adsToken ?? ctx.userToken ?? token;
  if (ctx.adAccountId) {
    const ads = await g(
      `act_${ctx.adAccountId}/ads?fields=id,name,effective_status,effective_object_story_id,` +
        `creative{object_story_id,effective_object_story_id,asset_feed_spec{titles,bodies,link_urls},object_story_spec{page_id}}` +
        `&effective_status=["ACTIVE"]&limit=50&include_inline_create=true`,
      reader
    );
    const rows = ((ads as { data?: Array<Record<string, unknown>> }).data ?? []);
    if ((ads as { __err?: string }).__err) log("pubs actives", ads);
    for (const ad of rows.slice(0, 10)) {
      const cre = (ad.creative ?? {}) as Record<string, unknown>;
      const feed = (cre.asset_feed_spec ?? {}) as {
        titles?: Array<{ text?: string }>;
        bodies?: Array<{ text?: string }>;
      };
      log("pub ACTIVE", {
        id: ad.id,
        nom: ad.name,
        story: ad.effective_object_story_id ?? cre.effective_object_story_id ?? cre.object_story_id ?? null,
        page_creative: ((cre.object_story_spec ?? {}) as { page_id?: string }).page_id ?? null,
        titres: (feed.titles ?? []).map((t) => String(t.text ?? "").slice(0, 60)),
        corps: (feed.bodies ?? []).map((b) => String(b.text ?? "").slice(0, 60)),
      });
    }
  }

  // 3) La Page mystère : l'accès a-t-il été accordé depuis ?
  log(`page ${MYSTERY_PAGE}`, await g(`${MYSTERY_PAGE}?fields=id,name,link,is_published`, ctx.userToken ?? token));
}
