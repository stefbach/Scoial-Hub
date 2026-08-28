/**
 * lib/quota/seats.ts
 *
 * Plafond de SIÈGES (utilisateurs d'une organisation), tel qu'annoncé sur la
 * page tarifs — 2 en LinkedIn Executive, 5 en Présence, illimité au-delà.
 * Server-only : passe par le client service_role.
 *
 * Les invitations EN ATTENTE comptent comme des sièges : sans cela, on
 * contournerait le plafond en invitant sans limite, chaque acceptation faisant
 * ensuite dépasser le compte sans qu'aucun contrôle ne se déclenche.
 *
 * Le plafond d'une organisation est le PLUS ÉLEVÉ de ceux de ses sociétés :
 * payer Studio sur une marque ne doit pas être puni parce qu'une autre marque
 * est restée en Présence.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { seatLimitForPlans, PLAN_USERS, DEFAULT_PLAN } from "@/lib/plans";

export interface SeatCheck {
  allowed: boolean;
  /** Sièges déjà occupés : membres actifs + invitations en attente. */
  used: number;
  /** Plafond applicable (Infinity si illimité). */
  limit: number;
  /** Message prêt à afficher quand l'ajout est refusé. */
  reason?: string;
}

const UNLIMITED: SeatCheck = { allowed: true, used: 0, limit: Infinity };

/**
 * Vérifie qu'un siège supplémentaire tient dans le plafond de l'organisation.
 *
 * Ne bloque jamais par défaut : sans base, ou si la colonne `plan` n'existe pas
 * encore (migration 0011 non appliquée), on laisse passer. Refuser dans ces cas
 * empêcherait d'ajouter un collaborateur pour une limite qui n'existait pas
 * auparavant — même raisonnement que pour le quota vidéo.
 */
export async function checkSeatAvailable(orgId: string): Promise<SeatCheck> {
  if (!isSupabaseConfigured || !orgId) return UNLIMITED;
  const sb = createAdminClient();
  if (!sb) return UNLIMITED;

  const [companies, memberships, invitations] = await Promise.all([
    sb.from("sh_companies").select("plan").eq("org_id", orgId),
    sb.from("sh_memberships").select("user_id, status").eq("org_id", orgId),
    sb.from("sh_invitations").select("id, status").eq("org_id", orgId),
  ]);

  // Colonne `plan` absente → schéma pas encore migré : aucun plafond à appliquer.
  if (companies.error) {
    console.warn("[quota/seats] plan illisible, aucun plafond appliqué :", companies.error.message);
    return UNLIMITED;
  }

  const plans = (companies.data ?? []).map((c) => (c as { plan?: string }).plan);
  const limit = seatLimitForPlans(plans);
  if (!Number.isFinite(limit)) return { allowed: true, used: 0, limit };

  const activeMembers = (memberships.data ?? []).filter(
    (m) => (m as { status?: string }).status !== "revoked"
  ).length;
  const pendingInvites = (invitations.data ?? []).filter(
    (i) => ((i as { status?: string }).status ?? "pending") === "pending"
  ).length;

  const used = activeMembers + pendingInvites;
  if (used + 1 <= limit) return { allowed: true, used, limit };

  return {
    allowed: false,
    used,
    limit,
    reason:
      `Votre formule inclut ${limit} utilisateur${limit > 1 ? "s" : ""} et ${used} ` +
      `${used > 1 ? "sont déjà occupés" : "est déjà occupé"} (invitations en attente comprises). ` +
      `Passez à une formule supérieure pour ajouter un collaborateur.`,
  };
}

/** Plafond de sièges d'une formule, pour l'affichage. */
export function seatsForPlan(plan: unknown): number {
  return PLAN_USERS[typeof plan === "string" && plan in PLAN_USERS ? (plan as keyof typeof PLAN_USERS) : DEFAULT_PLAN];
}
