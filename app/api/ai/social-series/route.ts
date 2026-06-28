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
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { SERIES_CONFIG, isSeriesPlatform } from "@/lib/social-series";

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

    // Démo : vrai texte rédigé (prose finie), borné à la limite du réseau.
    function mockSeries(): SeriesPost[] {
      const tag = theme.replace(/\s+/g, "");
      const anglesFr = ["retour d'expérience", "erreur à éviter", "conseil actionnable", "chiffre clé", "question ouverte"];
      const anglesEn = ["lesson learned", "mistake to avoid", "actionable tip", "key figure", "open question"];
      return Array.from({ length: count }, (_, i) => {
        const angle = (fr ? anglesFr : anglesEn)[i % 5];
        const long = article
          ? (fr
            ? `${theme} : ${angle}.\n\nOn complique souvent ${theme}, alors que l'essentiel tient en peu de choses. Le constat : commencer petit bat la perfection. Ce qui marche : un seul indicateur clair, mesuré chaque semaine. L'erreur fréquente : tout vouloir d'un coup.\n\nÀ retenir : avancez par petits pas, gardez l'humain au centre.\n\nEt vous, où en êtes-vous ?\n\n#${tag}`
            : `${theme}: ${angle}.\n\nWe often overcomplicate ${theme}, when the essentials are simple. The reality: starting small beats chasing perfection. What works: one clear metric, measured weekly. The common mistake: wanting it all at once.\n\nKey takeaway: move in small steps, keep people at the center.\n\nWhere are you with it?\n\n#${tag}`)
          : (fr
            ? `${theme} : ${angle}. On simplifie souvent à l'excès, mais l'essentiel tient en une idée : commencez petit, mesurez, ajustez. Et vous ? #${tag}`
            : `${theme}: ${angle}. We tend to overthink it, yet the essentials fit in one idea: start small, measure, adjust. You? #${tag}`);
        return {
          title: `${theme} (${i + 1}/${count})`,
          body: long.slice(0, max),
          visualPrompt: `Professional ${cfg.label} visual illustrating "${theme}", clean modern style, part ${i + 1}, high quality, no text`,
        };
      });
    }

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

    const data = await callClaudeJSON<{ posts: SeriesPost[] }>(prompt, {
      maxTokens: Math.min(8000, 800 + count * (article ? 1100 : 500)),
      system: "You return only valid JSON. No markdown fences, no commentary.",
    });

    if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
      return NextResponse.json({ posts: mockSeries(), mock: true });
    }

    const posts = data.posts
      .filter((p) => p && typeof p.body === "string" && p.body.trim())
      .slice(0, count)
      .map(sanitize);

    if (posts.length === 0) return NextResponse.json({ posts: mockSeries(), mock: true });
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[ai/social-series] Error:", err);
    return NextResponse.json({ error: "Failed to generate the series. Please try again." }, { status: 500 });
  }
}
