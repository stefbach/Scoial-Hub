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
  /** "post" = posts courts (défaut) ; "article" = articles plus longs/structurés. */
  format?: "post" | "article";
}

interface SeriesPost {
  title: string;
  body: string;
  /** Prompt d'image (anglais) pour générer un visuel assorti à ce post. */
  visualPrompt?: string;
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
    visualPrompt: p.visualPrompt ? clean(p.visualPrompt).slice(0, 400) : undefined,
  };
}

/** Série de démonstration quand l'IA n'est pas configurée. */
function mockSeries(theme: string, count: number, fr: boolean, article: boolean): SeriesPost[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `${theme} (${i + 1}/${count})`,
    body: article
      ? (fr
        ? `${theme} - Partie ${i + 1}/${count}\n\nIntroduction : posez le contexte et l'enjeu pour votre audience professionnelle.\n\nDéveloppement : trois idées clés, chacune illustrée d'un exemple concret ou d'un chiffre. Structurez avec des sauts de ligne pour la lisibilité mobile.\n\nÀ retenir :\n• Premier enseignement actionnable\n• Deuxième enseignement\n• Troisième enseignement\n\nConclusion + appel à l'action : invitez au débat.\n\n#${theme.replace(/\s+/g, "")} #LinkedIn`
        : `${theme} - Part ${i + 1}/${count}\n\nIntroduction: set the context and the stakes for your professional audience.\n\nBody: three key ideas, each backed by a concrete example or a figure. Use line breaks for mobile readability.\n\nKey takeaways:\n• First actionable lesson\n• Second lesson\n• Third lesson\n\nConclusion + call to action: invite discussion.\n\n#${theme.replace(/\s+/g, "")} #LinkedIn`)
      : (fr
        ? `Post ${i + 1} sur ${count} autour de « ${theme} ». Partagez ici un angle concret : un conseil actionnable, un retour d'expérience ou une question à votre audience.\n\nQu'en pensez-vous ? Dites-le en commentaire.\n\n#${theme.replace(/\s+/g, "")} #LinkedIn`
        : `Post ${i + 1} of ${count} about "${theme}". Share a concrete angle here: an actionable tip, a lesson learned, or a question for your audience.\n\nWhat do you think? Let us know in the comments.\n\n#${theme.replace(/\s+/g, "")} #LinkedIn`),
    visualPrompt: `Professional, modern LinkedIn visual illustrating "${theme}", clean corporate style, part ${i + 1}, high quality, no text`,
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
    const article = body.format === "article";

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

    const lengthRule = article
      ? `Each body: 250 to 450 words, structured like a mini-article (a strong hook line, an intro, 2 to 4 clearly separated key ideas with concrete examples or figures, a short "key takeaways" list, then a conclusion with a call-to-action). Strictly under ${MAX_BODY} characters.`
      : `Each body: 100 to 250 words, strictly under ${MAX_BODY} characters (hook in the first line, line breaks, a clear call-to-action).`;

    const prompt = `
You are an expert LinkedIn copywriter. Write a coherent series of ${count} LinkedIn ${article ? "articles" : "posts"} on the theme: "${theme}".

Rules:
- Write ENTIRELY in ${langName} (titles and bodies).
- Each piece must stand on its own, but the series should progress logically (different angle per piece: tip, story, mistake to avoid, question to the audience, data point...).
- ${lengthRule}
- End each body with 3 to 5 professional hashtags.
- NEVER use the em-dash character. Use commas, periods or simple hyphens instead.
- No numbering like "Post 1:" inside the body.
- For EACH piece, also write a "visualPrompt": a concise ENGLISH image-generation prompt (max ~40 words) describing a professional, on-brand LinkedIn visual that matches the piece. No text in the image, clean corporate style.
${body.tone ? `- Tone: ${body.tone}.` : ""}
${body.brandVoice ? `- Brand voice to match: "${body.brandVoice}".` : ""}
${memoryContext ? `\nStrategic memory (insights to ground the content in):\n${memoryContext}\n` : ""}
Return ONLY valid JSON, no commentary, with this exact shape:
{"posts":[{"title":"short internal title","body":"full post text","visualPrompt":"english image prompt"}]}
The "posts" array must contain exactly ${count} items.
`.trim();

    const data = await callClaudeJSON<{ posts: SeriesPost[] }>(prompt, {
      maxTokens: Math.min(8000, 800 + count * (article ? 1200 : 700)),
      system: "You return only valid JSON. No markdown fences, no commentary.",
    });

    if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
      // IA non configurée ou réponse invalide → série de démonstration.
      return NextResponse.json({ posts: mockSeries(theme, count, fr, article), mock: true });
    }

    const posts = data.posts
      .filter((p) => p && typeof p.body === "string" && p.body.trim())
      .slice(0, count)
      .map(sanitize);

    if (posts.length === 0) {
      return NextResponse.json({ posts: mockSeries(theme, count, fr, article), mock: true });
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
