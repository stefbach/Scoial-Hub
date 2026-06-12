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
 * Plateformes traitées : LinkedIn (extensible — ajouter à PLATFORMS).
 *
 * Sécurité : valide le header `Authorization: Bearer <CRON_SECRET>`.
 * Si CRON_SECRET est absent (dev/local), laisse passer sans contrôle.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  listDueScheduledPosts,
  publishScheduledPostNow,
} from "@/lib/publishing/publish-scheduled";
import type { Platform } from "@/lib/types";

const PLATFORMS: Platform[] = ["linkedin"];

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
    const due = await listDueScheduledPosts(PLATFORMS);

    const results: PublishResultSummary[] = [];
    for (const { post, companyId } of due) {
      const outcome = await publishScheduledPostNow(post, companyId, { admin: true });
      if (!outcome.ok) {
        console.error(
          `[cron/publish-due] Échec post ${post.id} (${post.platform}, company ${companyId}):`,
          outcome.error
        );
      }
      results.push({
        postId: post.id,
        companyId,
        platform: post.platform,
        title: post.title,
        ok: outcome.ok,
        simulated: outcome.simulated,
        error: outcome.error,
      });
    }

    return NextResponse.json({
      startedAt,
      finishedAt: new Date().toISOString(),
      duePosts: due.length,
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
