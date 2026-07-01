/**
 * GET /api/cron/reconcile-renders
 *
 * Filet de sécurité de la file de rendus : rattrape les jobs restés
 * `processing` (webhook provider manqué/perdu). Pour chaque job ancien, on
 * interroge le provider (Replicate / Shotstack) ; si le rendu est prêt on
 * persiste le média + finalise le job, s'il a échoué on le marque `failed`.
 *
 * Déclenché par Vercel Cron (cf. vercel.json). Sécurité : Bearer CRON_SECRET.
 */

export const runtime = "nodejs";
// Empêche la mise en cache statique de cette route GET (cron → doit s'exécuter à chaque appel).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import {
  listStaleProcessingJobs,
  completeRenderJob,
  failRenderJob,
  type RenderJob,
} from "@/lib/jobs/render-jobs";
import { getReplicatePrediction } from "@/lib/ai/replicate";
import { getRenderStatus } from "@/lib/video/render";
import { persistRemoteMedia, saveMediaAsset } from "@/lib/repositories/media";

// On laisse ~3 min au webhook avant de réconcilier (évite les doublons inutiles).
const STALE_MS = 3 * 60_000;
const CONCURRENCY = 5;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev local
  return (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

async function reconcile(job: RenderJob): Promise<"done" | "failed" | "pending"> {
  if (!job.predictionId) return "pending";

  // Statut provider → URL si terminé.
  let url: string | null = null;
  let failed = false;
  if (job.provider === "replicate") {
    const r = await getReplicatePrediction(job.predictionId);
    if (r.status === "succeeded") url = r.videoUrl ?? null;
    else if (r.status === "failed") failed = true;
  } else {
    const r = await getRenderStatus(job.predictionId); // shotstack (id encode l'env)
    if (r.status === "done") url = r.url ?? null;
    else if (r.status === "failed") failed = true;
  }

  if (url) {
    const permanent = await persistRemoteMedia(job.companyId, url, "video");
    await saveMediaAsset(job.companyId, { url: permanent, type: "video", source: `studio-${job.kind}` });
    await completeRenderJob(job.id, permanent);
    return "done";
  }
  if (failed) {
    await failRenderJob(job.id, "Rendu échoué (réconciliation).");
    return "failed";
  }
  return "pending";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const startedAt = new Date().toISOString();
  try {
    const stale = await listStaleProcessingJobs(STALE_MS);
    let done = 0, failed = 0, pending = 0;
    for (let i = 0; i < stale.length; i += CONCURRENCY) {
      const slice = stale.slice(i, i + CONCURRENCY);
      const outcomes = await Promise.all(slice.map((j) => reconcile(j).catch(() => "pending" as const)));
      for (const o of outcomes) o === "done" ? done++ : o === "failed" ? failed++ : pending++;
    }
    return NextResponse.json({ startedAt, finishedAt: new Date().toISOString(), checked: stale.length, done, failed, pending });
  } catch (err) {
    console.error("[cron/reconcile-renders]", err);
    return NextResponse.json({ startedAt, error: err instanceof Error ? err.message : "error", checked: 0 });
  }
}
