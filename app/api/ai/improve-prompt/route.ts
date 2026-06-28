// ============================================================
// Route POST /api/ai/improve-prompt
// Réécrit une idée courte en un prompt de génération visuelle riche
// et prêt pour la production (image ou vidéo), via Claude.
// Dégradation gracieuse : si l'IA n'est pas configurée ou en cas
// d'erreur, retourne le prompt d'origine sans jamais throw.
// ============================================================

export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAiConfigured, env } from "@/lib/env";

interface RequestBody {
  prompt?: string;
  kind?: "image" | "video";
  brandVoice?: string;
}

/** Construit l'instruction envoyée à Claude. */
function buildPrompt(idea: string, kind: "image" | "video", brandVoice?: string): string {
  const media = kind === "video" ? "vidéo courte" : "image";
  const motion =
    kind === "video"
      ? "\n- Mouvement de caméra et action (travelling, plan fixe, dynamique du sujet, rythme)."
      : "";
  const voiceLine = brandVoice
    ? `\nVoix de marque à respecter (ambiance, ton visuel) : ${brandVoice}`
    : "";

  return `Tu es un directeur artistique expert en génération d'images et de vidéos par IA.
À partir de l'idée brute ci-dessous, écris UN SEUL prompt de génération ${media} riche, précis et prêt pour la production.

Idée brute du client :
"""
${idea}
"""${voiceLine}

Le prompt final doit décrire avec précision :
- Le sujet principal et son contexte.
- La composition et le cadrage (angle, plan, premier plan / arrière-plan).
- La lumière (direction, intensité, ambiance — golden hour, studio, contre-jour…).
- Le style visuel (photoréaliste, illustration, 3D, cinématique…).
- L'ambiance / l'émotion.
- La palette de couleurs.${motion}

Règles :
- Réponds UNIQUEMENT avec le prompt final, en un seul paragraphe fluide, sans titre, sans listes, sans guillemets, sans préambule.
- Reste dans l'esprit et le sujet de l'idée du client (ne change pas le concept).
- Privilégie la même langue que l'idée d'origine.`;
}

export async function POST(req: NextRequest) {
  const body: RequestBody = await req.json().catch(() => ({}));
  const original = (body.prompt ?? "").trim();
  const kind: "image" | "video" = body.kind === "video" ? "video" : "image";

  // Rien à améliorer, ou IA non configurée → on renvoie l'original.
  if (!original || !isAiConfigured) {
    return NextResponse.json({ prompt: original });
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const { createClaudeMessage } = await import("@/lib/ai/anthropic");
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const message = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 400,
      messages: [
        { role: "user", content: buildPrompt(original, kind, body.brandVoice) },
      ],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    // En cas de réponse vide, on retombe sur l'original.
    return NextResponse.json({ prompt: text || original });
  } catch (err) {
    console.warn("[api/ai/improve-prompt] Claude failed, fallback:", err);
    return NextResponse.json({ prompt: original });
  }
}
