/**
 * GET /api/cron/publish-due
 *
 * Publication automatique des posts programmés arrivés à échéance, déclenchée
 * par Vercel Cron (toutes les 10 minutes, cf. vercel.json). Pour chaque post
 * "scheduled" dont date + heure <= maintenant (toutes sociétés confondues,
 * via le client admin) :
 *   1. Publie réellement via le connecteur de la plateforme
 *      (lib/publishing/publish-scheduled.ts — même logique que
 *      POST /api/scheduled-posts/[id]/publish)
 *   2. Marque le post "published" en base
 * En cas d'échec (compte non connecté, token expiré…), le post reste
 * "scheduled" et sera retenté au prochain passage ; l'erreur est journalisée.
 *
 * Plateformes traitées : LinkedIn, Facebook, Instagram, Twitter/X, TikTok
 * (extensible — ajouter à PLATFORMS). NB Twitter = texte seul ; TikTok exige
 * une vidéo et reste en SELF_ONLY tant que l'app n'est pas auditée par TikTok.
 *
 * Sécurité : valide le header `Authorization: Bearer <CRON_SECRET>`.
 * Si CRON_SECRET est absent (dev/local), laisse passer sans contrôle.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  listDueScheduledPosts,
  publishScheduledPostNow,
  claimDueScheduledPost,
  finalizeFailedScheduledPost,
  isPermanentPublishError,
  reclaimStalePublishing,
} from "@/lib/publishing/publish-scheduled";
import type { Platform } from "@/lib/types";

// Fenêtre d'exécution confortable pour traiter le lot sans coupure.
export const maxDuration = 60;

// Publications traitées en parallèle par paquet (débit ↑ sans saturer les API).
const CONCURRENCY = 8;

const PLATFORMS: Platform[] = ["linkedin", "facebook", "instagram", "twitter", "tiktok"];

/* ── Auth ──────────────────────────────────────────────────────────────── */

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Dev local : pas de secret configuré → libre
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

/* ── Handler principal ─────────────────────────────────────────────────── */

interface PublishResultSummary {
  postId: string;
  companyId: string;
  platform: Platform;
  title: string;
  ok: boolean;
  simulated?: boolean;
  error?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startedAt = new Date().toISOString();

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Récupère d'abord les posts bloqués en `publishing` (crash d'un run précédent).
    const reclaimed = await reclaimStalePublishing();

    const due = await listDueScheduledPosts(PLATFORMS);

    // Publie un post APRÈS l'avoir « réservé » (verrou anti double-publication).
    // Renvoie null si un autre passage l'a déjà pris.
    async function process(item: { post: typeof due[number]["post"]; companyId: string }): Promise<PublishResultSummary | null> {
      const { post, companyId } = item;
      const claimed = await claimDueScheduledPost(post.id);
      if (!claimed) return null; // déjà traité par un autre passage concurrent
      const outcome = await publishScheduledPostNow(post, companyId, { admin: true });
      if (!outcome.ok) {
        const permanent = isPermanentPublishError(outcome.status);
        // Échec permanent → `failed` (on arrête de réessayer) ; transitoire →
        // on relâche le verrou en repassant `scheduled` (réessai au prochain run).
        await finalizeFailedScheduledPost(post.id, permanent);
        console.error(
          `[cron/publish-due] Échec ${permanent ? "permanent" : "transitoire"} post ${post.id} (${post.platform}, company ${companyId}):`,
          outcome.error
        );
      }
      return {
        postId: post.id,
        companyId,
        platform: post.platform,
        title: post.title,
        ok: outcome.ok,
        simulated: outcome.simulated,
        error: outcome.error,
      };
    }

    // Traitement par paquets parallèles (débit ↑, sans saturer les API réseau).
    const results: PublishResultSummary[] = [];
    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const slice = due.slice(i, i + CONCURRENCY);
      const settled = await Promise.all(slice.map(process));
      for (const r of settled) if (r) results.push(r);
    }

    return NextResponse.json({
      startedAt,
      finishedAt: new Date().toISOString(),
      reclaimed,
      duePosts: due.length,
      claimed: results.length,
      skipped: due.length - results.length,
      published: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    // Jamais fatal — retourner un 200 avec l'erreur
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[cron/publish-due] Erreur globale:", errorMsg);
    return NextResponse.json({
      startedAt,
      finishedAt: new Date().toISOString(),
      duePosts: 0,
      published: 0,
      failed: 0,
      results: [],
      error: errorMsg,
    });
  }
}
