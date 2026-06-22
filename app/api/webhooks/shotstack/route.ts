// POST /api/webhooks/shotstack?job=<jobId>&secret=<WEBHOOK_SECRET>
//
// Callback Shotstack à la fin d'un rendu vidéo studio. Persiste la vidéo finale
// et finalise le job — le résultat atterrit dans la bibliothèque même si
// l'utilisateur a fermé l'onglet. Idempotent (job déjà 'done' ignoré).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getRenderJob, completeRenderJob, failRenderJob } from "@/lib/jobs/render-jobs";
import { persistRemoteMedia, saveMediaAsset } from "@/lib/repositories/media";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get("secret") ?? "";
  if (!env.webhookSecret || secret !== env.webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobId = req.nextUrl.searchParams.get("job") ?? "";
  if (!jobId) return NextResponse.json({ error: "job requis" }, { status: 400 });

  try {
    const job = await getRenderJob(jobId);
    if (!job) return NextResponse.json({ ok: true, ignored: "job introuvable" });
    if (job.status === "done") return NextResponse.json({ ok: true, idempotent: true });

    // Callback Shotstack : { status: "done"|"failed", url, error }
    const body = (await req.json().catch(() => ({}))) as { status?: string; url?: string; error?: string };

    if (body.status === "done" && body.url) {
      const permanent = await persistRemoteMedia(job.companyId, body.url, "video");
      await saveMediaAsset(job.companyId, { url: permanent, type: "video", source: "studio-video" });
      await completeRenderJob(jobId, permanent);
      return NextResponse.json({ ok: true, url: permanent });
    }

    if (body.status === "failed") {
      await failRenderJob(jobId, body.error || "Rendu Shotstack échoué.");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, status: body.status ?? "unknown" });
  } catch (e) {
    console.error("[webhooks/shotstack]", e);
    return NextResponse.json({ ok: true, logged: true });
  }
}
