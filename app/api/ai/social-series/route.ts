/**
 * POST /api/ai/social-series
 *
 * Génère une série de publications cohérentes pour N'IMPORTE QUEL réseau, en
 * respectant ses contraintes (longueur, format, ton). Variante générique de
 * /api/ai/linkedin-series, pilotée par lib/social-series (SERIES_CONFIG).
 *
 * Body : { companyId, platform, theme, count, language, tone?, useMemory?,
 *          brandVoice?, format? }
 * Réponse : { posts: [{ title, body, visualPrompt }], mock? }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSONRetryResult } from "@/lib/ai/claude-json";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { isAiConfigured } from "@/lib/env";
import { SERIES_CONFIG, isSeriesPlatform } from "@/lib/social-series";
import { buildMockSeries } from "@/lib/mock-series";

interface SeriesPost {
  title: string;
  body: string;
  visualPrompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      companyId?: string;
      platform?: string;
      theme?: string;
      count?: number;
      language?: string;
      tone?: string;
      useMemory?: boolean;
      brandVoice?: string;
      format?: "post" | "article";
    };

    const companyId = body.companyId;
    const platform = body.platform ?? "";
    const theme = (body.theme ?? "").trim();
    const count = Math.min(10, Math.max(1, Math.round(body.count ?? 5)));
    const fr = (body.language ?? "fr") !== "en";
    const langName = fr ? "French" : "English";

    if (!companyId || !theme || !isSeriesPlatform(platform)) {
      return NextResponse.json(
        { error: "companyId, a valid platform and theme are required" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const cfg = SERIES_CONFIG[platform];
    const article = body.format === "article" && cfg.formats.includes("article");
    const max = cfg.maxChars;

    const clean = (s: string) => String(s ?? "").replace(/\s*—\s*/g, " - ").trim();
    const sanitize = (p: SeriesPost): SeriesPost => ({
      title: clean(p.title).slice(0, 120),
      body: clean(p.body).slice(0, max),
      visualPrompt: p.visualPrompt ? clean(p.visualPrompt).slice(0, 400) : undefined,
    });

    let memoryContext = "";
    if (body.useMemory) {
      try {
        const { getMemoryContext } = await import("@/lib/memory");
        memoryContext = await getMemoryContext(companyId, 20);
      } catch { /* non bloquant */ }
    }

    // Règles de format adaptées au réseau.
    const constraint =
      platform === "twitter"
        ? `Each body must be a single punchy message UNDER ${max} characters (hard limit), with at most 1 or 2 hashtags.`
        : article
        ? `Each body: a structured mini-article (hook, intro, 2 to 4 key ideas with examples, key takeaways, conclusion + CTA), strictly under ${max} characters, ending with 3 to 5 hashtags.`
        : `Each body: a concise, engaging ${cfg.label} caption under ${max} characters (hook first line, clear CTA, ${platform === "instagram" ? "relevant emojis and " : ""}3 to 5 hashtags).`;

    const prompt = `
You are an expert ${cfg.label} content creator. Write a coherent series of ${count} ${cfg.label} posts on the theme: "${theme}".

Rules:
- Write ENTIRELY in ${langName}.
- Each post stands on its own; the series progresses logically (different angle each time).
- ${constraint}
- NEVER use the em-dash character. Use commas, periods or simple hyphens.
- For EACH post, also write a "visualPrompt": a concise ENGLISH image-generation prompt (max ~40 words) for an on-brand, professional ${cfg.label} visual. No text in the image.
${body.tone ? `- Tone: ${body.tone}.` : ""}
${body.brandVoice ? `- Brand voice to match: "${body.brandVoice}".` : ""}
${memoryContext ? `\nStrategic memory:\n${memoryContext}\n` : ""}
Return ONLY valid JSON with this exact shape:
{"posts":[{"title":"short internal title","body":"full post text","visualPrompt":"english image prompt"}]}
The "posts" array must contain exactly ${count} items.
`.trim();

    const { data, error: aiErr } = await callClaudeJSONRetryResult<{ posts: SeriesPost[] }>(prompt, {
      maxTokens: Math.min(8000, 800 + count * (article ? 1100 : 500)),
      system: "You return only valid JSON. No markdown fences, no commentary.",
    });

    const aiFailed = () =>
      isAiConfigured
        ? NextResponse.json(
            { error: `La génération IA a échoué. Détail : ${aiErr ?? "réponse vide"}. Vérifiez le modèle ANTHROPIC_MODEL et la clé.`, aiError: true },
            { status: 502 }
          )
        : NextResponse.json({ posts: buildMockSeries(theme, count, fr, article, max), mock: true });

    if (!data || !Array.isArray(data.posts) || data.posts.length === 0) return aiFailed();

    const posts = data.posts
      .filter((p) => p && typeof p.body === "string" && p.body.trim())
      .slice(0, count)
      .map(sanitize);

    if (posts.length === 0) return aiFailed();
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[ai/social-series] Error:", err);
    return NextResponse.json({ error: "Failed to generate the series. Please try again." }, { status: 500 });
  }
}
