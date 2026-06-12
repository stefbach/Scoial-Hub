// POST /api/ai/generate-audio  { companyId, kind: "music"|"voice", model?, prompt, seconds? }
// Génère de la musique (description → musique) ou de la voix (texte → parole)
// via Replicate. Dégradation gracieuse si REPLICATE_API_TOKEN absent.

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { runReplicateUrl, isReplicateConfigured } from "@/lib/ai/replicate";
import {
  MUSIC_MODELS, VOICE_MODELS, getAudioModel,
  DEFAULT_MUSIC_MODEL_ID, DEFAULT_VOICE_MODEL_ID,
} from "@/lib/ai/model-catalog";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      kind?: "music" | "voice";
      model?: string;
      prompt?: string;
      seconds?: number;
      voice?: string;
    };
    const { companyId, kind = "music", prompt, seconds } = body;
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!prompt?.trim()) {
      return NextResponse.json({ error: kind === "voice" ? "Texte requis" : "Description musicale requise" }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    if (!isReplicateConfigured) {
      return NextResponse.json({ simulated: true, message: "Génération audio non configurée (REPLICATE_API_TOKEN)." });
    }

    // Modèle : on valide qu'il appartient bien à la catégorie demandée.
    const pool = kind === "voice" ? VOICE_MODELS : MUSIC_MODELS;
    const fallback = kind === "voice" ? DEFAULT_VOICE_MODEL_ID : DEFAULT_MUSIC_MODEL_ID;
    const modelId = pool.some((m) => m.id === body.model) ? body.model! : fallback;
    const model = getAudioModel(modelId);

    const input = model.buildInput(prompt.trim(), { seconds, voice: body.voice });
    const url = await runReplicateUrl(modelId, input);
    if (!url) {
      return NextResponse.json({ error: "Aucun audio renvoyé par le modèle. Réessayez." }, { status: 502 });
    }
    return NextResponse.json({ url, model: modelId, kind });
  } catch (e) {
    console.error("[POST /api/ai/generate-audio]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
