/**
 * POST /api/ai/inspire-from-creative
 *
 * À partir d'une créa existante (pub ou contenu concurrent) qui performe,
 * génère une NOUVELLE proposition ORIGINALE dans l'identité de la marque :
 *  - postText   : texte de post prêt à publier
 *  - mediaPrompt : prompt de génération d'un visuel/vidéo original (jamais une copie)
 *  - angle      : l'angle marketing retenu
 *
 * Inspiration only : on ne republie jamais l'asset source. Le RAG (mémoire
 * stratégique) est injecté pour ancrer la proposition dans la marque.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "@/lib/env";

interface Body {
  companyId?: string;
  caption?: string;
  mediaType?: "image" | "video";
  platform?: "facebook" | "instagram" | "linkedin";
  origin?: string;
  source?: "ad" | "veille";
  brandVoice?: string;
}

function mockResult(brandVoice: string, mediaType: "image" | "video") {
  const voice = brandVoice?.trim() || "professionnel et chaleureux";
  return {
    angle: "Preuve & bénéfice concret",
    postText: `Voici une proposition de post inspirée d'une créa performante, réécrite dans votre ton (${voice}). Mettez en avant un bénéfice clair pour votre audience et terminez par un appel à l'action engageant. ✨\n\n#Marque #Communauté`,
    mediaPrompt:
      mediaType === "video"
        ? "Vidéo courte (9:16) : plan d'ouverture accrocheur, démonstration du bénéfice en 3 temps, incrustation de texte sobre, identité de marque cohérente."
        : "Visuel carré épuré, sujet central mis en valeur, palette de marque, espace pour un titre court et lisible.",
    aiGenerated: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const {
      companyId,
      caption = "",
      mediaType = "image",
      platform = "instagram",
      origin = "",
      source = "ad",
      brandVoice = "",
    } = body;

    if (!isAiConfigured) {
      return NextResponse.json(mockResult(brandVoice, mediaType));
    }

    // RAG : ancre la proposition dans la mémoire stratégique de la marque.
    let memoryContext = "";
    if (companyId) {
      try {
        const { getMemoryContext } = await import("@/lib/memory");
        memoryContext = await getMemoryContext(companyId, 15);
      } catch {
        /* non bloquant */
      }
    }

    const client = new Anthropic({ apiKey: env.anthropicKey });

    const sourceLabel = source === "ad" ? "une publicité" : "un contenu organique concurrent";
    const prompt = `Tu es directeur créatif social media. On te montre ${sourceLabel} qui PERFORME (origine : ${origin || "inconnue"}, réseau cible : ${platform}, média : ${mediaType}).

Légende / texte de la créa source :
"""
${caption.slice(0, 800)}
"""

${brandVoice ? `Voix de marque : "${brandVoice}".` : ""}
${memoryContext ? `\n[Mémoire stratégique de la marque — à exploiter]\n${memoryContext}\n` : ""}

OBJECTIF : t'INSPIRER de ce qui marche (angle, structure, accroche) pour produire une proposition ORIGINALE dans l'identité de la marque. N'imite ni ne copie le texte ni le visuel source ; ne reprends aucune marque/logo tiers.

Réponds STRICTEMENT en JSON (français) :
{
  "angle": "l'angle marketing retenu (1 ligne)",
  "postText": "un texte de post prêt à publier, adapté au réseau ${platform}, avec accroche + corps + appel à l'action + hashtags pertinents",
  "mediaPrompt": "un prompt détaillé pour générer un ${mediaType === "video" ? "script/visuel vidéo" : "visuel image"} ORIGINAL (sujet, composition, ambiance, couleurs de marque), sans copier la créa source ni inclure de marque tierce"
}`;

    const msg = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as {
      angle?: string;
      postText?: string;
      mediaPrompt?: string;
    };

    return NextResponse.json({
      angle: parsed.angle ?? "",
      postText: parsed.postText ?? "",
      mediaPrompt: parsed.mediaPrompt ?? "",
      aiGenerated: true,
    });
  } catch (err) {
    console.warn("[inspire-from-creative] fallback:", err);
    return NextResponse.json(mockResult("", "image"));
  }
}
