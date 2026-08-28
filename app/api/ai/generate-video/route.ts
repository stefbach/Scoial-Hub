// ============================================================
// Route /api/ai/generate-video
//
// MiniMax Video-01 met souvent 2 à 5 min : on ne bloque pas la fonction
// serverless. Modèle asynchrone :
//   POST  → démarre la prédiction, renvoie { id, status, pending:true }
//           (ou { video } si déjà prête, ou { simulated:true } sans clé)
//   GET ?id=… → interroge le statut, renvoie { status, video?, error? }
// Le polling est fait côté client (lib/ai/generate-video-client.ts).
// ============================================================

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { startVideoPrediction, getVideoPrediction } from "@/lib/ai/replicate";
import { resolveVideoAspect } from "@/lib/social-formats";
import { getVideoModel, videoSecondsFor } from "@/lib/ai/model-catalog";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import {
  reserveVideoSeconds,
  recordVideoReservation,
  refundVideoSeconds,
} from "@/lib/quota/video-seconds";

interface RequestBody {
  prompt?: string;
  platform?: string;
  seconds?: number;
  aspect?: string;
  /** Identifiant de modèle Replicate (catalogue). Défaut : Veo 3. */
  model?: string;
  companyId?: string;
}

/**
 * Rend des secondes réservées quand aucune prédiction n'a pu être rattachée
 * (échec au lancement, mode simulé). Passe par une réservation technique
 * éphémère : la fonction de remboursement travaille par id de prédiction.
 */
async function creditBack(companyUuid: string, seconds: number): Promise<void> {
  const ref = `local:${companyUuid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await recordVideoReservation(ref, companyUuid, seconds);
  await refundVideoSeconds(ref);
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const { prompt = "", platform, aspect, seconds, model } = body;
    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const resolvedAspect = aspect ?? resolveVideoAspect(platform);

    const gm = getVideoModel(model);
    const input = gm.buildInput(prompt, { aspect: resolvedAspect, seconds });

    // ── Quota : on RÉSERVE avant de lancer quoi que ce soit ──────────────────
    // La génération vidéo est le seul poste au coût unitaire significatif du
    // produit. On décompte la durée RÉELLEMENT produite par le modèle (Veo 3
    // sort ~8 s quelle que soit la demande), pas celle demandée par l'appelant.
    const companyUuid = await resolveCompanyUuid(body.companyId ?? "");
    const billed = videoSecondsFor(gm, { seconds });
    const quota = await reserveVideoSeconds(companyUuid, billed);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.reason, quota: { used: quota.used, limit: quota.quota, remaining: quota.remaining, plan: quota.plan } },
        { status: 402 }
      );
    }

    const quotaPayload = {
      used: quota.used,
      limit: quota.quota,
      remaining: quota.remaining,
      billedSeconds: billed,
      plan: quota.plan,
    };

    let started;
    try {
      started = await startVideoPrediction({ prompt, aspect: resolvedAspect }, gm.id, input);
    } catch (e) {
      // Rien n'a démarré : les secondes réservées doivent revenir au client.
      await creditBack(companyUuid, billed);
      throw e;
    }

    if (started.simulated) {
      await creditBack(companyUuid, billed);
      return NextResponse.json({ simulated: true, aspect: resolvedAspect, platform: platform ?? null });
    }
    if (started.status === "failed" || started.status === "canceled") {
      await creditBack(companyUuid, billed);
      return NextResponse.json(
        { error: started.error || `Replicate ${started.status}` },
        { status: 500 }
      );
    }

    // Réservation rattachée à la prédiction : permet de rembourser EXACTEMENT
    // une fois si elle échoue plus tard, pendant le suivi (GET).
    if (started.id) await recordVideoReservation(started.id, companyUuid, billed);

    if (started.status === "succeeded" && started.video) {
      return NextResponse.json({
        video: started.video, aspect: resolvedAspect, platform: platform ?? null, quota: quotaPayload,
      });
    }
    // En cours → le client interrogera le statut via GET ?id=.
    return NextResponse.json({
      id: started.id,
      status: started.status,
      pending: true,
      aspect: resolvedAspect,
      platform: platform ?? null,
      quota: quotaPayload,
    });
  } catch (err) {
    console.error("[api/ai/generate-video POST] Erreur :", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors du lancement de la vidéo." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }
  try {
    const st = await getVideoPrediction(id);
    if (st.simulated) return NextResponse.json({ simulated: true });
    if (st.status === "succeeded" && st.video) {
      return NextResponse.json({ status: "succeeded", video: st.video });
    }
    if (st.status === "failed" || st.status === "canceled") {
      // La génération a échoué après avoir démarré : on rend les secondes.
      // Idempotent (clé = id de prédiction), donc un polling répété ne crédite
      // pas plusieurs fois.
      await refundVideoSeconds(id);
      return NextResponse.json({ status: st.status, error: st.error || `Replicate ${st.status}` });
    }
    return NextResponse.json({ status: st.status, pending: true });
  } catch (err) {
    console.error("[api/ai/generate-video GET] Erreur :", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors du suivi de la vidéo." },
      { status: 500 }
    );
  }
}
