// lib/learning-engine/index.ts
//
// Moteur d'apprentissage quantitatif : Thompson Sampling bayésien par bras
// (ex. campagne pub, créneau horaire, format créatif), appris à partir des
// performances RÉELLEMENT mesurées. Il COMPLÈTE — sans la remplacer — la
// mémoire stratégique textuelle (lib/memory) : celle-ci reste la couche
// qualitative injectée dans les prompts LLM ; celle-ci est la couche
// quantitative, statistique et auditable (sh_learning_events).
//
// - recommend()     : choisit un bras parmi des candidats (exploration/exploitation)
// - recordOutcome()  : met à jour l'apprentissage à partir d'un résultat mesuré

import { selectArm, updateArm, armMean, armSampleSize, type RandomFn } from "./bandit";
import { loadArms, listArms, saveArm, logEvent } from "./store";
import type { LearningDimension } from "./reward";

export type { LearningDimension } from "./reward";
export { engagementReward, adReward } from "./reward";
export { armMean, armSampleSize } from "./bandit";

export interface RecommendationCandidate {
  armKey: string;
  meta?: Record<string, unknown>;
}

export interface Recommendation {
  armKey: string;
  meta?: Record<string, unknown>;
  /** Espérance apprise du bras choisi (0.5 = prior neutre, cold start). */
  confidence: number;
  /** Nombre de résultats mesurés ayant contribué à ce choix. */
  sampleSize: number;
  source: "learned" | "cold_start";
}

/**
 * En dessous de ce total d'échantillons (cumulés sur TOUS les candidats), le
 * signal est trop mince pour qu'un tirage bayésien soit fiable : on retombe
 * sur le premier candidat plutôt que de faire confiance à un prior non
 * informé — même logique de repli que lib/publishing/best-time.ts.
 */
const MIN_SAMPLES_FOR_LEARNING = 3;

export async function recommend(
  companyId: string,
  dimension: LearningDimension,
  candidates: RecommendationCandidate[],
  /** Injectable pour un déterminisme total en test — cf. scripts/verify-learning-engine.ts. */
  rng: RandomFn = Math.random
): Promise<Recommendation | null> {
  if (candidates.length === 0) return null;

  const arms = await loadArms(companyId, dimension, candidates.map((c) => c.armKey));
  const totalSamples = arms.reduce((sum, a) => sum + armSampleSize(a), 0);

  if (totalSamples < MIN_SAMPLES_FOR_LEARNING) {
    const first = candidates[0];
    return { armKey: first.armKey, meta: first.meta, confidence: 0.5, sampleSize: 0, source: "cold_start" };
  }

  const chosen = selectArm(arms, rng);
  const candidate = candidates.find((c) => c.armKey === chosen.armKey);
  return {
    armKey: chosen.armKey,
    meta: candidate?.meta,
    confidence: armMean(chosen),
    sampleSize: armSampleSize(chosen),
    source: "learned",
  };
}

export interface BestArm {
  armKey: string;
  confidence: number;
  sampleSize: number;
}

/**
 * Meilleur bras PROUVÉ pour une dimension (optionnellement filtrée par
 * préfixe de clé), c.-à-d. l'espérance apprise la plus haute parmi les bras
 * ayant individuellement atteint `minSamples` — pas un choix bandit
 * exploration/exploitation (`recommend`), mais un classement direct. Adapté
 * à un espace de bras large et majoritairement non mesuré (ex. 168 créneaux
 * horaire×jour possibles) où Thompson Sampling choisirait trop souvent un
 * bras jamais mesuré. Renvoie `null` si aucun bras n'atteint le seuil.
 */
export async function bestLearnedArm(
  companyId: string,
  dimension: LearningDimension,
  armKeyPrefix = "",
  minSamples = MIN_SAMPLES_FOR_LEARNING
): Promise<BestArm | null> {
  const arms = await listArms(companyId, dimension, armKeyPrefix);
  let best: { armKey: string; alpha: number; beta: number } | null = null;
  let bestMean = -Infinity;
  for (const arm of arms) {
    if (armSampleSize(arm) < minSamples) continue;
    const mean = armMean(arm);
    if (mean > bestMean) {
      bestMean = mean;
      best = arm;
    }
  }
  if (!best) return null;
  return { armKey: best.armKey, confidence: armMean(best), sampleSize: armSampleSize(best) };
}

/** Enregistre un résultat mesuré : met à jour l'apprentissage + journal d'audit. */
export async function recordOutcome(
  companyId: string,
  dimension: LearningDimension,
  armKey: string,
  reward: number,
  rawMetrics: Record<string, unknown> = {}
): Promise<void> {
  const [arm] = await loadArms(companyId, dimension, [armKey]);
  const updated = updateArm(arm, reward);
  await Promise.all([
    saveArm(companyId, dimension, updated),
    logEvent(companyId, dimension, armKey, reward, rawMetrics),
  ]);
}
