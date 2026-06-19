// Prompt engineering « cabinet d'élite » injecté dans la demande envoyée à MiroFish.
// MiroFish exécute la simulation avec SON propre LLM ; notre levier est le TEXTE
// de la demande de simulation + le contexte additionnel (le « seed »).

export interface StudioBrief {
  product: string;
  audience: string;
  message?: string;
  market?: string;
  trends?: string;
  brand?: string;
}

const ELITE_FRAME = `Tu opères comme une équipe de conseil stratégique d'élite (calibre KPMG / McKinsey / BCG / Bain). \
Standard de livrable : niveau comité exécutif (C-level). Exigences : rigueur analytique, neutralité, \
hypothèses explicites, segmentation fine de l'audience, dynamiques d'influence réalistes, quantification \
prudente (fourchettes, pas de fausse précision), et recommandations actionnables hiérarchisées (impact × effort). \
Évite tout biais commercial complaisant : un bon conseil identifie aussi les risques, objections et angles morts.`;

/** Demande de simulation (champ principal lu par MiroFish). */
export function buildSimulationRequirement(brief: StudioBrief): string {
  return `${ELITE_FRAME}

MISSION : Simuler la réception, par le marché cible, du lancement / de la mise en avant suivante, puis en déduire une PRÉDICTION argumentée et des recommandations exécutives.

- Produit / offre : ${brief.product}
- Audience cible : ${brief.audience}${brief.market ? `\n- Marché / zone : ${brief.market}` : ""}${brief.message ? `\n- Message / angle envisagé : ${brief.message}` : ""}${brief.brand ? `\n- Marque : ${brief.brand}` : ""}

ATTENDU : personas représentatifs et crédibles, simulation de leurs réactions et interactions (bouche-à-oreille, objections, adhésion), puis un rapport structuré : synthèse exécutive, segmentation, prédiction de réception (avec niveau de confiance), angles gagnants, risques/objections, recommandations priorisées. Rédige en français.`;
}

/** Contexte additionnel (« seed ») : tendances + cadrage méthodologique. */
export function buildAdditionalContext(brief: StudioBrief): string {
  const trends = (brief.trends ?? "").trim();
  return `Contexte de marché et tendances actuelles à intégrer :
${trends || "(non fourni — déduis le contexte le plus plausible pour ce marché et cette audience.)"}

Méthodologie attendue : raisonnement structuré, hypothèses explicites, prise en compte des dynamiques sociales (leaders d'opinion, effets de réseau, saturation publicitaire), et lecture critique (ce qui pourrait échouer).`;
}

/** Préambule conservé pour le chat avec l'analyste (ReportAgent). */
export function consultingChatPreamble(): string {
  return "Réponds comme un consultant stratégique d'élite (niveau C-level) : concis, structuré, étayé, et honnête sur l'incertitude.";
}
