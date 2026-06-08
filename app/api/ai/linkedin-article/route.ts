// Studio Article LinkedIn — génère un PROMPT personnalisé puis un ARTICLE de
// niveau professionnel (à partir de mots-clés ou d'un texte), plus des prompts
// de visuels haute qualité associés. S'appuie sur la voix de marque, le profil
// de marque (sh_brand_profiles) et la mémoire stratégique pour personnaliser.
//
// Deux modes :
//   - mode "prompt"  → renvoie { prompt } : un brief/prompt pro éditable.
//   - mode "article" → renvoie l'article structuré (titre, accroche, corps,
//     points clés, hashtags, CTA, prompts de visuels).
// Dégradation gracieuse : sans clé IA, renvoie un résultat « démo » cohérent.

export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "@/lib/env";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getMemoryContext } from "@/lib/memory";

interface Body {
  companyId: string;
  mode: "prompt" | "article";
  /** "keywords" | "text" : nature de l'entrée. */
  source?: "keywords" | "text";
  input: string;
  angle?: string;
  audience?: string;
  tone?: string;
  /** "post" (court) | "article" (moyen) | "long" (article complet). */
  length?: "post" | "article" | "long";
  language?: "fr" | "en";
  /** En mode "article" : le prompt (éventuellement édité) à utiliser. */
  customPrompt?: string;
  /**
   * RAG opt-in : si vrai, on injecte le positionnement, les thèmes et la
   * mémoire stratégique (veille/pubs/Page) pour ancrer l'article dans la marque.
   * Si faux (défaut), l'article suit librement le sujet saisi — on ne garde que
   * la voix de marque pour le ton. « Le RAG doit servir si on le demande. »
   */
  useMemory?: boolean;
}

interface ArticleResult {
  title: string;
  hook: string;
  body: string;
  keyTakeaways: string[];
  hashtags: string[];
  cta: string;
  visualPrompts: string[];
}

interface BrandContext {
  name: string;
  voice: string;
  positioning: string;
  audience: string;
  tone: string;
  themes: string[];
  memory: string;
}

// Charge le contexte de marque UNIQUEMENT si le RAG est demandé. Sans RAG, on
// renvoie un contexte vide : l'auteur écrit librement, aucune info client n'est
// injectée (le prompt n'est plus « verrouillé » sur la marque).
async function loadBrandContext(companyId: string, includeRag: boolean): Promise<BrandContext> {
  const ctx: BrandContext = { name: "", voice: "", positioning: "", audience: "", tone: "", themes: [], memory: "" };
  if (!includeRag) return ctx;
  try {
    const uuid = await resolveCompanyUuid(companyId);
    const sb = createAdminClient();
    if (sb) {
      const { data: comp } = await sb.from("sh_companies").select("name, brand_voice").eq("id", uuid).maybeSingle();
      if (comp) { ctx.name = String(comp.name ?? ""); ctx.voice = String(comp.brand_voice ?? ""); }
      const { data: prof } = await sb
        .from("sh_brand_profiles")
        .select("positioning, audience, tone, themes, summary")
        .eq("company_id", uuid)
        .maybeSingle();
      if (prof) {
        ctx.tone = String(prof.tone ?? "");
        ctx.positioning = String(prof.positioning ?? prof.summary ?? "");
        ctx.audience = String(prof.audience ?? "");
        ctx.themes = Array.isArray(prof.themes) ? (prof.themes as string[]) : [];
      }
    }
    ctx.memory = await getMemoryContext(companyId, 10).catch(() => "");
  } catch {
    /* dégradation */
  }
  return ctx;
}

const LENGTH_GUIDE: Record<string, string> = {
  post: "Post LinkedIn court et percutant (150–250 mots), une idée forte développée avec un exemple concret.",
  article: "Article LinkedIn structuré et fouillé (600–900 mots, 4–5 sections avec intertitres, chaque section développée avec exemples concrets et raisonnement — pas de généralités creuses).",
  long: "Article LinkedIn approfondi de leadership éclairé (1200–1800 mots, intertitres clairs, exemples concrets, mise en perspective nuancée, données chiffrées uniquement si véridiques — sinon ne pas inventer).",
};

function langName(language: string): string {
  return language === "en" ? "English" : "français";
}

// Lignes de contexte de marque (vide si RAG désactivé). NE contient PAS la
// langue de sortie — gérée séparément pour rester active même en écriture libre.
function brandLines(b: BrandContext): string {
  return [
    b.name ? `Marque : ${b.name}` : "",
    b.voice ? `Voix de marque : ${b.voice}` : "",
    b.positioning ? `Positionnement : ${b.positioning}` : "",
    b.audience ? `Audience : ${b.audience}` : "",
    b.tone ? `Ton : ${b.tone}` : "",
    b.themes.length ? `Thèmes clés : ${b.themes.join(", ")}` : "",
    b.memory ? `Mémoire stratégique :\n${b.memory}` : "",
  ].filter(Boolean).join("\n");
}

// Section « CONTEXTE MARQUE » prête à insérer — chaîne vide s'il n'y a aucun
// contexte (écriture libre), pour ne pas verrouiller le prompt sur le client.
function brandSection(b: BrandContext, label: string): string {
  const lines = brandLines(b);
  return lines ? `\n\n${label} :\n${lines}` : "";
}

// ── Mode "prompt" : fabrique un brief/prompt professionnel éditable ──────────
async function generatePrompt(body: Body, brand: BrandContext): Promise<string> {
  const sourceLabel = body.source === "text" ? "le texte fourni" : "les mots-clés fournis";
  const params = [
    body.angle ? `Angle : ${body.angle}` : "",
    body.audience ? `Cible : ${body.audience}` : "",
    body.tone ? `Ton souhaité : ${body.tone}` : "",
    `Format : ${LENGTH_GUIDE[body.length ?? "article"]}`,
  ].filter(Boolean).join("\n");

  const lang = langName(body.language ?? "fr");

  if (!isAiConfigured) {
    return [
      `Rédige un ${body.length === "post" ? "post" : "article"} LinkedIn de niveau professionnel à partir de ${sourceLabel} :`,
      `"""${body.input}"""`,
      brandSection(brand, "CONTEXTE MARQUE").trim(),
      params,
      `Langue de sortie : ${lang}`,
      "",
      "Exigences : accroche forte dès la 1re ligne, structure claire (intertitres), une idée par paragraphe, crédibilité (exemples concrets, pas de jargon creux), un appel à l'action, 3–5 hashtags pertinents. Évite les promesses non étayées.",
    ].filter(Boolean).join("\n");
  }

  const meta = `Tu es un expert en stratégie de contenu LinkedIn B2B. À partir des éléments ci-dessous, RÉDIGE UN PROMPT (un brief de rédaction) clair, détaillé et professionnel qui servira ensuite à générer l'article. Le SUJET imposé par l'utilisateur est prioritaire : le prompt doit porter exactement sur ce sujet, sans le détourner vers d'autres thèmes.

ENTRÉE (${sourceLabel}) :
"""${body.input}"""${brandSection(brand, "CONTEXTE MARQUE (à intégrer sans dévier du sujet)")}

PARAMÈTRES :
${params}
Langue de sortie : ${lang}

Le prompt que tu produis doit préciser : l'objectif éditorial, l'angle unique, le public visé, le ton, la structure attendue (accroche + sections), les preuves/exemples à mobiliser, les écueils à éviter, et le style LinkedIn (lisible, aéré, expert mais accessible). Réponds UNIQUEMENT par le texte du prompt.`;

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const res = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 900,
      messages: [{ role: "user", content: meta }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("").trim();
    return text || "(prompt vide)";
  } catch {
    return "(échec de génération du prompt — réessayez)";
  }
}

// ── Mode "article" : génère l'article structuré + prompts visuels ─────────────
const SYSTEM = `Tu es un rédacteur LinkedIn d'élite (leadership éclairé B2B). Tu écris des articles crédibles, structurés, engageants et PROFONDS — chaque idée est développée avec un raisonnement clair et des exemples concrets, jamais des généralités creuses ni du remplissage. Style LinkedIn : accroche forte dès la 1re ligne, paragraphes courts et aérés, intertitres explicites, transitions fluides. Jamais sensationnaliste, aucune promesse non étayée. Tu t'adaptes strictement au sujet demandé (prioritaire) et, s'il est fourni, à la voix de marque ; tu n'inventes ni chiffres ni faits. Pour les secteurs régulés (santé, finance, droit), langage mesuré.`;

function fallbackArticle(body: Body, brand: BrandContext): ArticleResult {
  const topic = body.input.slice(0, 80);
  return {
    title: `${topic}`,
    hook: `Voici une réflexion professionnelle sur : ${topic}.`,
    body: `Démo — IA non configurée.\n\nCet article serait rédigé dans la voix de ${brand.name || "votre marque"} (${brand.voice || "ton professionnel"}), à partir de votre saisie :\n\n${body.input}\n\nConfigurez la clé IA (ANTHROPIC_API_KEY) pour obtenir un article complet de niveau professionnel.`,
    keyTakeaways: ["Point clé 1", "Point clé 2", "Point clé 3"],
    hashtags: ["#LinkedIn", "#Stratégie", "#Expertise"],
    cta: "Qu'en pensez-vous ? Partagez votre avis en commentaire.",
    visualPrompts: [
      `Visuel éditorial professionnel et épuré illustrant : ${topic}. Style corporate moderne, couleurs sobres, haute qualité, sans texte.`,
    ],
  };
}

async function generateArticle(body: Body, brand: BrandContext): Promise<{ article: ArticleResult; aiGenerated: boolean }> {
  if (!isAiConfigured) return { article: fallbackArticle(body, brand), aiGenerated: false };

  const directive = body.customPrompt?.trim()
    ? body.customPrompt.trim()
    : `Rédige un article LinkedIn à partir de ${body.source === "text" ? "ce texte" : "ces mots-clés"} : """${body.input}"""\n${LENGTH_GUIDE[body.length ?? "article"]}`;

  const prompt = `${directive}${brandSection(brand, "CONTEXTE MARQUE (à intégrer sans dévier du sujet demandé)")}
Langue de sortie : ${langName(body.language ?? "fr")}

Retourne STRICTEMENT ce JSON :
{
  "title": "titre d'article fort et professionnel",
  "hook": "1-2 phrases d'accroche qui donnent envie de lire (1re ligne du post)",
  "body": "le corps de l'article en markdown : intertitres (##), paragraphes aérés et courts, listes si utile. Développé, crédible, riche en exemples concrets, sans jargon creux. Respecte la longueur demandée.",
  "keyTakeaways": ["3 à 5 enseignements clés et concrets (phrases complètes, actionnables)"],
  "hashtags": ["3 à 5 hashtags LinkedIn pertinents et spécifiques"],
  "cta": "un appel à l'action / question d'engagement en fin d'article",
  "visualPrompts": ["2 à 3 prompts TRÈS DÉTAILLÉS en anglais pour des visuels éditoriaux de niveau professionnel (photographie corporate moderne ou illustration épurée) : sujet précis lié à l'article, composition, cadrage, lumière, palette sobre, ambiance ; rendu haute définition, réaliste et premium ; AUCUN texte ni logo incrusté"]
}`;

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const res = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 3500,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = res.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { article: fallbackArticle(body, brand), aiGenerated: false };
    const p = JSON.parse(match[0]) as Partial<ArticleResult>;
    return {
      article: {
        title: p.title ?? body.input.slice(0, 80),
        hook: p.hook ?? "",
        body: p.body ?? "",
        keyTakeaways: (p.keyTakeaways ?? []).slice(0, 6),
        hashtags: (p.hashtags ?? []).slice(0, 6),
        cta: p.cta ?? "",
        visualPrompts: (p.visualPrompts ?? []).slice(0, 3),
      },
      aiGenerated: true,
    };
  } catch (e) {
    console.warn("[linkedin-article] fallback:", e);
    return { article: fallbackArticle(body, brand), aiGenerated: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.companyId || !body.input?.trim()) {
      return NextResponse.json({ error: "companyId et input requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(body.companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const brand = await loadBrandContext(body.companyId, body.useMemory === true);

    if (body.mode === "prompt") {
      const prompt = await generatePrompt(body, brand);
      return NextResponse.json({ prompt, aiGenerated: isAiConfigured });
    }

    const { article, aiGenerated } = await generateArticle(body, brand);
    return NextResponse.json({ article, aiGenerated });
  } catch (e) {
    console.error("[POST /api/ai/linkedin-article]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
