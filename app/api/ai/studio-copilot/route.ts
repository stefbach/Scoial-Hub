// POST /api/ai/studio-copilot { companyId, studio, goal, history?, language?, currentPrompt? }
// Copilote créatif (LLM) des studios : comprend l'intention de l'utilisateur,
// rédige un PROMPT de génération optimal (premium, détaillé), recommande le
// MEILLEUR modèle Replicate de la catégorie, le format/durée, et donne des
// conseils. Renvoie des actions applicables en un clic dans le studio.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";
import {
  IMAGE_MODELS, EDIT_MODELS, UPSCALE_MODELS, VIDEO_MODELS, MUSIC_MODELS, VOICE_MODELS, type GenModel,
} from "@/lib/ai/model-catalog";

type Studio = "affiche" | "avatar" | "video";

interface CopilotResult {
  reply?: string;
  prompt?: string;          // prompt de génération prêt à l'emploi (EN pour image/vidéo)
  modelId?: string;         // id de modèle recommandé (depuis la liste fournie)
  category?: "image" | "edit" | "upscale" | "video" | "music" | "voice";
  aspect?: string;          // 1:1 | 4:5 | 16:9 | 9:16
  seconds?: number;         // pour vidéo/audio
  script?: string;          // pour avatar : script parlé
  tips?: string[];
}

/** Modèles pertinents selon le studio (le copilote choisit parmi ceux-ci). */
function modelsFor(studio: Studio): { category: string; models: GenModel[] }[] {
  if (studio === "video") {
    return [
      { category: "video", models: VIDEO_MODELS },
      { category: "image", models: IMAGE_MODELS },
      { category: "music", models: MUSIC_MODELS },
      { category: "voice", models: VOICE_MODELS },
    ];
  }
  if (studio === "avatar") {
    return [
      { category: "image", models: IMAGE_MODELS },
      { category: "voice", models: VOICE_MODELS },
      { category: "edit", models: EDIT_MODELS },
    ];
  }
  // affiche
  return [
    { category: "image", models: IMAGE_MODELS },
    { category: "edit", models: EDIT_MODELS },
    { category: "upscale", models: UPSCALE_MODELS },
  ];
}

const STUDIO_DESC: Record<Studio, string> = {
  affiche: "Studio Affiches & Visuels : affiches print (A4/A3) et visuels réseaux (image fixe).",
  avatar: "Studio Avatar : portrait + script parlé + voix → vidéo d'avatar qui parle.",
  video: "Studio Créatif vidéo : génération et montage de vidéos courtes social media (et musique/voix off).",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      studio?: Studio;
      goal?: string;
      currentPrompt?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      language?: "fr" | "en";
    };
    const companyId = body.companyId;
    const studio = (body.studio ?? "affiche") as Studio;
    const goal = (body.goal ?? "").trim();
    const lang = body.language === "en" ? "en" : "fr";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!goal) return NextResponse.json({ error: "goal requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    if (!isAiConfigured) {
      return NextResponse.json({ error: "IA non configurée (ANTHROPIC_API_KEY)." }, { status: 503 });
    }

    const groups = modelsFor(studio);
    const catalogText = groups.map((g) =>
      `• ${g.category} :\n` + g.models.map((m) => `   - ${m.id} — ${m.label}${m.note ? ` (${m.note})` : ""}`).join("\n")
    ).join("\n");

    const histText = (body.history ?? []).slice(-6)
      .map((m) => `${m.role === "user" ? "UTILISATEUR" : "COPILOTE"} : ${m.content}`).join("\n");

    const prompt = `# RÔLE
Tu es le COPILOTE CRÉATIF d'un studio de production de contenu, niveau directeur artistique international. Tu transformes l'intention de l'utilisateur en ACTIONS concrètes et de qualité professionnelle pour le studio.

# STUDIO ACTIF
${STUDIO_DESC[studio]}

# MODÈLES DISPONIBLES (choisis le meilleur "modelId" EXACTEMENT dans cette liste)
${catalogText}

${histText ? `# CONVERSATION\n${histText}\n` : ""}
# DEMANDE DE L'UTILISATEUR
${goal}
${body.currentPrompt ? `\n# PROMPT ACTUEL DANS LE STUDIO\n${body.currentPrompt}` : ""}

# CE QUE TU PRODUIS
1. "reply" : une réponse courte, humaine et utile (langue : ${lang === "en" ? "anglais" : "français"}), qui explique ton choix en 1-3 phrases.
2. "prompt" : un PROMPT de génération prêt à l'emploi — pour les modèles d'IMAGE/VIDÉO, écris-le EN ANGLAIS, très détaillé et premium (sujet, composition, cadrage, lumière, style, ambiance, rendu HD), SANS texte incrusté sauf si explicitement demandé. Pour la MUSIQUE, décris genre/instruments/tempo/ambiance. Pour la VOIX, "prompt" = le texte à dire.
3. "category" : la catégorie d'action (image | edit | upscale | video | music | voice).
4. "modelId" : l'id EXACT du meilleur modèle de la liste pour cette demande.
5. "aspect" : 1:1, 4:5, 16:9 ou 9:16 selon l'usage.
6. "seconds" : durée si vidéo (5-10) ou audio (10-30).
7. ${studio === "avatar" ? `"script" : un script parlé naturel et concis pour l'avatar (langue ${lang === "en" ? "anglaise" : "française"}).` : `(pas de script)`}
8. "tips" : 1 à 3 conseils brefs et actionnables pour améliorer le résultat.

# FORMAT — STRICTEMENT du JSON, sans texte autour :
{"reply":"","prompt":"","category":"","modelId":"","aspect":"","seconds":0,"script":"","tips":[]}`;

    const result = await callClaudeJSON<CopilotResult>(prompt, { model: "claude-sonnet-4-6", maxTokens: 1400, temperature: 0.6 });
    if (!result) {
      return NextResponse.json({ error: "Le copilote n'a pas pu répondre. Réessayez." }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/ai/studio-copilot]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
