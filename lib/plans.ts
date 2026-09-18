/**
 * lib/plans.ts
 *
 * Formules commerciales et plafonds associés. Source de vérité unique, partagée
 * par la page tarifs et l'application du quota côté serveur : un chiffre affiché
 * au client et un chiffre appliqué qui divergeraient seraient un engagement non
 * tenu.
 *
 * Seule la VIDÉO GÉNÉRÉE par IA est plafonnée. Publications, visuels et montages
 * de médias fournis par le client restent illimités : leur coût unitaire (de
 * l'ordre du centime) ne justifie aucun compteur.
 *
 * Module pur — aucun import serveur, utilisable des deux côtés.
 */

export const PLAN_IDS = ["executive", "presence", "studio", "agence"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** Formule appliquée quand la société n'en porte aucune (ou une inconnue). */
export const DEFAULT_PLAN: PlanId = "presence";

/** Secondes de vidéo générée par IA autorisées par mois calendaire (UTC). */
export const PLAN_VIDEO_SECONDS: Record<PlanId, number> = {
  executive: 0,
  presence: 60,
  studio: 60,
  agence: 180,
};

/**
 * Sièges (utilisateurs de l'organisation) autorisés par formule.
 * `Infinity` = illimité, tel qu'annoncé sur la page tarifs.
 */
export const PLAN_USERS: Record<PlanId, number> = {
  executive: 2,
  presence: 5,
  studio: Infinity,
  agence: Infinity,
};

/**
 * Nombre de sièges d'une organisation : le PLUS ÉLEVÉ des plafonds de ses
 * sociétés. Une organisation qui paie Studio sur une marque ne doit pas se voir
 * appliquer le plafond d'une autre marque restée en Présence.
 */
export function seatLimitForPlans(plans: unknown[]): number {
  if (plans.length === 0) return PLAN_USERS[DEFAULT_PLAN];
  return Math.max(...plans.map((p) => PLAN_USERS[toPlanId(p)]));
}

/**
 * Formules autorisées à débrider les modèles vidéo premium (Veo 3/3.1, Kling,
 * Seedance Pro — Replicate et Higgsfield confondus) via l'achat de crédits.
 * Vérité SERVEUR : `allowPremiumVideo` envoyé par le client (Studio Créatif /
 * Compose) ne doit jamais suffire seul, cf. lib/ai/model-catalog.ts et
 * app/api/ai/generate-video/route.ts.
 */
export const PLAN_ALLOWS_PREMIUM_VIDEO: Record<PlanId, boolean> = {
  executive: false,
  presence: false,
  studio: true,
  agence: true,
};

/** Vrai si la formule peut débrider les modèles vidéo premium. */
export function planAllowsPremiumVideo(plan: unknown): boolean {
  return PLAN_ALLOWS_PREMIUM_VIDEO[toPlanId(plan)];
}

/**
 * Résout l'autorisation premium RÉELLE à partir d'une demande client et du
 * plan de la société — jamais la demande seule. Extrait en fonction pure pour
 * que app/api/ai/generate-video/route.ts (le point d'application) reste
 * testable sans base de données ; voir scripts/verify-video-premium-gate.ts.
 */
export function resolveAllowPremiumVideo(requested: boolean | undefined, plan: unknown): boolean {
  return Boolean(requested) && planAllowsPremiumVideo(plan);
}

/**
 * Tarif des crédits vidéo — UNIQUE, quel que soit le modèle (inclus ou
 * premium). Vérifié contre les coûts réels fournisseurs (Replicate, Higgsfield
 * — septembre 2026) : même le cas le plus cher du catalogue (Veo 3 avec son,
 * ~2,94 €/clip de 8 s) reste couvert avec une marge ≥ ×4 à ce tarif, la
 * plupart des autres modèles entre ×10 et ×20. Pondérer par modèle
 * n'apporterait rien de mesurable pour l'instant — à revérifier si les tarifs
 * fournisseurs bougent significativement.
 *
 * 1 crédit = 1 seconde de vidéo générée (même unité que le quota mensuel
 * inclus dans chaque formule, cf. PLAN_VIDEO_SECONDS) — un crédit acheté
 * s'additionne au quota du mois, il ne le remplace pas et ne périme pas.
 */
export const VIDEO_CREDIT_RATE_RS = 75;
export const VIDEO_CREDIT_RATE_EUR = 1.5;

export interface CreditPack {
  id: string;
  seconds: number;
  rs: number;
  eur: number;
}

/** Packs proposés — mêmes 75 Rs / 1,50 € par seconde, avec une remise de volume affichée. */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "decouverte", seconds: 100, rs: 100 * VIDEO_CREDIT_RATE_RS, eur: 100 * VIDEO_CREDIT_RATE_EUR },
  { id: "studio", seconds: 500, rs: 33_750, eur: 675 },
  { id: "agence", seconds: 1500, rs: 90_000, eur: 1800 },
];

/** Libellé commercial de la formule. */
export const PLAN_LABEL: Record<PlanId, string> = {
  executive: "LinkedIn Executive",
  presence: "Présence",
  studio: "Studio",
  agence: "Agence",
};

/** Vrai si la valeur correspond à une formule connue. */
export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/** Normalise une valeur venue de la base en formule exploitable. */
export function toPlanId(value: unknown): PlanId {
  return isPlanId(value) ? value : DEFAULT_PLAN;
}

/**
 * Plafond mensuel applicable : le quota explicite de la société l'emporte sur
 * celui de sa formule (geste commercial, période d'essai), y compris à 0.
 */
export function videoSecondsQuota(plan: unknown, override?: number | null): number {
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
    return Math.floor(override);
  }
  return PLAN_VIDEO_SECONDS[toPlanId(plan)];
}

/** Période de décompte d'une date : mois calendaire UTC, au format 'YYYY-MM'. */
export function usagePeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
