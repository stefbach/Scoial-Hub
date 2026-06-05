// ============================================================
// Route POST /api/ai/generate-video
// Délègue la génération à lib/ai/replicate.ts.
// Dégradation gracieuse : si REPLICATE_API_TOKEN est absent,
// retourne { simulated: true } sans appel réseau.
// ============================================================

export const runtime = "nodejs";
// MiniMax Video-01 peut dépasser 60 s ; on laisse jusqu'à 300 s (plafonné
// automatiquement selon le plan Vercel).
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { generateVideo } from "@/lib/ai/replicate";
import { resolveVideoAspect } from "@/lib/social-formats";

interface RequestBody {
  prompt?: string;
  /** Réseau cible (réceptacle) : tiktok/instagram → 9:16, facebook/linkedin → 16:9. */
  platform?: string;
  /** Durée souhaitée en secondes (5 ou 6). */
  seconds?: number;
  /** Ratio d'aspect explicite — prioritaire sur platform. */
  aspect?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const { prompt = "", platform, seconds, aspect } = body;

    const resolvedAspect = aspect ?? resolveVideoAspect(platform);

    const result = await generateVideo({ prompt, seconds, aspect: resolvedAspect });
    return NextResponse.json({ ...result, aspect: resolvedAspect, platform: platform ?? null });
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
