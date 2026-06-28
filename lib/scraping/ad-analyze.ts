// Analyse IA (Claude) de la stratégie publicitaire à partir des pubs Ad Library.
// Dégradation gracieuse : modèle déterministe si ANTHROPIC_API_KEY absent.

import { env, isAiConfigured } from "@/lib/env";
import type { AdEntry } from "./ad-library";

export interface AdStrategyAnalysis {
  resume: string;
  anglesDominants: { angle: string; exemples: string[] }[];
  offres: string[];
  ctas: string[];
  pourquoiPerformantes: string[];
  recommandations: { titre: string; detail: string }[];
  aiGenerated: boolean;
}

function buildMock(ads: AdEntry[]): AdStrategyAnalysis {
  const pages = [...new Set(ads.map((a) => a.pageName).filter(Boolean))].slice(0, 5);
  return {
    resume: `Analyse de ${ads.length} publicités. Les annonceurs (${pages.join(", ") || "divers"}) misent sur des messages clairs, des offres concrètes et des appels à l'action directs, avec une diffusion multi-plateformes Facebook/Instagram.`,
    anglesDominants: [
      { angle: "Bénéfice concret / résultat", exemples: ["Promesse de résultat", "Avant/après"] },
      { angle: "Urgence & rareté", exemples: ["Offre limitée", "Places limitées"] },
      { angle: "Preuve sociale & autorité", exemples: ["Témoignages", "Chiffres"] },
    ],
    offres: ["Réduction / promotion", "Essai ou consultation gratuite", "Contenu offert (guide, webinaire)"],
    ctas: ["En savoir plus", "Réserver / Prendre RDV", "S'inscrire", "Envoyer un message"],
    pourquoiPerformantes: [
      "Message bénéfice en première ligne, lisible en 1 seconde.",
      "Appel à l'action unique et explicite.",
      "Ciblage et diffusion réguliers (impressions élevées = budget soutenu).",
    ],
    recommandations: [
      { titre: "Tester un angle bénéfice fort", detail: "Reprendre l'angle dominant des concurrents en l'adaptant à votre promesse unique." },
      { titre: "Clarifier le CTA", detail: "Un seul appel à l'action explicite par publicité." },
    ],
    aiGenerated: false,
  };
}

export async function analyzeAds(
  ads: AdEntry[],
  context: { country?: string; terms?: string; language?: "fr" | "en" }
): Promise<AdStrategyAnalysis> {
  const language: "fr" | "en" = context.language === "en" ? "en" : "fr";
  if (!isAiConfigured || ads.length === 0) return buildMock(ads);

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const { createClaudeMessage } = await import("@/lib/ai/anthropic");
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const sample = ads.slice(0, 20).map((a) => ({
      page: a.pageName,
      titre: a.linkTitle,
      texte: a.body.slice(0, 220),
      impressions: a.impressionsHigh,
      depense: a.spendHigh,
      plateformes: a.platforms,
    }));

    const prompt = `Tu es un expert en publicité social media (Facebook/Instagram Ads). Analyse ces ${ads.length} publicités concurrentes réelles (zone : ${context.country || "?"}, recherche : "${context.terms || ""}") et déduis leur STRATÉGIE publicitaire et ce qui les rend performantes.

Publicités (échantillon JSON) :
${JSON.stringify(sample, null, 2)}

Produis UNIQUEMENT ce JSON strict (aucun texte autour) :
{
  "resume": "2-3 phrases : la stratégie publicitaire dominante observée",
  "anglesDominants": [ { "angle": "string", "exemples": ["string"] } ],
  "offres": ["types d'offres/promesses récurrentes"],
  "ctas": ["appels à l'action les plus utilisés"],
  "pourquoiPerformantes": ["raisons concrètes pour lesquelles ces pubs marchent"],
  "recommandations": [ { "titre": "string", "detail": "string" } ]
}

Règles : max 4 anglesDominants, max 5 offres, max 5 ctas, max 5 pourquoiPerformantes, max 4 recommandations. ${language === "en" ? "Write ALL textual values in ENGLISH" : "Réponds en français"}, concret et actionnable.`;

    const message = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("JSON manquant");
    const parsed = JSON.parse(m[0]) as Omit<AdStrategyAnalysis, "aiGenerated">;
    return { ...parsed, aiGenerated: true };
  } catch (err) {
    console.warn("[ad-analyze] fallback mock:", err);
    return buildMock(ads);
  }
}
