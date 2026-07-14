// Diagnostic TEMPORAIRE (lecture seule) v3 : les pubs actives « OCC FRANCE »
// (créas flexibles, titre « Free Weight Loss Surgery Abroad! ») sont
// identifiées — stories 115871611517429_912308595222970 / _912306261889870.
// Reste à trouver OÙ vivent les commentaires : sur ces stories (alors
// pourquoi la sync les rate ?) ou sur des VARIANTES de post sombre générées
// par la créa flexible. Résultats journalisés ([inbox/debug]).

import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

/** Stories des pubs actives « OCC FRANCE » (créa flexible NHS). */
const ACTIVE_STORIES = ["115871611517429_912308595222970", "115871611517429_912306261889870"];

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

function shortComments(r: unknown): unknown {
  const p = r as {
    __err?: string;
    summary?: { total_count?: number };
    data?: Array<{ created_time?: string; message?: string; from?: { name?: string } }>;
  };
  if (p.__err) return { erreur: p.__err };
  return {
    total: p.summary?.total_count ?? null,
    premiers: (p.data ?? []).slice(0, 3).map((c) => ({
      quand: c.created_time,
      qui: c.from?.name ?? null,
      texte: String(c.message ?? "").slice(0, 50),
    })),
  };
}

export async function debugMetaAds(companyId: string): Promise<void> {
  const ctx = await getMetaContext(companyId);
  if (!/obes/i.test(ctx.pageName ?? "")) return;
  const page = ctx.pageToken;
  if (!page) return;
  const tokens: Array<[string, string]> = [["pageToken", page]];
  if (ctx.adsToken) tokens.push(["adsToken", ctx.adsToken]);
  if (ctx.userToken) tokens.push(["userToken", ctx.userToken]);

  // 1) Les 2 stories actives : total et premiers commentaires, dans les deux
  //    ordres et en filter=stream (réponses de fil comprises).
  for (const sid of ACTIVE_STORIES) {
    for (const [label, tok] of tokens) {
      const rev = await g(
        `${sid}/comments?order=reverse_chronological&limit=5&summary=true&fields=id,message,created_time,from`,
        tok
      );
      log(`story ${sid} reverse via ${label}`, shortComments(rev));
      const stream = await g(
        `${sid}/comments?filter=stream&order=reverse_chronological&limit=5&summary=true&fields=id,message,created_time,from`,
        tok
      );
      log(`story ${sid} stream via ${label}`, shortComments(stream));
      if (!(rev as { __err?: string }).__err) break; // un token lisible suffit
    }
  }

  // 2) Posts SOMBRES (non publiés) de la page — les variantes des créas
  //    flexibles vivent ici si l'edge est encore servi.
  const dark = await g(
    `${ctx.pageId}/promotable_posts?is_published=false&include_hidden=true&limit=100` +
      `&fields=id,created_time,is_published,` +
      `comments.summary(true).order(reverse_chronological).limit(2){message,created_time,from}`,
    page
  );
  if ((dark as { __err?: string }).__err) {
    log("promotable_posts", dark);
  } else {
    const rows = ((dark as { data?: Array<Record<string, unknown>> }).data ?? []);
    const commented = rows.filter(
      (p) => (((p.comments ?? {}) as { summary?: { total_count?: number } }).summary?.total_count ?? 0) > 0
    );
    log("promotable_posts bilan", { posts: rows.length, commentés: commented.length });
    for (const p of commented.slice(0, 8)) {
      const c = (p.comments ?? {}) as {
        summary?: { total_count?: number };
        data?: Array<{ created_time?: string; message?: string; from?: { name?: string } }>;
      };
      log("POST SOMBRE COMMENTÉ", {
        post: p.id,
        cree: p.created_time,
        total: c.summary?.total_count ?? 0,
        derniers: (c.data ?? []).map((x) => ({
          quand: x.created_time,
          qui: x.from?.name ?? null,
          texte: String(x.message ?? "").slice(0, 50),
        })),
      });
    }
  }

  // 3) ads_posts : pourquoi vide ? Réponse brute (1re page) avec deux tokens.
  for (const [label, tok] of tokens.slice(0, 2)) {
    const raw = await g(`${ctx.pageId}/ads_posts?limit=10&fields=id,created_time,is_published`, tok);
    const rows = ((raw as { data?: Array<unknown> }).data ?? []);
    log(`ads_posts via ${label}`, (raw as { __err?: string }).__err ? raw : { posts: rows.length, ids: rows });
  }
}
