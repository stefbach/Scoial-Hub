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
import { createClaudeMessage } from "@/lib/ai/anthropic";
import { env, isAiConfigured } from "@/lib/env";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getMemoryContext } from "@/lib/memory";

interface Body {
  companyId: string;
  mode: "prompt" | "article" | "revise";
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
  /** En mode "revise" : l'article courant + la consigne d'ajustement + l'historique. */
  article?: ArticleResult;
  instruction?: string;
  history?: { role: "user" | "assistant"; content: string }[];
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

// Longueurs calibrées en CARACTÈRES du POST ENTIER assemblé (titre + accroche +
// corps + à-retenir + CTA + hashtags). Un post LinkedIn = 3000 caractères MAX :
// on budgète sous 2900 pour produire un texte COMPLET qui ne sera JAMAIS coupé.
const LENGTH_GUIDE: Record<string, string> = {
  post: "Post LinkedIn court et COMPLET : le POST ENTIER (titre + accroche + corps + à-retenir + CTA + hashtags) doit faire AU TOTAL entre 700 et 1000 caractères. Une idée forte, un exemple concret, une conclusion nette.",
  article: "Article LinkedIn structuré et COMPLET : le POST ENTIER fait AU TOTAL entre 1500 et 2100 caractères, 2 à 3 intertitres courts, chaque section développée avec un exemple concret (pas de généralités), conclusion nette.",
  long: "Article LinkedIn riche et COMPLET tenant en UN SEUL post : le POST ENTIER fait AU TOTAL entre 2300 et 2850 caractères — JAMAIS plus de 2900 —, intertitres clairs, exemples concrets, mise en perspective, conclusion nette.",
};

/** Budget caractères cible (marge sous la limite LinkedIn de 3000). */
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
    const res = await createClaudeMessage(client, {
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
    body: `Démo - IA non configurée.\n\nCet article serait rédigé dans la voix de ${brand.name || "votre marque"} (${brand.voice || "ton professionnel"}), à partir de votre saisie :\n\n${body.input}\n\nConfigurez la clé IA (ANTHROPIC_API_KEY) pour obtenir un article complet de niveau professionnel.`,
    keyTakeaways: ["Point clé 1", "Point clé 2", "Point clé 3"],
    hashtags: ["#LinkedIn", "#Stratégie", "#Expertise"],
    cta: "Qu'en pensez-vous ? Partagez votre avis en commentaire.",
    visualPrompts: [
      `Visuel éditorial professionnel et épuré illustrant : ${topic}. Style corporate moderne, couleurs sobres, haute qualité, sans texte.`,
    ],
  };
}

/** Remplace les tirets cadratins (—) et demi-cadratins (–) — l'utilisateur n'en veut pas. */
function noCadratin(s: string): string {
  return s
    .replace(/\s*[—―]\s*/g, " - ") // cadratin / barre horizontale → tiret simple
    .replace(/–/g, "-")             // demi-cadratin → trait d'union
    .replace(/[ \t]{2,}/g, " ");
}

/** Nettoie tous les champs texte d'un article (cadratins). */
function sanitizeArticle(a: ArticleResult): ArticleResult {
  return {
    ...a,
    title: noCadratin(a.title),
    hook: noCadratin(a.hook),
    body: noCadratin(a.body),
    cta: noCadratin(a.cta),
    keyTakeaways: a.keyTakeaways.map(noCadratin),
  };
}

/** Reconstitue le texte publié sur LinkedIn (même assemblage que le client) pour en mesurer la longueur. */
function assembledPostText(a: ArticleResult): string {
  const body = a.body.replace(/^#{1,6}\s*/gm, "").replace(/\*\*/g, "");
  return [
    a.title ? a.title.trim() : "",
    "",
    a.hook,
    "",
    body,
    a.keyTakeaways.length ? "\n" + a.keyTakeaways.map((k) => `• ${k}`).join("\n") : "",
    a.cta ? `\n${a.cta}` : "",
    a.hashtags.length ? `\n${a.hashtags.join(" ")}` : "",
  ].filter((s) => s !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Réécrit l'article plus court pour tenir sous la limite LinkedIn, en restant
 * COMPLET et cohérent (condense — ne tronque pas). Garde l'original si échec.
 */
async function condenseToFit(a: ArticleResult, client: Anthropic, lang: string): Promise<ArticleResult> {
  const current = assembledPostText(a).length;
  const promptC = `Ce post LinkedIn fait ${current} caractères, c'est TROP LONG (le total publié doit tenir sous 3000). Réécris-le pour que le TOTAL (title + hook + body + keyTakeaways + cta + hashtags) tienne en MOINS de ${LINKEDIN_CHAR_BUDGET} caractères, en restant COMPLET, cohérent et fluide : CONDENSE (phrases plus courtes, va à l'essentiel), ne tronque pas, ne termine pas par « … ». Langue : ${lang}. N'utilise jamais de tiret cadratin (—) ni demi-cadratin (–).

Réponds UNIQUEMENT en JSON (même schéma) :
{"title":"...","hook":"...","body":"...","keyTakeaways":["..."],"hashtags":["..."],"cta":"..."}

Post actuel à condenser :
${JSON.stringify({ title: a.title, hook: a.hook, body: a.body, keyTakeaways: a.keyTakeaways, cta: a.cta, hashtags: a.hashtags })}`;
  try {
    const res = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: "user", content: promptC }],
    });
    const raw = res.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]) as Partial<ArticleResult>;
      return sanitizeArticle({
        title: p.title ?? a.title,
        hook: p.hook ?? a.hook,
        body: p.body ?? a.body,
        keyTakeaways: (p.keyTakeaways ?? a.keyTakeaways).slice(0, 6),
        hashtags: (p.hashtags ?? a.hashtags).slice(0, 6),
        cta: p.cta ?? a.cta,
        visualPrompts: a.visualPrompts,
      });
    }
  } catch { /* on garde l'original */ }
  return a;
}

/**
 * Mode CHATBOT : applique une consigne d'ajustement à l'article COURANT
 * (« raccourcis l'intro », « ajoute une statistique », « ton plus direct »,
 * « termine par une question »…) et renvoie l'article révisé — toujours
 * COMPLET et sous la limite LinkedIn (condensé si besoin, jamais tronqué).
 */
async function reviseArticle(body: Body, client: Anthropic): Promise<{ article: ArticleResult; aiGenerated: boolean; changed: boolean }> {
  const cur = body.article;
  if (!cur) throw new Error("article manquant pour la révision");
  const lang = langName(body.language ?? "fr");
  const instruction = (body.instruction ?? "").trim() || "Améliore l'article.";

  const histText = (body.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "DEMANDE" : "ASSISTANT"} : ${m.content}`)
    .join("\n");

  const prompt = `Tu ajustes un article LinkedIn EXISTANT selon la demande de l'utilisateur. Tu NE repars PAS de zéro : tu modifies l'article fourni en respectant la demande, et tu RECOPIES INTÉGRALEMENT les champs non concernés.

${histText ? `HISTORIQUE DES ÉCHANGES :\n${histText}\n` : ""}
DEMANDE ACTUELLE : ${instruction}

ARTICLE ACTUEL (JSON) :
${JSON.stringify({ title: cur.title, hook: cur.hook, body: cur.body, keyTakeaways: cur.keyTakeaways, hashtags: cur.hashtags, cta: cur.cta })}

CONTRAINTE LINKEDIN (impérative) : le post complet (title + hook + body + keyTakeaways + cta + hashtags) doit rester COMPLET et tenir en MOINS de 3000 caractères (vise ~${LINKEDIN_CHAR_BUDGET}). Termine toujours proprement, jamais de « … ». Langue : ${lang}.
TYPOGRAPHIE : n'utilise JAMAIS de tiret cadratin (—) ni demi-cadratin (–).

IMPÉRATIF : réponds UNIQUEMENT par un objet JSON valide complet (même schéma), AUCUN texte autour, pas de bloc \`\`\`, échappe les guillemets et sauts de ligne :
{"title":"...","hook":"...","body":"...","keyTakeaways":["..."],"hashtags":["..."],"cta":"..."}`;

  const res = await createClaudeMessage(client, {
    model: env.anthropicModel,
    max_tokens: 3800,
    temperature: 0.5,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = res.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
  const m = raw.match(/\{[\s\S]*\}/);
  let parsed: Partial<ArticleResult> | null = null;
  if (m) {
    try { parsed = JSON.parse(m[0]) as Partial<ArticleResult>; } catch { parsed = null; }
  }
  // Pas de JSON exploitable → on ne prétend PAS avoir ajusté (changed:false).
  if (!parsed) return { article: cur, aiGenerated: false, changed: false };

  let article = sanitizeArticle({
    title: parsed.title ?? cur.title,
    hook: parsed.hook ?? cur.hook,
    body: parsed.body ?? cur.body,
    keyTakeaways: (parsed.keyTakeaways ?? cur.keyTakeaways).slice(0, 6),
    hashtags: (parsed.hashtags ?? cur.hashtags).slice(0, 6),
    cta: parsed.cta ?? cur.cta,
    visualPrompts: cur.visualPrompts,
  });
  if (assembledPostText(article).length > LINKEDIN_CHAR_BUDGET) {
    article = await condenseToFit(article, client, lang);
  }
  const changed = assembledPostText(article) !== assembledPostText(cur);
  return { article, aiGenerated: true, changed };
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

CONTRAINTE LINKEDIN (IMPÉRATIVE, vérifie-la avant de répondre) : un post LinkedIn est limité à 3000 caractères. Le POST ENTIER assemblé (title + hook + body + keyTakeaways + cta + hashtags) doit être COMPLET, se terminer proprement, et faire MOINS de ${LINKEDIN_CHAR_BUDGET} caractères AU TOTAL (idéalement dans la fourchette indiquée par le format ci-dessus). Compte mentalement les caractères de l'ensemble : s'il approche 2900, raccourcis AVANT de répondre. Un texte dense et abouti vaut TOUJOURS mieux qu'un texte long et coupé. Ne te fais JAMAIS interrompre en plein milieu.

TYPOGRAPHIE : n'utilise JAMAIS de tiret cadratin (—) ni demi-cadratin (–). Utilise des virgules, des points ou des parenthèses à la place.

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
    const res = await createClaudeMessage(client, {
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
        let article = sanitizeArticle({
          title: p.title ?? body.input.slice(0, 80),
          hook: p.hook ?? "",
          body: p.body ?? "",
          keyTakeaways: (p.keyTakeaways ?? []).slice(0, 6),
          hashtags: (p.hashtags ?? []).slice(0, 6),
          cta: p.cta ?? "",
          visualPrompts: (p.visualPrompts ?? []).slice(0, 3),
        });
        // Si le post dépasse la limite LinkedIn, on le CONDENSE (réécriture
        // complète plus courte) au lieu de le tronquer à la publication.
        if (assembledPostText(article).length > LINKEDIN_CHAR_BUDGET) {
          article = await condenseToFit(article, client, langName(body.language ?? "fr"));
        }
        return { article, aiGenerated: true };
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
        article: sanitizeArticle({
          title: firstLine,
          hook: "",
          body: cleaned,
          keyTakeaways: [],
          hashtags: [],
          cta: "",
          visualPrompts: [],
        }),
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
    // En révision (chatbot), c'est l'article + la consigne qui comptent, pas `input`.
    const needsInput = body.mode !== "revise";
    if (!body.companyId || (needsInput && !body.input?.trim())) {
      return NextResponse.json({ error: "companyId et input requis" }, { status: 400 });
    }
    if (body.mode === "revise" && !body.article) {
      return NextResponse.json({ error: "article requis pour la révision" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(body.companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const brand = await loadBrandContext(body.companyId, body.useMemory === true);

    if (body.mode === "prompt") {
      const prompt = await generatePrompt(body, brand);
      return NextResponse.json({ prompt, aiGenerated: isAiConfigured });
    }

    // Mode chatbot : ajuste l'article courant selon la consigne (sous la limite).
    if (body.mode === "revise") {
      if (!isAiConfigured) {
        return NextResponse.json({ error: "IA non configurée (ANTHROPIC_API_KEY)." }, { status: 503 });
      }
      const client = new Anthropic({ apiKey: env.anthropicKey });
      const { article, aiGenerated, changed } = await reviseArticle(body, client);
      return NextResponse.json({ article, aiGenerated, changed, length: assembledPostText(article).length });
    }

    const { article, aiGenerated } = await generateArticle(body, brand);
    return NextResponse.json({ article, aiGenerated, length: assembledPostText(article).length });
  } catch (e) {
    console.error("[POST /api/ai/linkedin-article]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
