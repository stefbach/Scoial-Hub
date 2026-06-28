/**
 * POST /api/ai/inspire-from-creative
 *
 * À partir d'une créa existante (pub ou contenu concurrent) qui performe,
 * génère PLUSIEURS propositions ORIGINALES dans l'identité de la marque.
 * Chaque proposition :
 *  - angle      : l'angle marketing retenu
 *  - postText   : texte de post prêt à publier
 *  - mediaPrompt : prompt de génération d'un visuel/vidéo original (jamais une copie)
 *
 * Inspiration only : on ne republie jamais l'asset source. Le RAG (mémoire
 * stratégique) est injecté pour ancrer les propositions dans la marque.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClaudeMessage } from "@/lib/ai/anthropic";
import { env, isAiConfigured } from "@/lib/env";

interface Body {
  companyId?: string;
  caption?: string;
  mediaType?: "image" | "video";
  platform?: "facebook" | "instagram" | "linkedin";
  origin?: string;
  source?: "ad" | "veille";
  brandVoice?: string;
  language?: string;
  count?: number;
}

interface Proposal {
  angle: string;
  postText: string;
  mediaPrompt: string;
}

function mockProposals(brandVoice: string, mediaType: "image" | "video", count: number): Proposal[] {
  const voice = brandVoice?.trim() || "professionnel et chaleureux";
  const angles = [
    { angle: "Preuve & bénéfice concret", hook: "Mettez en avant un résultat mesurable" },
    { angle: "Émotion & storytelling", hook: "Racontez une histoire client authentique" },
    { angle: "Coulisses & expertise", hook: "Montrez votre savoir-faire en coulisses" },
  ];
  return angles.slice(0, Math.max(1, Math.min(count, 3))).map((a, i) => ({
    angle: a.angle,
    postText: `Proposition ${i + 1} (ton ${voice}) — ${a.hook} pour votre audience, puis terminez par un appel à l'action engageant. ✨\n\n#Marque #Communauté`,
    mediaPrompt:
      mediaType === "video"
        ? `Vidéo courte (9:16), angle "${a.angle}" : ouverture accrocheuse, démonstration du bénéfice, incrustation de texte sobre, identité de marque cohérente.`
        : `Visuel épuré, angle "${a.angle}" : sujet central mis en valeur, palette de marque, espace pour un titre court et lisible.`,
  }));
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
      language = "",
      count = 3,
    } = body;
    const n = Math.max(1, Math.min(count, 4));

    if (!isAiConfigured) {
      return NextResponse.json({ proposals: mockProposals(brandVoice, mediaType, n), aiGenerated: false });
    }

    // RAG : ancre les propositions dans la mémoire stratégique de la marque.
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

OBJECTIF : t'INSPIRER de ce qui marche (angle, structure, accroche) pour produire ${n} propositions ORIGINALES et DISTINCTES (angles différents) dans l'identité de la marque. N'imite ni ne copie le texte ni le visuel source ; ne reprends aucune marque/logo tiers.
${language ? `\nIMPORTANT : rédige TOUT le champ "postText" (accroche, corps, appel à l'action, hashtags) intégralement en ${language}.` : ""}

Réponds STRICTEMENT en JSON (français), un tableau de ${n} objets :
{
  "proposals": [
    {
      "angle": "l'angle marketing retenu (1 ligne)",
      "postText": "un texte de post prêt à publier, adapté au réseau ${platform}, avec accroche + corps + appel à l'action + hashtags pertinents",
      "mediaPrompt": "un prompt détaillé pour générer un ${mediaType === "video" ? "visuel vidéo (décris le plan, le mouvement de caméra, l'ambiance, la lumière) SANS aucun texte/sous-titre à l'écran — le texte sera ajouté ensuite via l'éditeur" : "visuel image"} ORIGINAL (sujet, composition, ambiance, couleurs de marque), sans copier la créa source ni inclure de marque tierce"
    }
  ]
}`;

    const msg = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as { proposals?: Proposal[] };
    const proposals = (parsed.proposals ?? [])
      .filter((p) => p && (p.postText || p.mediaPrompt))
      .map((p) => ({
        angle: p.angle ?? "",
        postText: p.postText ?? "",
        mediaPrompt: p.mediaPrompt ?? "",
      }));

    if (proposals.length === 0) throw new Error("empty proposals");

    return NextResponse.json({ proposals, aiGenerated: true });
  } catch (err) {
    console.warn("[inspire-from-creative] fallback:", err);
    return NextResponse.json({ proposals: mockProposals("", "image", 3), aiGenerated: false });
  }
}
