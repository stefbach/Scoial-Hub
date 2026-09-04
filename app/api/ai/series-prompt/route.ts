// Génère un PROMPT éditable à partir de mots-clés ou d'un texte, pour une
// plateforme de série (Facebook, Instagram, Twitter, Pinterest, TikTok) ou pour
// Composer ("compose"). Même principe que le mode "prompt" de
// /api/ai/linkedin-article, généralisé via lib/social-series (SERIES_CONFIG) :
// l'utilisateur peut relire/éditer ce prompt AVANT de lancer la génération
// finale (/api/ai/social-series ou l'agent Composer).

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClaudeMessage } from "@/lib/ai/anthropic";
import { env, isAiConfigured } from "@/lib/env";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMemoryContext } from "@/lib/memory";
import { resolvePublishLanguageName } from "@/lib/publish-languages";
import { SERIES_CONFIG, isSeriesPlatform } from "@/lib/social-series";

interface Body {
  companyId?: string;
  /** Plateforme série connue, ou "compose" pour le quick-start multi-réseaux. */
  platform?: string;
  /** "keywords" | "text" : nature de l'entrée. */
  source?: "keywords" | "text";
  input?: string;
  tone?: string;
  language?: string;
  useMemory?: boolean;
}

function targetLabel(platform: string): string {
  if (isSeriesPlatform(platform)) return SERIES_CONFIG[platform].label;
  return "Facebook, Instagram et TikTok";
}

function formatGuide(platform: string): string {
  if (isSeriesPlatform(platform)) {
    const cfg = SERIES_CONFIG[platform];
    return `Format : publications ${cfg.label}, chacune sous ${cfg.maxChars} caractères, ${cfg.media === "video" ? "pensées pour être illustrées par une courte vidéo" : cfg.media === "image" ? "accompagnées d'un visuel" : "avec un visuel optionnel"}.`;
  }
  return "Format : un contenu unique décliné et adapté à Facebook, Instagram et TikTok (ton et longueur ajustés à chaque réseau).";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const companyId = body.companyId;
    const platform = body.platform ?? "";
    const input = (body.input ?? "").trim();
    if (!companyId || !input || (!isSeriesPlatform(platform) && platform !== "compose")) {
      return NextResponse.json(
        { error: "companyId, une plateforme valide et un contenu sont requis" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const sourceLabel = body.source === "text" ? "ce texte" : "ces mots-clés";
    const lang = resolvePublishLanguageName(body.language ?? "fr");

    let memory = "";
    if (body.useMemory) {
      memory = await getMemoryContext(companyId, 10).catch(() => "");
    }

    const params = [
      body.tone ? `Ton souhaité : ${body.tone}` : "",
      formatGuide(platform),
      `Langue de sortie : ${lang}`,
    ].filter(Boolean).join("\n");

    if (!isAiConfigured) {
      return NextResponse.json({
        prompt: [
          `Rédige un contenu ${targetLabel(platform)} de qualité à partir de ${sourceLabel} :`,
          `"""${input}"""`,
          params,
          "",
          "Exigences : accroche forte, une idée par paragraphe, exemples concrets, appel à l'action clair, hashtags pertinents.",
        ].join("\n"),
        aiGenerated: false,
      });
    }

    const meta = `Tu es un expert en stratégie de contenu ${targetLabel(platform)}. À partir des éléments ci-dessous, RÉDIGE UN PROMPT (un brief de rédaction) clair, détaillé et professionnel qui servira ensuite à générer le contenu. Le SUJET imposé par l'utilisateur est prioritaire : le prompt doit porter exactement sur ce sujet, sans le détourner vers d'autres thèmes.

ENTRÉE (${sourceLabel}) :
"""${input}"""
${memory ? `\nMémoire stratégique :\n${memory}\n` : ""}
PARAMÈTRES :
${params}

Le prompt que tu produis doit préciser : l'objectif éditorial, l'angle unique, le public visé, le ton, la structure attendue, les preuves/exemples à mobiliser, les écueils à éviter, et le style adapté à ${targetLabel(platform)}. Réponds UNIQUEMENT par le texte du prompt.`;

    try {
      const client = new Anthropic({ apiKey: env.anthropicKey });
      const res = await createClaudeMessage(client, {
        model: env.anthropicModel,
        max_tokens: 700,
        messages: [{ role: "user", content: meta }],
      });
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();
      return NextResponse.json({ prompt: text || "(prompt vide)", aiGenerated: true });
    } catch {
      return NextResponse.json({ prompt: "(échec de génération du prompt — réessayez)", aiGenerated: false });
    }
  } catch (e) {
    console.error("[POST /api/ai/series-prompt]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
