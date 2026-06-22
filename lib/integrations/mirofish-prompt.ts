// Prompt engineering du moteur PREMIUM (MiroFish).
// MiroFish exécute la simulation avec SON propre LLM ; notre levier est le TEXTE
// de la « demande de simulation » et le « contexte additionnel » qu'on lui passe.
// On y injecte un cadrage « cabinet de conseil d'élite » (type KPMG/McKinsey/BCG)
// pour que la génération des personas, des dynamiques et du rapport adopte la
// rigueur, la structure et le niveau d'exigence d'un livrable C-level.

export interface MirofishBrief {
  /** Produit / offre à mettre en avant. */
  product: string;
  /** Audience cible. */
  audience: string;
  /** Message / angle envisagé (optionnel). */
  message?: string;
  /** Marché / zone géographique (optionnel). */
  market?: string;
  /** Tendances actuelles, idéalement issues de la Veille (optionnel). */
  trends?: string;
  /** Nom de la marque / société. */
  brand?: string;
  /** Langue de rédaction attendue ("fr" | "en"). */
  language?: string;
}

const ELITE_FRAME_FR = `Tu opères comme une équipe de conseil stratégique d'élite (calibre KPMG / McKinsey / BCG / Bain). \
Standard de livrable : niveau comité exécutif (C-level). Exigences : rigueur analytique, neutralité, \
hypothèses explicites, segmentation fine de l'audience, dynamiques d'influence réalistes, quantification \
prudente (fourchettes, pas de fausse précision), et recommandations actionnables hiérarchisées (impact × effort). \
Évite tout biais commercial complaisant : un bon conseil identifie aussi les risques, objections et angles morts.`;

const ELITE_FRAME_EN = `You operate as an elite strategy consulting team (KPMG / McKinsey / BCG / Bain calibre). \
Deliverable standard: executive committee (C-level) grade. Requirements: analytical rigor, neutrality, \
explicit assumptions, fine-grained audience segmentation, realistic influence dynamics, prudent quantification \
(ranges, no false precision), and prioritized actionable recommendations (impact × effort). \
Avoid complacent commercial bias: good advice also surfaces risks, objections and blind spots.`;

/**
 * Construit la « demande de simulation » (champ principal lu par MiroFish) avec
 * le cadrage cabinet d'élite + l'objectif concret de prédiction marché.
 */
export function buildSimulationRequirement(brief: MirofishBrief): string {
  const fr = brief.language !== "en";
  const frame = fr ? ELITE_FRAME_FR : ELITE_FRAME_EN;
  if (fr) {
    return `${frame}

MISSION : Simuler la réception, par le marché cible, du lancement / de la mise en avant suivante, puis en déduire une PRÉDICTION argumentée et des recommandations exécutives.

- Produit / offre : ${brief.product}
- Audience cible : ${brief.audience}${brief.market ? `\n- Marché / zone : ${brief.market}` : ""}${brief.message ? `\n- Message / angle envisagé : ${brief.message}` : ""}${brief.brand ? `\n- Marque : ${brief.brand}` : ""}

ATTENDU : personas représentatifs et crédibles, simulation de leurs réactions et interactions (bouche-à-oreille, objections, adhésion), puis un rapport structuré : synthèse exécutive, segmentation, prédiction de réception (avec niveau de confiance), angles gagnants, risques/objections, recommandations priorisées. Rédige en français.`;
  }
  return `${frame}

MISSION: Simulate how the target market would receive the following launch / promotion, then derive an evidence-based PREDICTION and executive recommendations.

- Product / offer: ${brief.product}
- Target audience: ${brief.audience}${brief.market ? `\n- Market / area: ${brief.market}` : ""}${brief.message ? `\n- Intended message / angle: ${brief.message}` : ""}${brief.brand ? `\n- Brand: ${brief.brand}` : ""}

EXPECTED: representative, credible personas, simulation of their reactions and interactions (word of mouth, objections, adoption), then a structured report: executive summary, segmentation, reception prediction (with confidence level), winning angles, risks/objections, prioritized recommendations. Write in English.`;
}

/**
 * Contexte additionnel (« seed ») : tendances de la Veille + cadrage méthodo.
 * Sert de matière première au graphe de connaissance de MiroFish.
 */
export function buildAdditionalContext(brief: MirofishBrief): string {
  const fr = brief.language !== "en";
  const trends = (brief.trends ?? "").trim();
  if (fr) {
    return `Contexte de marché et tendances actuelles à intégrer (source : veille concurrentielle et marché) :
${trends || "(non fourni — déduis le contexte le plus plausible pour ce marché et cette audience.)"}

Méthodologie attendue : raisonnement structuré, hypothèses explicites, prise en compte des dynamiques sociales (leaders d'opinion, effets de réseau, saturation publicitaire), et lecture critique (ce qui pourrait échouer).`;
  }
  return `Market context and current trends to incorporate (source: competitive & market intelligence):
${trends || "(not provided — infer the most plausible context for this market and audience.)"}

Expected methodology: structured reasoning, explicit assumptions, social dynamics (opinion leaders, network effects, ad saturation), and critical reading (what could fail).`;
}

/** Question de cadrage envoyée au ReportAgent lors du chat (conserve le ton conseil). */
export function consultingChatPreamble(language?: string): string {
  return language === "en"
    ? "Answer as an elite strategy consultant (C-level grade): concise, structured, evidence-based, and honest about uncertainty."
    : "Réponds comme un consultant stratégique d'élite (niveau C-level) : concis, structuré, étayé, et honnête sur l'incertitude.";
}
