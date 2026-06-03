/**
 * Analyse concurrentielle par IA (Claude).
 *
 * Si ANTHROPIC_API_KEY est configuré, appelle Claude pour produire une analyse
 * structurée à partir des contenus collectés.
 * Sinon, retourne un mock cohérent et déterministe.
 */

import { isAiConfigured, env } from "@/lib/env";
import type { CompetitorContent, ScrapeQuery } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
   Types de sortie
───────────────────────────────────────────────────────────────────────────── */

export interface FormatGagnant {
  type: string;
  network: string;
  engagementMoyen: number;
  description: string;
}

export interface AngleThematique {
  angle: string;
  exemples: string[];
  potentiel: "fort" | "moyen" | "faible";
}

export interface BenchmarkMetrics {
  network: string;
  medianeLikes: number;
  medianeVues: number;
  tauxEngagementMoyen: number;
  fréquencePostsSemaine: number;
}

export interface Recommandation {
  priorite: "haute" | "moyenne" | "basse";
  titre: string;
  detail: string;
  action: string;
}

export interface AnalysisResult {
  /** Résumé exécutif (2-3 phrases). */
  resume: string;
  /** Formats de contenu générant le plus d'engagement. */
  formatsGagnants: FormatGagnant[];
  /** Angles thématiques performants détectés. */
  anglesThematiques: AngleThematique[];
  /** Fréquence de publication recommandée. */
  frequenceRecommandee: string;
  /** Fourchettes d'engagement observées par réseau. */
  benchmarkParReseau: BenchmarkMetrics[];
  /** Recommandations stratégiques actionnables. */
  recommandations: Recommandation[];
  /** Indique si l'analyse est issue de Claude (true) ou du mock (false). */
  aiGenerated: boolean;
  /** Horodatage de l'analyse. */
  analyzedAt: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mock déterministe
───────────────────────────────────────────────────────────────────────────── */

function buildMockAnalysis(query: ScrapeQuery, contents: CompetitorContent[]): AnalysisResult {
  const networks = [...new Set(contents.map((c) => c.network))];
  const theme = query.theme || query.keywords[0] || "votre secteur";

  const benchmarkParReseau: BenchmarkMetrics[] = networks.map((network) => {
    const netContents = contents.filter((c) => c.network === network);
    const avgLikes = netContents.length
      ? Math.round(netContents.reduce((s, c) => s + c.likes, 0) / netContents.length)
      : 0;
    const avgViews = netContents.length
      ? Math.round(netContents.reduce((s, c) => s + c.views, 0) / netContents.length)
      : 0;
    const avgEr = netContents.length
      ? parseFloat((netContents.reduce((s, c) => s + c.engagementRate, 0) / netContents.length).toFixed(4))
      : 0;

    return {
      network,
      medianeLikes: avgLikes,
      medianeVues: avgViews,
      tauxEngagementMoyen: avgEr,
      fréquencePostsSemaine: network === "tiktok" ? 7 : network === "instagram" ? 5 : 3,
    };
  });

  return {
    resume: `L'analyse de ${contents.length} contenus concurrents sur ${networks.join(", ")} révèle que la thématique "${theme}" génère un fort engagement dans la zone ${query.geo.toUpperCase()}. Les formats vidéo courts et les contenus éducatifs dominent les performances.`,
    formatsGagnants: [
      { type: "Vidéo courte (< 60s)", network: "tiktok", engagementMoyen: 0.08, description: "Format dominant — taux d'engagement 2× supérieur aux autres formats." },
      { type: "Carrousel éducatif", network: "instagram", engagementMoyen: 0.06, description: "Sauvegarde élevée, idéal pour contenus à valeur ajoutée." },
      { type: "Thread long", network: "linkedin", engagementMoyen: 0.05, description: "Expertise visible, partages professionnels." },
      { type: "Tutoriel vidéo", network: "youtube", engagementMoyen: 0.04, description: "Longue durée de vie, référencement naturel." },
    ],
    anglesThematiques: [
      { angle: `Coulisses & authenticité autour de "${theme}"`, exemples: ["Behind the scenes", "Processus de création", "Échecs et apprentissages"], potentiel: "fort" },
      { angle: "Chiffres & études de cas sectoriels", exemples: ["Statistiques surprenantes", "Résultats concrets", "Comparatifs"], potentiel: "fort" },
      { angle: "Tutoriels pratiques pas-à-pas", exemples: ["How-to", "Astuces rapides", "Checklist"], potentiel: "moyen" },
      { angle: "Tendances & actualités du secteur", exemples: ["News commentées", "Prédictions", "Hot takes"], potentiel: "moyen" },
    ],
    frequenceRecommandee: "3 à 5 publications/semaine sur Instagram et TikTok, 2 à 3 sur LinkedIn, 1 vidéo YouTube hebdomadaire.",
    benchmarkParReseau,
    recommandations: [
      { priorite: "haute", titre: "Miser sur la vidéo courte", detail: "Les vidéos < 60s génèrent en moyenne 2,4× plus d'engagement que les posts statiques chez vos concurrents.", action: "Créer 3 Reels/TikToks par semaine sur les usages concrets de votre offre." },
      { priorite: "haute", titre: "Augmenter la fréquence de publication", detail: "Vos concurrents publient 4,5× par semaine en moyenne. Vous êtes en dessous de ce rythme.", action: "Mettre en place un calendrier éditorial avec minimum 4 posts/semaine." },
      { priorite: "moyenne", titre: "Exploiter les angles éducatifs", detail: "Les contenus \"comment faire\" génèrent +40 % de sauvegardes, signal fort pour l'algorithme.", action: "Produire une série de posts éducatifs sur les fondamentaux de votre secteur." },
      { priorite: "basse", titre: "Tester les collaborations", detail: "Plusieurs concurrents utilisent les UGC et les collab-posts avec des micro-influenceurs locaux.", action: "Identifier 3 créateurs alignés avec votre marque pour des partenariats test." },
    ],
    aiGenerated: false,
    analyzedAt: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Analyse via Claude
───────────────────────────────────────────────────────────────────────────── */

async function analyzeWithClaude(
  query: ScrapeQuery,
  contents: CompetitorContent[]
): Promise<AnalysisResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: env.anthropicKey });

  // Résumé compact des contenus pour limiter les tokens
  const contentsResume = contents.slice(0, 40).map((c) => ({
    network: c.network,
    type: c.type,
    caption: c.caption.slice(0, 120),
    likes: c.likes,
    comments: c.comments,
    views: c.views,
    engagementRate: c.engagementRate,
    postedAt: c.postedAt,
    simulated: c.simulated ?? false,
  }));

  const prompt = `Tu es un expert en stratégie social media. Analyse ces ${contents.length} contenus concurrents et produis une analyse structurée.

Contexte :
- Thématique : ${query.theme || "non précisée"}
- Mots-clés : ${query.keywords.join(", ") || "aucun"}
- Zone géographique : ${query.geo.toUpperCase()}
- Réseaux analysés : ${[...new Set(contents.map((c) => c.network))].join(", ")}

Contenus (résumé JSON) :
${JSON.stringify(contentsResume, null, 2)}

Produis une analyse JSON stricte avec cette structure exacte (AUCUN texte avant ou après le JSON) :
{
  "resume": "string (2-3 phrases résumant les insights clés)",
  "formatsGagnants": [
    { "type": "string", "network": "string", "engagementMoyen": number, "description": "string" }
  ],
  "anglesThematiques": [
    { "angle": "string", "exemples": ["string"], "potentiel": "fort|moyen|faible" }
  ],
  "frequenceRecommandee": "string",
  "benchmarkParReseau": [
    { "network": "string", "medianeLikes": number, "medianeVues": number, "tauxEngagementMoyen": number, "fréquencePostsSemaine": number }
  ],
  "recommandations": [
    { "priorite": "haute|moyenne|basse", "titre": "string", "detail": "string", "action": "string" }
  ]
}

Réponds en français. Sois précis, concret et actionnable.`;

  const message = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Parse JSON — extraire le bloc JSON si entouré de texte
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude n'a pas retourné de JSON valide");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<AnalysisResult, "aiGenerated" | "analyzedAt">;

  return {
    ...parsed,
    aiGenerated: true,
    analyzedAt: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Point d'entrée principal
───────────────────────────────────────────────────────────────────────────── */

export async function analyzeCompetition(
  query: ScrapeQuery,
  contents: CompetitorContent[]
): Promise<AnalysisResult> {
  if (!isAiConfigured || contents.length === 0) {
    return buildMockAnalysis(query, contents);
  }

  try {
    return await analyzeWithClaude(query, contents);
  } catch (err) {
    console.warn("[analyzeCompetition] Claude failed, fallback mock:", err);
    return buildMockAnalysis(query, contents);
  }
}
