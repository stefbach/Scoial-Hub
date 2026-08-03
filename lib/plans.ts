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
  presence: 0,
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
