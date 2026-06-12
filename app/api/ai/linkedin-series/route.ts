/**
 * POST /api/ai/linkedin-series
 *
 * Génère une série de publications LinkedIn cohérentes sur un thème donné,
 * pour le planificateur de lot (onglet « Programmation » de l'espace LinkedIn).
 *
 * Body : { companyId, theme, count, language, tone?, useMemory?, brandVoice? }
 * Réponse : { posts: [{ title, body }], mock? }
 *
 * Contraintes de sortie : chaque body < 2900 caractères, pas de tiret cadratin,
 * langue de rédaction = `language` ("fr" | "en").
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { requireCompanyAccess } from "@/lib/auth/guard";

interface RequestBody {
  companyId?: string;
  theme?: string;
  count?: number;
  language?: string; // "fr" | "en"
  tone?: string;
  useMemory?: boolean;
  brandVoice?: string;
}

interface SeriesPost {
  title: string;
  body: string;
}

const MAX_BODY = 2900;

/** Nettoie un post généré : pas de tiret cadratin, longueur bornée. */
function sanitize(p: SeriesPost): SeriesPost {
  const clean = (s: string) =>
    String(s ?? "")
      .replace(/\s*—\s*/g, " - ")
      .trim();
  return {
    title: clean(p.title).slice(0, 120),
    body: clean(p.body).slice(0, MAX_BODY),
  };
}

/** Série de démonstration quand l'IA n'est pas configurée. */
function mockSeries(theme: string, count: number, fr: boolean): SeriesPost[] {
  return Array.from({ length: count }, (_, i) => ({
    title: fr ? `${theme} (${i + 1}/${count})` : `${theme} (${i + 1}/${count})`,
    body: fr
      ? `Post ${i + 1} sur ${count} autour de « ${theme} ». Partagez ici un angle concret : un conseil actionnable, un retour d'expérience ou une question à votre audience.\n\nQu'en pensez-vous ? Dites-le en commentaire.\n\n#${theme.replace(/\s+/g, "")} #LinkedIn`
      : `Post ${i + 1} of ${count} about "${theme}". Share a concrete angle here: an actionable tip, a lesson learned, or a question for your audience.\n\nWhat do you think? Let us know in the comments.\n\n#${theme.replace(/\s+/g, "")} #LinkedIn`,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const companyId = body.companyId;
    const theme = (body.theme ?? "").trim();
    const count = Math.min(10, Math.max(1, Math.round(body.count ?? 5)));
    const fr = (body.language ?? "fr") !== "en";
    const langName = fr ? "French" : "English";

    if (!companyId || !theme) {
      return NextResponse.json(
        { error: "companyId and theme are required" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    }

    // RAG opt-in : mémoire stratégique (veille/pubs/Page) si demandé.
    let memoryContext = "";
    if (body.useMemory) {
      try {
        const { getMemoryContext } = await import("@/lib/memory");
        memoryContext = await getMemoryContext(companyId, 20);
      } catch {
        /* non bloquant */
      }
    }

    const prompt = `
You are an expert LinkedIn copywriter. Write a coherent series of ${count} LinkedIn posts on the theme: "${theme}".

Rules:
- Write ENTIRELY in ${langName} (titles and bodies).
- Each post must stand on its own, but the series should progress logically (different angle per post: tip, story, mistake to avoid, question to the audience, data point...).
- Each body: 100 to 250 words, strictly under ${MAX_BODY} characters, ready to publish (hook in the first line, line breaks, a clear call-to-action, 3 to 5 professional hashtags at the end).
- NEVER use the em-dash character. Use commas, periods or simple hyphens instead.
- No numbering like "Post 1:" inside the body.
${body.tone ? `- Tone: ${body.tone}.` : ""}
${body.brandVoice ? `- Brand voice to match: "${body.brandVoice}".` : ""}
${memoryContext ? `\nStrategic memory (insights to ground the content in):\n${memoryContext}\n` : ""}
Return ONLY valid JSON, no commentary, with this exact shape:
{"posts":[{"title":"short internal title","body":"full post text"}]}
The "posts" array must contain exactly ${count} items.
`.trim();

    const data = await callClaudeJSON<{ posts: SeriesPost[] }>(prompt, {
      maxTokens: Math.min(8000, 600 + count * 700),
      system: "You return only valid JSON. No markdown fences, no commentary.",
    });

    if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
      // IA non configurée ou réponse invalide → série de démonstration.
      return NextResponse.json({ posts: mockSeries(theme, count, fr), mock: true });
    }

    const posts = data.posts
      .filter((p) => p && typeof p.body === "string" && p.body.trim())
      .slice(0, count)
      .map(sanitize);

    if (posts.length === 0) {
      return NextResponse.json({ posts: mockSeries(theme, count, fr), mock: true });
    }

    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[ai/linkedin-series] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate the series. Please try again." },
      { status: 500 }
    );
  }
}
