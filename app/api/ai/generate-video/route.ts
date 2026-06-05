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

interface RequestBody {
  prompt?: string;
  platform?: string;
  seconds?: number;
  aspect?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const { prompt = "", platform, aspect } = body;
    const resolvedAspect = aspect ?? resolveVideoAspect(platform);

    const started = await startVideoPrediction({ prompt, aspect: resolvedAspect });

    if (started.simulated) {
      return NextResponse.json({ simulated: true, aspect: resolvedAspect, platform: platform ?? null });
    }
    if (started.status === "succeeded" && started.video) {
      return NextResponse.json({ video: started.video, aspect: resolvedAspect, platform: platform ?? null });
    }
    if (started.status === "failed" || started.status === "canceled") {
      return NextResponse.json(
        { error: started.error || `Replicate ${started.status}` },
        { status: 500 }
      );
    }
    // En cours → le client interrogera le statut via GET ?id=.
    return NextResponse.json({
      id: started.id,
      status: started.status,
      pending: true,
      aspect: resolvedAspect,
      platform: platform ?? null,
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
