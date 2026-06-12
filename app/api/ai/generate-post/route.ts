export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "@/lib/env";

type Action = "generate" | "rewrite" | "shorten" | "hashtags";
type Platform = "facebook" | "instagram" | "linkedin" | "tiktok";

interface RequestBody {
  prompt: string;
  platform: Platform;
  brandVoice: string;
  action: Action;
  /** Optional campaign/post objective, e.g. "engagement", "awareness", "conversions". */
  objective?: string;
  /** Société courante — permet d'injecter la mémoire stratégique (RAG). */
  companyId?: string;
  /**
   * RAG opt-in : la mémoire stratégique (veille/pubs/Page) n'est injectée que
   * si vrai. Par défaut on rédige librement à partir du brief de l'utilisateur.
   */
  useMemory?: boolean;
  /** Langue de diffusion imposée pour la rédaction (ex : "English", "Español"). */
  language?: string;
}

// Platform-specific constraints
const PLATFORM_RULES: Record<Platform, string> = {
  facebook: "Maximum 63,206 characters. Optimal length: 40–80 words for organic reach. Hashtags: 2–5 max, keep them subtle.",
  instagram: "Maximum 2,200 characters. Optimal length: 138–150 characters for engagement. Hashtags: 5–15 recommended, place at end or in first comment.",
  linkedin: "Maximum 3,000 characters. Optimal length: 150–300 words for professional context. Hashtags: 3–5, professional and specific.",
  tiktok: "Caption max 2,200 characters. Optimal: short punchy hook (under 150 chars) + 3-5 trending hashtags. Spoken, energetic, Gen-Z friendly tone. The VIDEO carries the message.",
};

const ACTION_INSTRUCTIONS: Record<Action, string> = {
  generate: "Generate a complete, ready-to-publish social media post based on the user's brief.",
  rewrite: "Rewrite the provided text to better match the brand voice and platform best practices, keeping the core message intact.",
  shorten: "Make the provided text shorter and punchier while preserving the key message. Remove filler, tighten phrasing.",
  hashtags: "Suggest 5–10 relevant hashtags for the provided text. Return ONLY the hashtags, one per line, starting with #. No other text.",
};

// Neutral, brand-agnostic fallbacks used when no AI key is configured.
// Built dynamically so the demo text reflects the caller's brand voice and
// objective rather than any specific (hard-coded) brand or sector.
function mockResponse(action: Action, brandVoice: string, objective?: string): string {
  const voice = brandVoice?.trim() ? brandVoice.trim() : "professionnel et chaleureux";
  const goal = objective?.trim() ? objective.trim() : "engagement";
  switch (action) {
    case "rewrite":
      return `Version retravaillée pour coller à votre voix de marque (${voice}) : un message plus clair, plus direct et fidèle à votre ton, avec un appel à l'action adapté à l'objectif « ${goal} ».`;
    case "shorten":
      return `Message condensé, ton ${voice}, sans perdre l'essentiel — clair et percutant.`;
    case "hashtags":
      return "#Marque\n#Communauté\n#Nouveauté\n#ÀLaUne\n#EnSavoirPlus\n#Tendance\n#ResteConnecté";
    case "generate":
    default:
      return `Voici une publication prête à l'emploi, dans un ton ${voice}, pensée pour l'objectif « ${goal} ». Adaptez le visuel et l'appel à l'action à votre marque, puis publiez. ✨\n\n#Marque #Communauté #ÀLaUne`;
  }
}

const SYSTEM_PROMPT = (platform: Platform, brandVoice: string, objective?: string, language?: string): string => `
You are an expert social media copywriter who adapts to any brand, sector, or campaign — never assume a specific industry, company, or product unless it is stated in the brand voice or the user's brief.

## Brand Voice
Adapt your tone to match this brand voice description: "${brandVoice}".
Be authentic, professional, and human. Never be sensationalist or alarmist.

## Objective
Optimise the copy for this campaign/post objective: "${objective ?? "engagement"}".
${objective ? "Make sure the call-to-action and framing serve that objective." : "Default to driving engagement with a clear, inviting call-to-action."}

## Platform Constraints
${PLATFORM_RULES[platform]}

## General Best Practices
1. Stay strictly on-topic with the user's brief and the stated brand voice — do not invent products, services, or claims not provided.
2. Make no unsubstantiated, guaranteed, or misleading claims about results, pricing, or outcomes.
3. Avoid fear-mongering, urgency bait, or exploiting insecurities.
4. If the brief touches a regulated sector (health, finance, legal, etc.), use measured, evidence-respecting language and avoid prohibited claims; recommend consulting a qualified professional where relevant.
5. ${language ? `Write the post ENTIRELY in ${language}, regardless of the language of the user's brief. All text, including the call-to-action and hashtags, must be in ${language}.` : "Write in the language of the user's brief (default to French if ambiguous)."}

## Output Format
Return ONLY the post text — no commentary, no "Here is your post:", no quotes wrapping the result. Just the ready-to-use content.
`.trim();

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { prompt, platform, brandVoice, action, objective, companyId, language, useMemory } = body;

    if (!prompt || !platform || !action) {
      return NextResponse.json(
        { error: "Missing required fields: prompt, platform, action" },
        { status: 400 }
      );
    }

    // Mock mode — no API key configured
    if (!isAiConfigured) {
      return NextResponse.json({
        text: mockResponse(action, brandVoice, objective),
        mock: true,
      });
    }

    const client = new Anthropic({ apiKey: env.anthropicKey });

    // RAG opt-in : injecte la mémoire stratégique (veille, pubs, Page) pour
    // fonder le contenu sur les insights accumulés, UNIQUEMENT si l'utilisateur
    // le demande (useMemory). Sinon on rédige librement à partir du brief.
    // Pertinent surtout pour generate/rewrite ; inutile pour shorten/hashtags.
    let memoryContext = "";
    if (useMemory && companyId && (action === "generate" || action === "rewrite")) {
      try {
        const { getMemoryContext } = await import("@/lib/memory");
        memoryContext = await getMemoryContext(companyId, 20);
      } catch {
        /* non bloquant */
      }
    }

    const userMessage = memoryContext
      ? `${ACTION_INSTRUCTIONS[action]}\n\n[Mémoire stratégique — insights de veille/pubs/Page à exploiter]\n${memoryContext}\n\nUser input: ${prompt}`
      : `${ACTION_INSTRUCTIONS[action]}\n\nUser input: ${prompt}`;

    const response = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system: SYSTEM_PROMPT(platform, brandVoice, objective, language),
      messages: [{ role: "user", content: userMessage }],
    });

    const firstContent = response.content[0];
    if (firstContent.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return NextResponse.json({ text: firstContent.text });
  } catch (err) {
    console.error("[ai/generate-post] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate content. Please try again." },
      { status: 500 }
    );
  }
}
