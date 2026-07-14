// Diagnostic TEMPORAIRE (lecture seule) v5. Acquis : les commentaires de
// juillet ne sont ni sur le fil (700 posts), ni sur les stories des 2 pubs
// ACTIVES (0, tous ordres), ni dans dynamic_posts (0 variante), ni dans
// ads_posts (vide). v5 : (1) sonde le compteur de commentaires de TOUTES les
// stories de pubs de la page (tous comptes, tous statuts) — l'ancienne
// campagne NHS de mai 2025 peut recevoir des commentaires aujourd'hui ;
// (2) suit les redirections des liens de prévisualisation fb.me des 2 pubs
// actives pour révéler l'id du post réellement servi.

import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

/** Liens de prévisualisation des 2 pubs actives (v4). */
const PREVIEW_LINKS = ["https://fb.me/2XQA2qz3hLNROYr", "https://fb.me/1V2rF8F08RbwCeF"];

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
  if (!page || !ctx.pageId) return;
  const reader = ctx.adsToken ?? ctx.userToken ?? page;
  const deadline = Date.now() + 22_000;

  // 1) Toutes les stories de pubs de la page, tous comptes et tous statuts.
  const accounts = await g(`me/adaccounts?fields=account_id&limit=100`, reader);
  const ids = new Set<string>(
    ((accounts as { data?: Array<{ account_id?: string }> }).data ?? [])
      .map((a) => String(a.account_id ?? ""))
      .filter(Boolean)
  );
  if (ctx.adAccountId) ids.add(String(ctx.adAccountId));

  const stories = new Set<string>();
  for (const acc of ids) {
    const ads = await g(
      `act_${acc}/ads?fields=effective_object_story_id&limit=200&include_inline_create=true`,
      reader
    );
    for (const ad of ((ads as { data?: Array<{ effective_object_story_id?: string }> }).data ?? [])) {
      const sid = String(ad.effective_object_story_id ?? "");
      if (sid.startsWith(`${ctx.pageId}_`)) stories.add(sid);
    }
  }
  log("stories de la page a sonder", { total: stories.size });

  let probed = 0;
  let withComments = 0;
  for (const sid of stories) {
    if (Date.now() > deadline) {
      log("budget atteint", { sondees: probed, restantes: stories.size - probed });
      break;
    }
    probed++;
    const r = await g(
      `${sid}?fields=comments.summary(true).order(reverse_chronological).limit(2){message,created_time,from}`,
      page
    );
    if ((r as { __err?: string }).__err) {
      log(`story ${sid}`, r);
      continue;
    }
    const c = ((r as Record<string, unknown>).comments ?? {}) as {
      summary?: { total_count?: number };
      data?: Array<{ created_time?: string; message?: string; from?: { name?: string } }>;
    };
    const total = c.summary?.total_count ?? 0;
    if (total === 0) continue;
    withComments++;
    log("STORY COMMENTÉE", {
      story: sid,
      total,
      derniers: (c.data ?? []).map((x) => ({
        quand: x.created_time,
        qui: x.from?.name ?? null,
        texte: String(x.message ?? "").slice(0, 50),
      })),
    });
  }
  log("sondage stories bilan", { sondees: probed, commentees: withComments });

  // 2) Redirections des liens de prévisualisation (id du post réellement servi).
  for (const link of PREVIEW_LINKS) {
    try {
      let url = link;
      const chain: string[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await fetch(url, { redirect: "manual", cache: "no-store" });
        const loc = res.headers.get("location");
        chain.push(`${res.status} → ${loc ? loc.slice(0, 160) : "(fin)"}`);
        if (!loc) break;
        url = loc.startsWith("http") ? loc : new URL(loc, url).toString();
      }
      log(`preview ${link}`, chain);
    } catch (e) {
      log(`preview ${link}`, { erreur: e instanceof Error ? e.message : "réseau" });
    }
  }
}
