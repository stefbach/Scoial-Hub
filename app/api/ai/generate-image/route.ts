// ============================================================
// Route POST /api/ai/generate-image
// Délègue la génération à lib/ai/replicate.ts.
// Dégradation gracieuse : si REPLICATE_API_TOKEN est absent,
// retourne { images: [], simulated: true } sans appel réseau.
// ============================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/ai/replicate";
import { resolveImageAspect } from "@/lib/social-formats";

interface RequestBody {
  prompt?: string;
  /** Réseau cible (réceptacle) : facebook | instagram | linkedin | tiktok. */
  platform?: string;
  /** Placement : feed | story | reel | cover (optionnel). */
  placement?: string;
  /** Format/ratio explicite — prioritaire sur platform si fourni. */
  format?: string;
  /** Nombre d'images souhaitées (1–4). */
  n?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const { prompt = "", platform, placement, format, n } = body;

    // Le format suit le réceptacle si non explicite (bons ratios par réseau).
    const resolvedFormat = format ?? resolveImageAspect(platform, placement);

    const result = await generateImage({ prompt, format: resolvedFormat, n });
    return NextResponse.json({ ...result, format: resolvedFormat, platform: platform ?? null });
  } catch (err) {
    console.error("[api/ai/generate-image] Erreur :", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erreur lors de la génération d'image.",
      },
      { status: 500 }
    );
  }
}
