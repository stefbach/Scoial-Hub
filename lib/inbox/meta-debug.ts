// Diagnostic TEMPORAIRE (lecture seule) v4 : les commentaires des pubs
// actives « OCC FRANCE » (créa flexible) ne sont NI sur le fil (700 posts
// sondés), NI sur les 2 stories principales (0 commentaire, tous ordres),
// NI dans ads_posts (vide) ; promotable_posts n'existe plus. Hypothèse
// restante : les VARIANTES de post générées par la créa dynamique/flexible
// — edge /{post}/dynamic_posts. Résultats journalisés ([inbox/debug]).

import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

/** Stories des pubs actives « OCC FRANCE » (créa flexible NHS). */
const ACTIVE_STORIES = ["115871611517429_912308595222970", "115871611517429_912306261889870"];
/** Ids des 2 pubs actives (compte OCC-Malta). */
const ACTIVE_ADS = ["120223689372380677", "120223689372410677"];

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

export async function debugMetaAds(companyId: string): Promise<void> {
  const ctx = await getMetaContext(companyId);
  if (!/obes/i.test(ctx.pageName ?? "")) return;
  const page = ctx.pageToken;
  if (!page) return;

  // 1) Variantes de post des créas dynamiques/flexibles : /{post}/dynamic_posts.
  for (const sid of ACTIVE_STORIES) {
    const dyn = await g(
      `${sid}/dynamic_posts?limit=25&fields=id,` +
        `comments.summary(true).order(reverse_chronological).limit(3){id,message,created_time,from}`,
      page
    );
    if ((dyn as { __err?: string }).__err) {
      log(`dynamic_posts ${sid}`, dyn);
      continue;
    }
    const rows = ((dyn as { data?: Array<Record<string, unknown>> }).data ?? []);
    log(`dynamic_posts ${sid} bilan`, { variantes: rows.length });
    for (const p of rows) {
      const c = (p.comments ?? {}) as {
        summary?: { total_count?: number };
        data?: Array<{ id?: string; created_time?: string; message?: string; from?: { name?: string } }>;
      };
      const total = c.summary?.total_count ?? 0;
      if (total === 0) continue;
      log("VARIANTE COMMENTÉE", {
        post: p.id,
        total,
        derniers: (c.data ?? []).map((x) => ({
          quand: x.created_time,
          qui: x.from?.name ?? null,
          texte: String(x.message ?? "").slice(0, 50),
        })),
      });
    }
  }

  // 2) Lien de prévisualisation des 2 pubs (peut révéler l'id du post servi).
  const reader = ctx.adsToken ?? ctx.userToken ?? page;
  for (const adId of ACTIVE_ADS) {
    const ad = await g(`${adId}?fields=preview_shareable_link,creative{id,effective_object_story_id}`, reader);
    log(`pub ${adId} preview`, ad);
  }

  // 3) ads_posts avec include_inline_create (la variante « inline » du listing).
  const ap = await g(
    `${ctx.pageId}/ads_posts?include_inline_create=true&limit=25&fields=id,created_time,is_published,admin_creator`,
    page
  );
  const rows = ((ap as { data?: Array<unknown> }).data ?? []);
  log("ads_posts inline", (ap as { __err?: string }).__err ? ap : { posts: rows.length, premiers: rows.slice(0, 5) });
}
