// Coach de prompt visuel LinkedIn — transforme une description en langage
// naturel (« une photo lumineuse d'une équipe médicale, style éditorial ») en
// PROMPT de génération d'image optimisé (anglais, photographique, précis),
// avec 1 à 2 suggestions d'amélioration. Même plomberie IA que
// /api/ai/linkedin-article (client Anthropic + cascade de repli de modèle,
// garde d'accès société). Dégradation honnête sans clé IA (`simulated`).

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClaudeMessage } from "@/lib/ai/anthropic";
import { env, isAiConfigured } from "@/lib/env";
import { requireCompanyAccess } from "@/lib/auth/guard";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  companyId: string;
  /** Historique complet de la conversation, dernier message utilisateur inclus. */
  messages: ChatMsg[];
  /** Contexte de l'article (titre, accroche…) pour la cohérence de marque. */
  articleContext?: string;
}

const SYSTEM = `Tu es un directeur artistique senior, expert en prompts de génération d'images pour LinkedIn (photographie professionnelle et éditoriale, illustrations corporate épurées). L'utilisateur te décrit le visuel qu'il veut ; tu produis un PROMPT de génération d'image optimisé :
- en ANGLAIS, précis et photographique : sujet exact, composition, cadrage, lumière, palette sobre, ambiance, rendu (high resolution, realistic, premium editorial quality) ;
- JAMAIS de texte, logo ni watermark incrusté dans l'image (précise "no text, no logos" dans le prompt) ;
- cohérent avec le contexte de l'article s'il est fourni (sujet, ton, univers de marque).
Tes explications sont dans la langue de l'utilisateur, courtes, et incluent 1 à 2 suggestions concrètes d'amélioration (variante de cadrage, de lumière ou de style).

IMPÉRATIF DE SORTIE : réponds UNIQUEMENT par un objet JSON valide, sans bloc \`\`\`, en échappant guillemets et sauts de ligne :
{"reply":"courte explication + 1-2 suggestions d'amélioration","prompt":"le prompt d'image optimisé, en anglais"}`;

/** Réponse honnête quand l'IA n'est pas configurée (même esprit que les autres routes). */
function simulatedResponse(messages: ChatMsg[]) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  return {
    reply:
      "Démo — IA non configurée (ANTHROPIC_API_KEY). Voici un prompt générique construit à partir de votre description ; configurez la clé IA pour un vrai coaching artistique.",
    prompt: `Professional editorial photography for a LinkedIn post: ${lastUser}. Modern corporate style, natural light, sober color palette, high resolution, realistic, premium quality, no text, no logos.`,
    simulated: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const messages: ChatMsg[] = Array.isArray(body.messages)
      ? body.messages.filter(
          (m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim() !== ""
        )
      : [];
    if (!body.companyId || messages.length === 0) {
      return NextResponse.json({ error: "companyId et messages requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(body.companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    if (!isAiConfigured) return NextResponse.json(simulatedResponse(messages));

    const system = body.articleContext?.trim()
      ? `${SYSTEM}\n\nCONTEXTE DE L'ARTICLE (pour la cohérence du visuel) :\n"""${body.articleContext.trim().slice(0, 1200)}"""`
      : SYSTEM;

    const client = new Anthropic({ apiKey: env.anthropicKey });
    const res = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 700,
      temperature: 0.6,
      system,
      messages: messages.slice(-12),
    });
    const raw = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const p = JSON.parse(match[0]) as { reply?: string; prompt?: string };
        if (p.prompt?.trim()) {
          return NextResponse.json({
            reply: (p.reply ?? "").trim() || "Voici un prompt optimisé pour votre visuel.",
            prompt: p.prompt.trim(),
            aiGenerated: true,
          });
        }
      } catch {
        /* JSON invalide → texte brut ci-dessous */
      }
    }
    // Réponse non-JSON : on rend le texte tel quel, sans prétendre à un prompt.
    return NextResponse.json({
      reply: raw.trim() || "Je n'ai pas réussi à formuler un prompt. Décrivez le visuel autrement (sujet, style, lumière).",
      prompt: null,
      aiGenerated: true,
    });
  } catch (e) {
    console.error("[POST /api/ai/visual-prompt-coach]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
