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
import { startHiggsfieldVideo, getHiggsfieldVideo } from "@/lib/ai/higgsfield";
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
  /**
   * Lève le verrou « meilleur rapport qualité/prix » sur Facebook/Instagram/
   * LinkedIn — réservé à Studio Créatif et Compose. PAS ENCORE vérifié contre
   * une autorisation réelle (habilitation par plan/rôle à brancher plus tard) :
   * accepté tel quel pour l'instant, cf. lib/ai/model-catalog.ts.
   */
  allowPremiumVideo?: boolean;
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
    const { prompt = "", platform, aspect, seconds, model, allowPremiumVideo } = body;
    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const resolvedAspect = aspect ?? resolveVideoAspect(platform);

    const gm = getVideoModel(model, platform, { allowPremium: allowPremiumVideo });
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

    const usesHiggsfield = gm.provider === "higgsfield";

    let started;
    try {
      started = usesHiggsfield
        ? await startHiggsfieldVideo(gm.path ?? "", input)
        : await startVideoPrediction({ prompt, aspect: resolvedAspect }, gm.id, input);
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
        { error: started.error || `${usesHiggsfield ? "Higgsfield" : "Replicate"} ${started.status}` },
        { status: 500 }
      );
    }

    // Préfixe "hf:" : distingue un id de requête Higgsfield d'une prédiction
    // Replicate pour que GET sache quel fournisseur interroger — le seul état
    // transmis au client entre les deux appels est cet id.
    const publicId = started.id ? (usesHiggsfield ? `hf:${started.id}` : started.id) : undefined;

    // Réservation rattachée à l'id public : permet de rembourser EXACTEMENT
    // une fois si elle échoue plus tard, pendant le suivi (GET).
    if (publicId) await recordVideoReservation(publicId, companyUuid, billed);

    if (started.status === "succeeded" && started.video) {
      // Rapatrie l'URL éphémère Replicate vers notre stockage — comme pour
      // l'image (generate-image, edit-image, avatar) : sans ça, le clip reste
      // référencé par une adresse fournisseur qui peut expirer avant que le
      // Studio Créatif ne le rende (Shotstack échoue alors en « média
      // introuvable »). Dégradation gracieuse : renvoie l'URL d'origine en cas
      // d'échec de la persistance.
      const { persistRemoteMedia } = await import("@/lib/repositories/media");
      const url = await persistRemoteMedia(body.companyId ?? "", started.video.url, "video");
      return NextResponse.json({
        video: { url }, aspect: resolvedAspect, platform: platform ?? null, quota: quotaPayload,
      });
    }
    // En cours → le client interrogera le statut via GET ?id=.
    return NextResponse.json({
      id: publicId,
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
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }
  try {
    // Préfixe "hf:" posé par le POST (cf. plus haut) : distingue une requête
    // Higgsfield d'une prédiction Replicate — l'id public transmis au client
    // est la seule information dont on dispose ici pour choisir le fournisseur.
    const isHiggsfield = id.startsWith("hf:");
    const st = isHiggsfield ? await getHiggsfieldVideo(id.slice(3)) : await getVideoPrediction(id);
    if (st.simulated) return NextResponse.json({ simulated: true });
    if (st.status === "succeeded" && st.video) {
      // Même rapatriement que ci-dessus (POST), pour le cas — le plus courant —
      // où la vidéo n'est prête qu'au bout du polling.
      const { persistRemoteMedia } = await import("@/lib/repositories/media");
      const url = await persistRemoteMedia(companyId, st.video.url, "video");
      return NextResponse.json({ status: "succeeded", video: { url } });
    }
    if (st.status === "failed" || st.status === "canceled") {
      // La génération a échoué après avoir démarré : on rend les secondes.
      // Idempotent (clé = id public), donc un polling répété ne crédite pas
      // plusieurs fois.
      await refundVideoSeconds(id);
      return NextResponse.json({ status: st.status, error: st.error || `${isHiggsfield ? "Higgsfield" : "Replicate"} ${st.status}` });
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
