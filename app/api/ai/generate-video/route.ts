// ============================================================
// Route POST /api/ai/generate-video
// Délègue la génération à lib/ai/replicate.ts.
// Dégradation gracieuse : si REPLICATE_API_TOKEN est absent,
// retourne { simulated: true } sans appel réseau.
// ============================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateVideo } from "@/lib/ai/replicate";

interface RequestBody {
  prompt?: string;
  /** Durée souhaitée en secondes (5 ou 6). */
  seconds?: number;
  /** Ratio d'aspect : "9:16" (Reels, défaut), "16:9", "1:1". */
  aspect?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const { prompt = "", seconds, aspect } = body;

    const result = await generateVideo({ prompt, seconds, aspect });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/ai/generate-video] Erreur :", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erreur lors de la génération de vidéo.",
      },
      { status: 500 }
    );
  }
}
