/**
 * lib/quota/video-seconds.ts
 *
 * Application du quota de vidéo générée par IA (cf. lib/plans.ts et la migration
 * 0011). Server-only : passe par le client service_role.
 *
 * Le décompte se fait à la RÉSERVATION, avant de lancer la génération, via une
 * fonction SQL qui verrouille la ligne du compteur. Compter après coup laisserait
 * passer les demandes concurrentes ; compter en JS après lecture ferait la même
 * chose plus discrètement.
 *
 * Dégradation gracieuse : sans Supabase (dev/démo), tout est autorisé — l'app
 * n'appelle alors aucun fournisseur payant.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { usagePeriod, videoSecondsQuota, toPlanId, PLAN_LABEL, type PlanId } from "@/lib/plans";

export interface QuotaDecision {
  allowed: boolean;
  /** Secondes consommées sur la période (après réservation si accordée). */
  used: number;
  /** Plafond mensuel applicable. */
  quota: number;
  /** Secondes encore disponibles. */
  remaining: number;
  /** Secondes demandées par cet appel. */
  requested: number;
  plan: PlanId;
  /** Message prêt à afficher quand la demande est refusée. */
  reason?: string;
}

interface CompanyPlanRow {
  plan?: string | null;
  video_seconds_quota?: number | null;
}

/** Lit la formule et le plafond éventuel de la société. */
async function readPlan(companyUuid: string): Promise<{ plan: PlanId; quota: number }> {
  const sb = createAdminClient();
  if (!sb) return { plan: toPlanId(undefined), quota: 0 };
  const { data } = await sb
    .from("sh_companies")
    .select("plan, video_seconds_quota")
    .eq("id", companyUuid)
    .maybeSingle();
  const row = (data ?? {}) as CompanyPlanRow;
  return {
    plan: toPlanId(row.plan),
    quota: videoSecondsQuota(row.plan, row.video_seconds_quota),
  };
}

function refusal(plan: PlanId, quota: number, used: number, requested: number): string {
  if (quota === 0) {
    return (
      `La génération de vidéo par IA n'est pas incluse dans la formule ${PLAN_LABEL[plan]}. ` +
      `Passez en Studio pour en disposer, ou utilisez le montage de vos propres médias, illimité.`
    );
  }
  const left = Math.max(0, quota - used);
  return (
    `Quota de vidéo IA atteint : ${used} s utilisées sur ${quota} s ce mois-ci, ` +
    `et il en reste ${left} s pour une demande de ${requested} s. ` +
    `Le compteur repart le 1er du mois prochain ; des secondes supplémentaires peuvent être ajoutées.`
  );
}

/**
 * Réserve `requested` secondes pour la société, ou refuse.
 *
 * En cas d'accord, la consommation est DÉJÀ enregistrée : l'appelant doit
 * appeler `refundVideoSeconds` si la génération n'a finalement pas démarré.
 */
export async function reserveVideoSeconds(
  companyUuid: string,
  requested: number,
  now: Date = new Date()
): Promise<QuotaDecision> {
  const seconds = Math.max(1, Math.ceil(requested));

  // Sans base, aucun fournisseur payant n'est appelé : ne rien bloquer.
  if (!isSupabaseConfigured) {
    return { allowed: true, used: 0, quota: 0, remaining: 0, requested: seconds, plan: toPlanId(undefined) };
  }

  const sb = createAdminClient();
  if (!sb) {
    return { allowed: true, used: 0, quota: 0, remaining: 0, requested: seconds, plan: toPlanId(undefined) };
  }

  const { plan, quota } = await readPlan(companyUuid);
  const period = usagePeriod(now);

  const { data, error } = await sb.rpc("sh_reserve_video_seconds", {
    p_company: companyUuid,
    p_period: period,
    p_seconds: seconds,
    p_quota: quota,
  });

  if (error) {
    // Deux situations très différentes se cachent derrière une erreur ici.
    //
    // 1. La fonction SQL n'EXISTE PAS ENCORE : la migration 0011 n'est pas
    //    appliquée sur cet environnement. Refuser reviendrait à couper la
    //    génération vidéo partout tant que la migration n'a pas été jouée —
    //    alors qu'avant cette migration il n'y avait de toute façon aucun
    //    plafond. On laisse donc passer, en le signalant bruyamment : le quota
    //    s'activera de lui-même dès que la migration sera appliquée.
    //
    // 2. Toute autre erreur (panne, permission) : on REFUSE. Laisser passer
    //    exposerait précisément le poste de coût que ce quota existe pour
    //    contenir.
    const notDeployed =
      error.code === "PGRST202" ||
      error.code === "42883" ||
      /could not find the function|does not exist/i.test(error.message ?? "");

    if (notDeployed) {
      console.warn(
        "[quota/video] Migration 0011 non appliquée : sh_reserve_video_seconds est absente. " +
          "La génération vidéo passe SANS PLAFOND jusqu'à son application."
      );
      return { allowed: true, used: 0, quota, remaining: quota, requested: seconds, plan };
    }

    console.error("[quota/video] sh_reserve_video_seconds:", error.message);
    return {
      allowed: false,
      used: 0,
      quota,
      remaining: 0,
      requested: seconds,
      plan,
      reason: "Le décompte du quota vidéo est momentanément indisponible. Réessayez dans quelques instants.",
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed?: boolean; used?: number; quota?: number }
    | undefined;
  const used = Number(row?.used ?? 0);
  const allowed = Boolean(row?.allowed);

  return {
    allowed,
    used,
    quota,
    remaining: Math.max(0, quota - used),
    requested: seconds,
    plan,
    reason: allowed ? undefined : refusal(plan, quota, used, seconds),
  };
}

/**
 * Associe une réservation accordée à l'identifiant de prédiction, pour pouvoir
 * la rembourser si la génération échoue. Non bloquant : un échec d'écriture
 * signifie seulement qu'on ne remboursera pas — jamais que l'appel échoue.
 */
export async function recordVideoReservation(
  predictionId: string,
  companyUuid: string,
  seconds: number,
  now: Date = new Date()
): Promise<void> {
  if (!isSupabaseConfigured || !predictionId) return;
  const sb = createAdminClient();
  if (!sb) return;
  const { error } = await sb.from("sh_video_reservations").insert({
    prediction_id: predictionId,
    company_id: companyUuid,
    period: usagePeriod(now),
    seconds: Math.max(1, Math.ceil(seconds)),
  });
  if (error) console.error("[quota/video] recordVideoReservation:", error.message);
}

/**
 * Rend les secondes d'une génération qui a échoué. Idempotent, et sans
 * company_id fourni par l'appelant : la réservation porte elle-même la société,
 * donc un identifiant de prédiction d'autrui ne peut pas créditer le mauvais
 * compte. Renvoie le nombre de secondes effectivement rendues.
 */
export async function refundVideoSeconds(predictionId: string): Promise<number> {
  if (!isSupabaseConfigured || !predictionId) return 0;
  const sb = createAdminClient();
  if (!sb) return 0;
  const { data, error } = await sb.rpc("sh_refund_video_seconds", { p_prediction: predictionId });
  if (error) {
    console.error("[quota/video] sh_refund_video_seconds:", error.message);
    return 0;
  }
  return Number(data ?? 0);
}

/** État du quota d'une société, sans rien consommer (affichage). */
export async function readVideoQuota(
  companyUuid: string,
  now: Date = new Date()
): Promise<{ used: number; quota: number; remaining: number; plan: PlanId }> {
  const fallback = { used: 0, quota: 0, remaining: 0, plan: toPlanId(undefined) };
  if (!isSupabaseConfigured) return fallback;
  const sb = createAdminClient();
  if (!sb) return fallback;

  const { plan, quota } = await readPlan(companyUuid);
  const { data } = await sb
    .from("sh_video_usage")
    .select("seconds_used")
    .eq("company_id", companyUuid)
    .eq("period", usagePeriod(now))
    .maybeSingle();

  const used = Number((data as { seconds_used?: number } | null)?.seconds_used ?? 0);
  return { used, quota, remaining: Math.max(0, quota - used), plan };
}
