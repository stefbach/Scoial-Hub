// POST /api/webhooks/replicate?job=<jobId>&secret=<WEBHOOK_SECRET>
//
// Appelé par Replicate à la complétion d'une prédiction (rendu avatar/vidéo).
// Persiste le média final côté serveur et finalise le job — ainsi le résultat
// est enregistré dans la bibliothèque MÊME si l'utilisateur a fermé l'onglet.
// Idempotent : un job déjà 'done' n'est pas re-traité.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getRenderJob, completeRenderJob, failRenderJob } from "@/lib/jobs/render-jobs";
import { persistRemoteMedia, saveMediaAsset } from "@/lib/repositories/media";

/** Première URL exploitable d'une sortie Replicate (string | string[] | {output}). */
function firstUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    for (const o of output) { const u = firstUrl(o); if (u) return u; }
    return null;
  }
  if (output && typeof output === "object") {
    const o = output as { url?: unknown; output?: unknown };
    if (typeof o.url === "string") return o.url;
    if (o.output !== undefined) return firstUrl(o.output);
  }
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth : secret partagé (query) — Replicate ne signe pas par défaut.
  const secret = req.nextUrl.searchParams.get("secret") ?? "";
  if (!env.webhookSecret || secret !== env.webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobId = req.nextUrl.searchParams.get("job") ?? "";
  if (!jobId) return NextResponse.json({ error: "job requis" }, { status: 400 });

  // Toujours répondre 200 à Replicate (sinon il retente en boucle) — on
  // journalise les soucis sans renvoyer d'erreur.
  try {
    const job = await getRenderJob(jobId);
    if (!job) return NextResponse.json({ ok: true, ignored: "job introuvable" });
    if (job.status === "done") return NextResponse.json({ ok: true, idempotent: true });

    const body = (await req.json().catch(() => ({}))) as { status?: string; output?: unknown; error?: unknown };

    if (body.status === "succeeded") {
      const url = firstUrl(body.output);
      if (!url) { await failRenderJob(jobId, "Aucune sortie dans le webhook."); return NextResponse.json({ ok: true }); }
      // URL Replicate éphémère → on l'héberge durablement puis on l'enregistre.
      const permanent = await persistRemoteMedia(job.companyId, url, "video");
      await saveMediaAsset(job.companyId, { url: permanent, type: "video", source: `studio-${job.kind}` });
      await completeRenderJob(jobId, permanent);
      return NextResponse.json({ ok: true, url: permanent });
    }

    if (body.status === "failed" || body.status === "canceled") {
      await failRenderJob(jobId, typeof body.error === "string" ? body.error : "Rendu échoué.");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, status: body.status ?? "unknown" });
  } catch (e) {
    console.error("[webhooks/replicate]", e);
    return NextResponse.json({ ok: true, logged: true }); // 200 pour éviter les retries en boucle
  }
}
