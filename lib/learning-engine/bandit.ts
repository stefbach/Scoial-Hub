// lib/learning-engine/bandit.ts
//
// Thompson Sampling bayésien sur loi Beta(alpha, beta) : le vrai algorithme
// d'apprentissage du moteur — équilibre exploration (tester un bras encore
// incertain) et exploitation (privilégier le bras dont l'espérance apprise
// est la meilleure), avec une garantie statistique de convergence.
//
// Module pur — aucun accès réseau/base, RNG injectable pour un déterminisme
// total en test (voir scripts/verify-learning-engine.ts).

export interface ArmStat {
  armKey: string;
  /** Succès pondérés cumulés + 1 (prior Beta(1,1) = loi uniforme, aucune donnée). */
  alpha: number;
  /** Échecs pondérés cumulés + 1. */
  beta: number;
}

export type RandomFn = () => number;

/** Prior neutre — aucune donnée observée pour ce bras. */
export function newArm(armKey: string): ArmStat {
  return { armKey, alpha: 1, beta: 1 };
}

/** Nombre d'échantillons ayant contribué à ce bras (alpha+beta-2, prior Beta(1,1) soustrait). */
export function armSampleSize(arm: ArmStat): number {
  return Math.max(0, arm.alpha + arm.beta - 2);
}

/** Espérance apprise du taux de succès de ce bras. */
export function armMean(arm: ArmStat): number {
  return arm.alpha / (arm.alpha + arm.beta);
}

/**
 * Échantillon d'une loi Gamma(shape, 1) — méthode de Marsaglia & Tsang (2000),
 * standard pour générer des Beta via deux Gamma. `shape` doit être > 0.
 */
function sampleGamma(shape: number, rng: RandomFn): number {
  if (shape < 1) {
    // Boost : Gamma(shape) = Gamma(shape+1) * U^(1/shape)
    const u = Math.max(rng(), 1e-12);
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      const u1 = Math.max(rng(), 1e-12);
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // Box-Muller ~ N(0,1)
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Échantillon d'une loi Beta(alpha, beta) via deux tirages Gamma indépendants. */
export function sampleBeta(alpha: number, beta: number, rng: RandomFn = Math.random): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x / (x + y);
}

/**
 * Choisit un bras par Thompson Sampling : tire une valeur de la loi Beta de
 * chaque bras candidat et retient celui au tirage le plus élevé. Un bras peu
 * mesuré a une loi plus étalée (plus de chances d'être exploré) ; un bras
 * mesuré massivement gagnant a une loi resserrée près de son espérance.
 */
export function selectArm(arms: ArmStat[], rng: RandomFn = Math.random): ArmStat {
  if (arms.length === 0) throw new Error("selectArm: aucun bras candidat");
  let best = arms[0];
  let bestSample = -Infinity;
  for (const arm of arms) {
    const sample = sampleBeta(arm.alpha, arm.beta, rng);
    if (sample > bestSample) {
      bestSample = sample;
      best = arm;
    }
  }
  return best;
}

/**
 * Mise à jour bayésienne incrémentale à partir d'un résultat mesuré.
 * `reward` (clippé à [0,1]) est traité comme un succès pondéré plutôt qu'un
 * booléen strict, pour exploiter la granularité d'une métrique normalisée
 * (ex. 0.8 = 80 % de succès) au lieu de la binariser artificiellement.
 */
export function updateArm(arm: ArmStat, reward: number): ArmStat {
  const r = Math.min(1, Math.max(0, reward));
  return { armKey: arm.armKey, alpha: arm.alpha + r, beta: arm.beta + (1 - r) };
}
