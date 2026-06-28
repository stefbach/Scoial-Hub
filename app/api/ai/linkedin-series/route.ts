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

/**
 * Série de démonstration quand l'IA n'est pas configurée. Le contenu est un
 * VRAI texte rédigé (prose finie), pas un gabarit de consignes — pour que la
 * démo reflète fidèlement ce que produit l'IA une fois configurée.
 */
function mockSeries(theme: string, count: number, fr: boolean, article: boolean): SeriesPost[] {
  const tag = theme.replace(/\s+/g, "");
  const anglesFr = [
    "un retour d'expérience concret",
    "l'erreur que tout le monde commet",
    "la méthode qui a vraiment fonctionné",
    "un chiffre qui change la perspective",
    "une question pour votre audience",
  ];
  const anglesEn = [
    "a concrete lesson learned",
    "the mistake everyone makes",
    "the method that actually worked",
    "a figure that shifts the perspective",
    "a question for your audience",
  ];

  return Array.from({ length: count }, (_, i) => {
    const angle = (fr ? anglesFr : anglesEn)[i % 5];
    const body = article
      ? (fr
        ? `${theme} : ${angle}.\n\nOn parle beaucoup de ${theme}, mais rarement de ce que ça change concrètement. Voici un point clair, sans jargon.\n\nLe constat : la plupart des équipes sous-estiment l'effort de départ et abandonnent trop tôt. En pratique, les premiers résultats arrivent en quelques semaines, pas en quelques jours.\n\nCe qui a fonctionné chez nous : commencer petit, suivre un seul indicateur utile, puis ajuster. Nous avons gagné près de 18 % d'efficacité simplement en retirant les étapes inutiles.\n\nL'erreur à éviter : vouloir tout automatiser d'un coup. La technologie aide, mais c'est la clarté du processus qui fait la différence.\n\nÀ retenir : commencez petit, mesurez ce qui compte, et gardez l'humain au centre.\n\nEt vous, où en êtes-vous sur ${theme} ? Partagez votre expérience en commentaire.\n\n#${tag} #LinkedIn #Stratégie`
        : `${theme}: ${angle}.\n\nEveryone talks about ${theme}, but rarely about what it actually changes day to day. Here is a clear, jargon-free take.\n\nThe reality: most teams underestimate the upfront effort and give up too soon. In practice, the first results show up in a few weeks, not a few days.\n\nWhat worked for us: start small, track a single useful metric, then adjust. We gained nearly 18% efficiency simply by removing unnecessary steps.\n\nThe mistake to avoid: trying to automate everything at once. Technology helps, but it is the clarity of the process that makes the difference.\n\nKey takeaway: start small, measure what matters, and keep people at the center.\n\nWhere are you with ${theme}? Share your experience in the comments.\n\n#${tag} #LinkedIn #Strategy`)
      : (fr
        ? `${theme} : ${angle}.\n\nUn constat rapide : on complique souvent ${theme} alors que l'essentiel tient en une idée. Commencez petit, mesurez, ajustez. C'est tout.\n\nEt vous, quel est votre prochain pas ?\n\n#${tag} #LinkedIn`
        : `${theme}: ${angle}.\n\nQuick take: we often overcomplicate ${theme} when the essentials fit in one idea. Start small, measure, adjust. That's it.\n\nWhat's your next step?\n\n#${tag} #LinkedIn`);
    return {
      title: `${theme} (${i + 1}/${count})`,
      body: body.slice(0, MAX_BODY),
      visualPrompt: `Professional, modern LinkedIn visual illustrating "${theme}", clean corporate style, part ${i + 1}, high quality, no text`,
    };
  });
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
