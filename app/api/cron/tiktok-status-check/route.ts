/**
 * GET /api/cron/tiktok-status-check
 *
 * Vérifie le VRAI statut des publications TikTok récentes via
 * /post/publish/status/fetch/, déclenchée par Vercel Cron (cf. vercel.json).
 *
 * Pourquoi : un appel /video/init/ ou /content/init/ réussi ne veut PAS dire
 * que le contenu est réellement publié — TikTok le télécharge et le traite de
 * façon ASYNCHRONE ensuite, et peut échouer sans jamais nous le signaler (cas
 * vécu : une photo envoyée par erreur à l'endpoint vidéo est restée marquée
 * "publiée" chez nous alors qu'elle n'a jamais existé sur TikTok — corrigé
 * manuellement en base faute de ce contrôle). Ce cron l'automatise :
 *   - repasse en `failed` tout post TikTok "published" dont TikTok confirme
 *     l'échec (avec le motif renvoyé) ;
 *   - ne fait rien pour les statuts encore en cours (retenté au passage
 *     suivant, dans la fenêtre de vérification) ni pour PUBLISH_COMPLETE
 *     (déjà correct).
 *
 * Fenêtre bornée (pas de nouvelle colonne "déjà vérifié" nécessaire) : un post
 * qui bascule en `failed` sort de lui-même du filtre `status = 'published'`
 * au prochain passage — auto-terminant.
 *
 * Sécurité : valide le header `Authorization: Bearer <CRON_SECRET>`, comme
 * les autres crons.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getTikTokConnectionAdmin } from "@/lib/repositories/tiktok-connection";
import { fetchTikTokPublishStatus } from "@/lib/connectors/providers/tiktok";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Dev local : pas de secret configuré → libre
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// TikTok : traitement généralement < 2 min, modération publique parfois
// "quelques heures" (doc Get Post Status) — fenêtre large mais bornée.
const CHECK_WINDOW_HOURS = 3;
// Tolérance de rapprochement avec sh_history_items (pas de clé étrangère vers
// sh_scheduled_posts ; les deux écritures se font à quelques ms d'écart lors
// de la publication — cf. publish-scheduled.ts).
const HISTORY_MATCH_WINDOW_MS = 10_000;

interface DueRow {
  id: string;
  company_id: string;
  external_id: string | null;
  published_at: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ checked: 0, failed: 0, note: "Supabase non configuré" });

  const since = new Date(Date.now() - CHECK_WINDOW_HOURS * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from("sh_scheduled_posts")
    .select("id, company_id, external_id, published_at")
    .eq("platform", "tiktok")
    .eq("status", "published")
    .not("external_id", "is", null)
    .gte("published_at", since)
    .limit(50);

  if (error) {
    console.error("[cron/tiktok-status-check] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as DueRow[];
  let checked = 0;
  let failed = 0;
  // Un token par société suffit — évite de le relire à chaque post.
  const tokenCache = new Map<string, string | null>();

  for (const row of rows) {
    if (!row.external_id) continue;
    checked++;
    try {
      let accessToken = tokenCache.get(row.company_id);
      if (accessToken === undefined) {
        const conn = await getTikTokConnectionAdmin(row.company_id);
        accessToken = conn?.access_token ?? null;
        tokenCache.set(row.company_id, accessToken);
      }
      if (!accessToken) continue; // compte déconnecté depuis → rien à vérifier

      const status = await fetchTikTokPublishStatus(accessToken, row.external_id);
      if (status.status !== "FAILED") continue; // toujours en cours ou publié — rien à faire

      failed++;
      const detail = status.failReason
        ? `Échec de traitement TikTok après publication (motif : ${status.failReason}).`
        : "Échec de traitement TikTok après publication.";

      // CAS : ne réécrit que si le post est encore "published" (pas déjà
      // retraité par un autre passage ou corrigé manuellement entre-temps).
      await supabase
        .from("sh_scheduled_posts")
        .update({ status: "failed", published_at: null })
        .eq("id", row.id)
        .eq("status", "published");

      // Correction best-effort de l'historique correspondant (jamais bloquant).
      if (row.published_at) {
        const pubAt = new Date(row.published_at).getTime();
        const lo = new Date(pubAt - HISTORY_MATCH_WINDOW_MS).toISOString();
        const hi = new Date(pubAt + HISTORY_MATCH_WINDOW_MS).toISOString();
        await supabase
          .from("sh_history_items")
          .update({
            status: "failed",
            published_at: null,
            error: { title: "Échec de publication", detail: detail.slice(0, 500) },
          })
          .eq("company_id", row.company_id)
          .eq("platform", "tiktok")
          .eq("status", "published")
          .gte("published_at", lo)
          .lte("published_at", hi);
      }
    } catch (err) {
      console.error(`[cron/tiktok-status-check] post ${row.id}:`, err);
    }
  }

  return NextResponse.json({ checked, failed });
}
