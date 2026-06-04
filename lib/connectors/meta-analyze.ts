// Analyse IA d'une Page (Facebook + Instagram) à partir de ses données réelles,
// pour optimiser la suite : ce qui marche, ce qu'il faut améliorer, formats
// gagnants, cadence, idées de contenu et actions concrètes.

import { isAiConfigured, env } from "@/lib/env";
import type { MetaInsights, MetaPost } from "@/lib/connectors/meta-pages";

export interface ContentIdea {
  titre: string;
  angle: string;
}
export interface ActionItem {
  priorite: "haute" | "moyenne" | "basse";
  action: string;
}
export interface MetaContentAnalysis {
  synthese: string;
  pointsForts: string[];
  aAmeliorer: string[];
  formatsGagnants: string[];
  cadenceRecommandee: string;
  ideesContenu: ContentIdea[];
  actions: ActionItem[];
  aiGenerated: boolean;
  analyzedAt: string;
  /** Agrégats calculés (chiffres réels) affichés à côté de l'analyse. */
  stats: {
    fbFollowers: number;
    igFollowers: number;
    igMedia: number;
    avgEngagementIg: number;
    avgEngagementFb: number;
    postsPerWeek: number;
  };
}

const eng = (p: MetaPost) => (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);

function postsPerWeek(posts: MetaPost[]): number {
  const dates = posts.map((p) => (p.createdAt ? new Date(p.createdAt).getTime() : 0)).filter(Boolean).sort();
  if (dates.length < 2) return 0;
  const spanDays = (dates[dates.length - 1] - dates[0]) / (1000 * 3600 * 24);
  if (spanDays <= 0) return dates.length;
  return Math.round((dates.length / spanDays) * 7 * 10) / 10;
}

function computeStats(ins: MetaInsights): MetaContentAnalysis["stats"] {
  const igAvg = ins.instagramPosts.length
    ? Math.round(ins.instagramPosts.reduce((s, p) => s + eng(p), 0) / ins.instagramPosts.length)
    : 0;
  const fbAvg = ins.facebookPosts.length
    ? Math.round(ins.facebookPosts.reduce((s, p) => s + eng(p), 0) / ins.facebookPosts.length)
    : 0;
  const allPosts = [...ins.facebookPosts, ...ins.instagramPosts];
  return {
    fbFollowers: ins.facebook?.followers ?? 0,
    igFollowers: ins.instagram?.followers ?? 0,
    igMedia: ins.instagram?.mediaCount ?? 0,
    avgEngagementIg: igAvg,
    avgEngagementFb: fbAvg,
    postsPerWeek: postsPerWeek(allPosts),
  };
}

function buildFallback(ins: MetaInsights, stats: MetaContentAnalysis["stats"]): MetaContentAnalysis {
  const topIg = [...ins.instagramPosts].sort((a, b) => eng(b) - eng(a))[0];
  return {
    synthese: `Page suivie par ${stats.fbFollowers} abonnés Facebook et ${stats.igFollowers} sur Instagram. Engagement moyen ~${stats.avgEngagementIg} interactions/post sur Instagram, cadence ~${stats.postsPerWeek} post(s)/semaine.`,
    pointsForts: [
      stats.igFollowers > stats.fbFollowers ? "Audience Instagram solide et active." : "Communauté Facebook établie.",
      topIg ? "Certaines publications génèrent un engagement nettement supérieur." : "Présence régulière sur les réseaux.",
    ],
    aAmeliorer: [
      stats.postsPerWeek < 3 ? "Augmenter la fréquence de publication (objectif 3-5/semaine)." : "Maintenir la régularité.",
      "Standardiser les formats les plus engageants et tester davantage la vidéo courte.",
    ],
    formatsGagnants: ["Vidéo courte / Reels", "Carrousel éducatif", "Avant/après et témoignages"],
    cadenceRecommandee: "3 à 5 publications par semaine, en alternant vidéo courte et carrousels.",
    ideesContenu: [
      { titre: "Conseils pratiques", angle: "Réponses aux questions fréquentes de votre audience." },
      { titre: "Coulisses", angle: "Humaniser la marque avec l'équipe et le quotidien." },
      { titre: "Preuves & résultats", angle: "Témoignages et cas concrets." },
    ],
    actions: [
      { priorite: "haute", action: "Reproduire le format de votre post le plus engageant cette semaine." },
      { priorite: "moyenne", action: "Planifier 4 publications/semaine sur les 4 prochaines semaines." },
      { priorite: "basse", action: "Tester 1 Reel/vidéo courte par semaine et comparer l'engagement." },
    ],
    aiGenerated: false,
    analyzedAt: new Date().toISOString(),
    stats,
  };
}

function summarizePosts(posts: MetaPost[], net: string) {
  return posts
    .slice(0, 10)
    .map((p) => ({
      net,
      caption: (p.message || "").slice(0, 120),
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      shares: p.shares ?? 0,
      date: p.createdAt?.slice(0, 10),
    }));
}

export async function analyzeMetaContent(
  ins: MetaInsights,
  companyName: string
): Promise<MetaContentAnalysis> {
  const stats = computeStats(ins);

  if (!isAiConfigured || (ins.facebookPosts.length === 0 && ins.instagramPosts.length === 0)) {
    return buildFallback(ins, stats);
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const samples = [...summarizePosts(ins.instagramPosts, "instagram"), ...summarizePosts(ins.facebookPosts, "facebook")];

    const prompt = `Tu es un expert en stratégie de contenu social media. Analyse les données RÉELLES de la Page ci-dessous et produis un plan d'OPTIMISATION concret.

Marque : ${companyName}
Facebook : ${stats.fbFollowers} abonnés. Instagram : ${stats.igFollowers} abonnés, ${stats.igMedia} publications.
Engagement moyen : Instagram ${stats.avgEngagementIg}/post, Facebook ${stats.avgEngagementFb}/post. Cadence ~${stats.postsPerWeek} post(s)/semaine.

Échantillon de publications (avec engagement réel) :
${JSON.stringify(samples, null, 2)}

Retourne STRICTEMENT ce JSON (aucun texte autour), en français, concret et spécifique à cette Page :
{
  "synthese": "2-3 phrases : état de la Page et potentiel d'optimisation",
  "pointsForts": ["..."],
  "aAmeliorer": ["..."],
  "formatsGagnants": ["formats/angles qui marchent le mieux selon l'engagement observé"],
  "cadenceRecommandee": "recommandation de fréquence et de rythme",
  "ideesContenu": [ { "titre": "string", "angle": "string" } ],
  "actions": [ { "priorite": "haute|moyenne|basse", "action": "action concrète à faire ensuite" } ]
}
Règles : max 4 pointsForts, 4 aAmeliorer, 4 formatsGagnants, 5 ideesContenu, 5 actions. Base-toi sur les chiffres réels.`;

    const message = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as Partial<MetaContentAnalysis>;

    return {
      synthese: parsed.synthese ?? "",
      pointsForts: (parsed.pointsForts ?? []).slice(0, 4),
      aAmeliorer: (parsed.aAmeliorer ?? []).slice(0, 4),
      formatsGagnants: (parsed.formatsGagnants ?? []).slice(0, 4),
      cadenceRecommandee: parsed.cadenceRecommandee ?? "",
      ideesContenu: (parsed.ideesContenu ?? []).slice(0, 5),
      actions: (parsed.actions ?? []).slice(0, 5),
      aiGenerated: true,
      analyzedAt: new Date().toISOString(),
      stats,
    };
  } catch (err) {
    console.warn("[analyzeMetaContent] fallback:", err);
    return buildFallback(ins, stats);
  }
}
