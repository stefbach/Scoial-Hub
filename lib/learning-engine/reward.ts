// lib/learning-engine/reward.ts
//
// Normalisation de métriques brutes en un reward [0,1] par dimension, pour
// alimenter le bandit bayésien (lib/learning-engine/bandit.ts). Un reward est
// TOUJOURS un taux relatif borné, jamais une valeur brute non plafonnée — un
// pic isolé ne doit pas saturer l'apprentissage.

export type LearningDimension =
  | "time_slot"
  | "ad_campaign"
  | "creative_format"
  | "ad_audience"
  | "ad_budget_tier";

function clip01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/**
 * Post/story organique : taux d'engagement = interactions / portée.
 * Sans portée connue, repli sur une échelle logarithmique douce (plafonnée à
 * 1 aux alentours de 50 interactions) plutôt que de renvoyer 0.
 */
export function engagementReward(metrics: {
  reactions?: number;
  comments?: number;
  shares?: number;
  linkClicks?: number;
  reach?: number;
}): number {
  const interactions =
    (metrics.reactions ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0) + (metrics.linkClicks ?? 0);
  const reach = metrics.reach ?? 0;
  if (reach > 0) return clip01(interactions / reach);
  return clip01(Math.log10(1 + interactions) / Math.log10(51));
}

/**
 * Publicité : combine CTR et taux de conversion (poids par défaut 40/60 —
 * la conversion compte davantage qu'un simple clic). CTR normalisé sur un
 * plafond réaliste de 10 % (au-delà, considéré excellent = score 1).
 */
export function adReward(
  metrics: { impressions?: number; clicks?: number; conversions?: number },
  weights: { ctr?: number; convRate?: number } = {}
): number {
  const impressions = metrics.impressions ?? 0;
  if (impressions <= 0) return 0;
  const clicks = metrics.clicks ?? 0;
  const conversions = metrics.conversions ?? 0;

  const ctr = clicks / impressions;
  const convRate = clicks > 0 ? conversions / clicks : 0;
  const ctrScore = clip01(ctr / 0.1);
  const convScore = clip01(convRate);

  const wCtr = weights.ctr ?? 0.4;
  const wConv = weights.convRate ?? 0.6;
  return clip01(wCtr * ctrScore + wConv * convScore);
}
