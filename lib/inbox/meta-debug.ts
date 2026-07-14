// Diagnostic TEMPORAIRE (lecture seule) v6 : sonde le compteur de
// commentaires de TOUTES les stories de pubs de la page (tous comptes, tous
// statuts). La v5 est revenue vide sans explication : la v6 journalise CHAQUE
// erreur (comptes, listing des pubs, sondage des stories) pour voir où ça
// casse (rate-limit Graph ? limite de page ?). Résultats : [inbox/debug].

import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

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

  const accounts = await g(`me/adaccounts?fields=account_id&limit=100`, reader);
  if ((accounts as { __err?: string }).__err) log("adaccounts ERREUR", accounts);
  const ids = new Set<string>(
    ((accounts as { data?: Array<{ account_id?: string }> }).data ?? [])
      .map((a) => String(a.account_id ?? ""))
      .filter(Boolean)
  );
  if (ctx.adAccountId) ids.add(String(ctx.adAccountId));
  log("comptes", [...ids]);

  const stories = new Set<string>();
  for (const acc of ids) {
    const ads = await g(
      `act_${acc}/ads?fields=effective_object_story_id&limit=100&include_inline_create=true`,
      reader
    );
    if ((ads as { __err?: string }).__err) {
      log(`act_${acc} ERREUR`, ads);
      continue;
    }
    const rows = ((ads as { data?: Array<{ effective_object_story_id?: string }> }).data ?? []);
    let own = 0;
    for (const ad of rows) {
      const sid = String(ad.effective_object_story_id ?? "");
      if (sid.startsWith(`${ctx.pageId}_`)) {
        stories.add(sid);
        own++;
      }
    }
    log(`act_${acc}`, { pubs: rows.length, storiesPage: own });
  }
  log("stories a sonder", { total: stories.size });

  let probed = 0;
  let withComments = 0;
  let errors = 0;
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
      errors++;
      if (errors <= 3) log(`story ${sid} ERREUR`, r);
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
  log("sondage bilan", { sondees: probed, commentees: withComments, erreurs: errors });
}
