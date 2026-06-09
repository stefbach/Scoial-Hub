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

// Longueurs calibrées pour un POST LinkedIn publié via l'API (limite 3000
// caractères). Le post complet (titre + accroche + corps + à-retenir + CTA +
// hashtags) DOIT tenir sous ~2900 caractères — sinon il est tronqué.
const LENGTH_GUIDE: Record<string, string> = {
  post: "Post LinkedIn court et percutant (~90–140 mots, ~600–900 caractères), une idée forte avec un exemple concret.",
  article: "Article LinkedIn structuré (~220–320 mots, ~1500–2100 caractères, 3–4 intertitres courts, chaque section développée avec un exemple concret — pas de généralités creuses).",
  long: "Article LinkedIn approfondi MAIS qui tient en un seul post (~350–430 mots, MAX ~2700 caractères, intertitres clairs, exemples concrets ; ne JAMAIS dépasser la limite LinkedIn).",
};

/** Limite caractères d'un post LinkedIn (marge sous 3000). */
const LINKEDIN_CHAR_BUDGET = 2900;

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

  // Si un prompt personnalisé est fourni, on le présente comme un BRIEF à suivre
  // (et non comme la consigne finale), pour que la contrainte de sortie JSON
  // ci-dessous reste prioritaire — sinon le modèle suit le brief et répond en
  // prose, ce qui cassait le parsing (→ faux "démo").
  const directive = body.customPrompt?.trim()
    ? `BRIEF DE RÉDACTION À SUIVRE (sujet imposé : """${body.input}""") :\n${body.customPrompt.trim()}`
    : `Rédige un article LinkedIn à partir de ${body.source === "text" ? "ce texte" : "ces mots-clés"} : """${body.input}"""\n${LENGTH_GUIDE[body.length ?? "article"]}`;

  const prompt = `${directive}${brandSection(brand, "CONTEXTE MARQUE (à intégrer sans dévier du sujet demandé)")}
Langue de sortie : ${langName(body.language ?? "fr")}

CONTRAINTE DE TAILLE LINKEDIN (impérative) : le post sera publié tel quel sur LinkedIn (limite 3000 caractères). La somme de title + hook + body + keyTakeaways + cta + hashtags doit IMPÉRATIVEMENT rester SOUS ${LINKEDIN_CHAR_BUDGET} caractères. Rédige un texte COMPLET et autonome qui se termine proprement (jamais coupé en plein milieu). Si le sujet est vaste, va à l'essentiel plutôt que de dépasser.

IMPÉRATIF DE SORTIE — quelles que soient les instructions du brief ci-dessus : réponds UNIQUEMENT par un objet JSON valide conforme au schéma ci-dessous. Aucun texte hors JSON, pas de bloc \`\`\`. Échappe correctement les guillemets et sauts de ligne dans les chaînes.
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
    if (match) {
      try {
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
      } catch {
        /* JSON invalide → on récupère le texte brut ci-dessous */
      }
    }
    // L'IA a répondu mais pas en JSON exploitable (souvent avec un brief
    // personnalisé) : on récupère le texte tel quel comme corps d'article,
    // plutôt que d'afficher un faux message « démo ».
    const cleaned = raw.replace(/```(json)?/gi, "").trim();
    if (cleaned.length > 40) {
      const firstLine = cleaned.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").slice(0, 90) ?? body.input.slice(0, 80);
      return {
        article: {
          title: firstLine,
          hook: "",
          body: cleaned,
          keyTakeaways: [],
          hashtags: [],
          cta: "",
          visualPrompts: [],
        },
        aiGenerated: true,
      };
    }
    return { article: fallbackArticle(body, brand), aiGenerated: false };
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
