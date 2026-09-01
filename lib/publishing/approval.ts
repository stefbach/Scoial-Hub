/**
 * lib/publishing/approval.ts
 *
 * Workflow de validation (retour client Rosiane #5) : « le Community Manager
 * crée et programme les publications, puis le responsable marketing les
 * vérifie et les approuve avant publication. Il peut être activé ou
 * désactivé selon les préférences de chaque entreprise. »
 *
 * Aucun nouveau concept de rôle : un « responsable » est un owner/admin de
 * l'organisation (isAccountAdmin), un « Community Manager » un member —
 * cf. lib/rbac/types.ts, déjà en place.
 */

import { getCompany } from "@/lib/repositories/companies";
import { isAccountAdmin, type OrgRole } from "@/lib/rbac/types";
import type { ScheduledPost } from "@/lib/types";

/**
 * Statut à appliquer pour une demande de programmation ("scheduled").
 *
 * Un member qui programme une publication dans une société où le workflow
 * est actif est mis EN ATTENTE ("pending_approval") au lieu de partir
 * directement ; un owner/admin, ou une société sans le workflow actif,
 * programme normalement. Tout statut autre que "scheduled" (draft, etc.)
 * traverse inchangé — seule la mise en circulation réelle est concernée.
 */
export async function resolveScheduleStatus(
  companyId: string,
  requestedStatus: ScheduledPost["status"] | undefined,
  role: OrgRole | undefined
): Promise<ScheduledPost["status"] | undefined> {
  if (requestedStatus !== "scheduled") return requestedStatus;
  if (isAccountAdmin(role)) return requestedStatus;

  const company = await getCompany(companyId).catch(() => null);
  if (!company?.approvalWorkflowEnabled) return requestedStatus;

  return "pending_approval";
}
