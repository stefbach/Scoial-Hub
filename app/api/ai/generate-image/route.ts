// ============================================================
// Route POST /api/ai/generate-image
// Délègue la génération à lib/ai/replicate.ts.
// Dégradation gracieuse : si REPLICATE_API_TOKEN est absent,
// retourne { images: [], simulated: true } sans appel réseau.
// ============================================================

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { generateImageModel } from "@/lib/ai/replicate";
import { resolveImageAspect } from "@/lib/social-formats";
import { getImageModel, DEFAULT_IMAGE_MODEL_ID } from "@/lib/ai/model-catalog";

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
  /** Identifiant de modèle Replicate (catalogue). Défaut : Flux 1.1 Pro. */
  model?: string;
}

// Modèles de repli si le modèle demandé échoue (crédits, sécurité, rate-limit,
// indisponibilité). On tente le modèle choisi puis ces alternatives fiables
// jusqu'à obtenir au moins une image.
const FALLBACK_IMAGE_MODELS = [
  DEFAULT_IMAGE_MODEL_ID,
  "black-forest-labs/flux-schnell",
  "google/imagen-4",
  "stability-ai/stable-diffusion-3.5-large",
];

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const { prompt = "", platform, placement, format, n, model } = body;

    if (!prompt.trim()) {
      return NextResponse.json({ error: "Prompt requis pour générer une image." }, { status: 400 });
    }

    // Le format suit le réceptacle si non explicite (bons ratios par réseau).
    const resolvedFormat = format ?? resolveImageAspect(platform, placement);

    // Chaîne de modèles à essayer dans l'ordre (modèle demandé d'abord).
    const order = Array.from(new Set([model, ...FALLBACK_IMAGE_MODELS].filter(Boolean))) as string[];

    let lastError: unknown;
    for (const id of order) {
      const gm = getImageModel(id);
      try {
        const input = gm.buildInput(prompt, { aspect: resolvedFormat });
        const result = await generateImageModel(gm.id, input, n ?? 1);
        if (result.images.length > 0 || result.simulated) {
          return NextResponse.json({
            ...result,
            format: resolvedFormat,
            platform: platform ?? null,
            // Indique si on a dû basculer sur un modèle de repli.
            fallbackUsed: gm.id !== (model ?? DEFAULT_IMAGE_MODEL_ID) ? gm.id : undefined,
          });
        }
      } catch (e) {
        lastError = e;
        // Throttling (429) : limite globale du compte Replicate → changer de
        // modèle n'aide pas et aggrave le throttle. On arrête et on remonte.
        const msg = e instanceof Error ? e.message : String(e);
        if (/débit Replicate|429|throttl/i.test(msg)) break;
        console.warn(`[api/ai/generate-image] modèle ${gm.id} a échoué, repli…`, msg);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Aucun modèle n'a pu générer d'image.");
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
