// Diagnostic TEMPORAIRE (lecture seule) : localiser une publicité/un post
// boosté dont les commentaires n'apparaissent pas dans la messagerie.
// Appelé par le cron inbox-sync ; les résultats sont journalisés
// ([inbox/debug]) et lus dans les logs Vercel. À retirer une fois la cause
// identifiée.

import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

/** Motifs de recherche dans le nom/le texte des pubs (post boosté recherché). */
const AD_PATTERN = /free|weight|surgery|abroad|obes/i;
/** Page du Business référencée par le fil mais illisible avec les accès actuels. */
const MYSTERY_PAGE = "883412421445921";

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

/**
 * Pour la société dont la Page connectée matche /obes/i : liste les comptes
 * pub, cherche les pubs correspondant au post boosté recherché, sonde la Page
 * mystère avec chaque token, et teste l'ordre de lecture des fils de
 * commentaires des posts trouvés.
 */
export async function debugMetaAds(companyId: string): Promise<void> {
  const ctx = await getMetaContext(companyId);
  if (!/obes/i.test(ctx.pageName ?? "")) return;
  const tokens: Array<[string, string]> = [];
  if (ctx.pageToken) tokens.push(["pageToken", ctx.pageToken]);
  if (ctx.userToken) tokens.push(["userToken", ctx.userToken]);
  if (ctx.adsToken) tokens.push(["adsToken", ctx.adsToken]);
  if (tokens.length === 0) return;
  const deadline = Date.now() + 15_000;

  // 1) La Page mystère : lisible avec l'un des tokens ?
  for (const [label, tok] of tokens) {
    const r = await g(`${MYSTERY_PAGE}?fields=id,name,link,is_published`, tok);
    log(`page ${MYSTERY_PAGE} via ${label}`, r);
  }

  // 2) Comptes pub visibles + pubs correspondant au motif.
  const reader = ctx.adsToken ?? ctx.userToken ?? ctx.pageToken!;
  const accounts = await g(`me/adaccounts?fields=account_id,name&limit=100`, reader);
  log("adaccounts", accounts);
  const ids = new Set<string>(
    ((accounts as { data?: Array<{ account_id?: string }> }).data ?? [])
      .map((a) => String(a.account_id ?? ""))
      .filter(Boolean)
  );
  if (ctx.adAccountId) ids.add(String(ctx.adAccountId));

  const stories: string[] = [];
  for (const acc of ids) {
    if (Date.now() > deadline) {
      log("budget", { stop: "avant compte", compte: acc });
      break;
    }
    const ads = await g(
      `act_${acc}/ads?fields=id,name,effective_status,effective_object_story_id,` +
        `creative{object_story_id,effective_object_story_id,title,body,object_story_spec{page_id}}` +
        `&limit=100&include_inline_create=true`,
      reader
    );
    const rows = ((ads as { data?: Array<Record<string, unknown>> }).data ?? []);
    if ((ads as { __err?: string }).__err) {
      log(`act_${acc} pubs`, ads);
      continue;
    }
    const hits = rows.filter((ad) => {
      const cre = (ad.creative ?? {}) as Record<string, unknown>;
      const hay = `${ad.name ?? ""} ${cre.title ?? ""} ${cre.body ?? ""}`;
      return AD_PATTERN.test(hay);
    });
    log(`act_${acc}`, { pubs: rows.length, correspondantes: hits.length });
    for (const ad of hits.slice(0, 6)) {
      const cre = (ad.creative ?? {}) as Record<string, unknown>;
      const spec = (cre.object_story_spec ?? {}) as Record<string, unknown>;
      const sid = String(ad.effective_object_story_id ?? cre.effective_object_story_id ?? cre.object_story_id ?? "");
      log("pub correspondante", {
        compte: acc,
        id: ad.id,
        nom: ad.name,
        statut: ad.effective_status,
        story: sid || null,
        page_creative: spec.page_id ?? null,
      });
      if (sid && !stories.includes(sid)) stories.push(sid);
    }
  }

  // 3) Fils de commentaires des posts trouvés : totaux et ORDRE réellement
  // servi par Graph (hypothèse : fil servi du plus ancien au plus récent
  // malgré order=reverse_chronological → la fenêtre 90 j coupe trop tôt).
  for (const sid of stories.slice(0, 4)) {
    for (const [label, tok] of tokens) {
      const probe = await g(
        `${sid}/comments?order=reverse_chronological&limit=3&fields=id,message,created_time&summary=true`,
        tok
      );
      const p = probe as {
        __err?: string;
        summary?: { total_count?: number };
        data?: Array<{ created_time?: string; message?: string }>;
      };
      log(`story ${sid} via ${label}`, {
        erreur: p.__err ?? null,
        total: p.summary?.total_count ?? null,
        premiers: (p.data ?? []).map((c) => ({ quand: c.created_time, texte: String(c.message ?? "").slice(0, 40) })),
      });
      if (!p.__err) break;
    }
  }
}
