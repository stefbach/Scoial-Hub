export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "@/lib/env";

type Action = "generate" | "rewrite" | "shorten" | "hashtags";
type Platform = "facebook" | "instagram" | "linkedin";

interface RequestBody {
  prompt: string;
  platform: Platform;
  brandVoice: string;
  action: Action;
}

// Platform-specific constraints
const PLATFORM_RULES: Record<Platform, string> = {
  facebook: "Maximum 63,206 characters. Optimal length: 40–80 words for organic reach. Hashtags: 2–5 max, keep them subtle.",
  instagram: "Maximum 2,200 characters. Optimal length: 138–150 characters for engagement. Hashtags: 5–15 recommended, place at end or in first comment.",
  linkedin: "Maximum 3,000 characters. Optimal length: 150–300 words for professional context. Hashtags: 3–5, professional and specific.",
};

const ACTION_INSTRUCTIONS: Record<Action, string> = {
  generate: "Generate a complete, ready-to-publish social media post based on the user's brief.",
  rewrite: "Rewrite the provided text to better match the brand voice and platform best practices, keeping the core message intact.",
  shorten: "Make the provided text shorter and punchier while preserving the key message. Remove filler, tighten phrasing.",
  hashtags: "Suggest 5–10 relevant hashtags for the provided text. Return ONLY the hashtags, one per line, starting with #. No other text.",
};

// Mock contextualised examples per action
const MOCK_RESPONSES: Record<Action, string> = {
  generate:
    "Prendre soin de sa santé, c'est un geste quotidien. Nos équipes médicales sont là pour vous accompagner avec bienveillance et expertise — en consultation ou en téléconsultation. Prenez rendez-vous dès aujourd'hui. 🩺\n\n#SantéAccessible #Téléconsultation #MédecineGénérale",
  rewrite:
    "Votre santé mérite une attention professionnelle et bienveillante. Consultez nos spécialistes depuis chez vous ou en cabinet — facilement, rapidement, en toute confidentialité.",
  shorten:
    "Santé et bien-être à portée de clic. Consultez nos équipes médicales en téléconsultation dès maintenant.",
  hashtags:
    "#Santé\n#Téléconsultation\n#MédecineEnLigne\n#BienEtre\n#ConsultationMédicale\n#SantéNumérique\n#MedecinEnLigne",
};

const SYSTEM_PROMPT = (platform: Platform, brandVoice: string): string => `
You are an expert social media copywriter for a medical and healthcare brand group (DDS Group), which operates three brands: Obesity Care Clinic, Tibok téléconsultation, and Cabo Verde Medical International.

## Brand Voice
Adapt your tone to match this brand voice description: "${brandVoice}".
Always be warm, professional, and human. Never be sensationalist or alarmist.

## Platform Constraints
${PLATFORM_RULES[platform]}

## Healthcare Compliance — MANDATORY RULES (CRITICAL — never violate these)
1. NO unsubstantiated medical claims: Do not assert that a product or service cures, treats, or prevents any disease unless backed by referenced clinical evidence.
2. NO guaranteed results: Phrases like "you will lose X kg", "guaranteed results", "permanent cure" are strictly forbidden.
3. NO before/after implications: Do not imply dramatic physical transformation as a guaranteed outcome.
4. NO alarmist language: Avoid fear-mongering, urgency bait, or exploiting insecurities (e.g., "you are at risk", "don't wait until it's too late" as a scare tactic).
5. NO targeting by health condition: Do not address content specifically to people "suffering from" a condition in a way that could be used for discriminatory ad targeting.
6. NO misleading pricing or access claims: Do not imply services are free when they are not, or overstate coverage.
7. USE measured, evidence-respecting language: Prefer "may help", "supports", "consult a healthcare professional", "evidence-based approach", "our team is here to support you".
8. ALWAYS recommend consulting a healthcare professional for medical decisions.
9. Regulatory alignment: Content must be compatible with French health advertising regulations (ANSM guidelines) and Meta health ad policies.

## Output Format
Return ONLY the post text — no commentary, no "Here is your post:", no quotes wrapping the result. Just the ready-to-use content.
`.trim();

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { prompt, platform, brandVoice, action } = body;

    if (!prompt || !platform || !action) {
      return NextResponse.json(
        { error: "Missing required fields: prompt, platform, action" },
        { status: 400 }
      );
    }

    // Mock mode — no API key configured
    if (!isAiConfigured) {
      return NextResponse.json({
        text: MOCK_RESPONSES[action] ?? MOCK_RESPONSES.generate,
        mock: true,
      });
    }

    const client = new Anthropic({ apiKey: env.anthropicKey });

    const userMessage = `${ACTION_INSTRUCTIONS[action]}\n\nUser input: ${prompt}`;

    const response = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system: SYSTEM_PROMPT(platform, brandVoice),
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
