// Contrats RBAC partagés (client + serveur).
// Hiérarchie :
//  • Admin générale / pilotage  → console /admin (opérateur de la plateforme) :
//    gère les comptes clients, valide les organisations, facturation à venir.
//  • Compte ADMIN (account-admin) → utilisateur applicatif rôle owner/admin :
//    gère SES sociétés, SON équipe, et les droits d'accès par société.
//  • Utilisateur (member) → accès à une ou plusieurs sociétés, en édition ou
//    lecture, selon ce que décide l'admin du compte.

export type OrgRole = "owner" | "admin" | "member";
export type AccessMode = "edit" | "view";
export type MemberStatus = "active" | "suspended";
export type OrgStatus = "pending" | "approved" | "suspended";
export type InvitationStatus = "pending" | "accepted" | "revoked";

/** Un compte-admin = membre dont le rôle donne les pleins droits sur l'org. */
export function isAccountAdmin(role: OrgRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Accès accordé à un utilisateur sur UNE société. */
export interface CompanyAccessGrant {
  companyId: string;
  mode: AccessMode;
}

/** Membre de l'équipe tel qu'affiché dans « Mon équipe ». */
export interface TeamMember {
  userId: string;
  email: string;
  role: OrgRole;
  status: MemberStatus;
  /** accès par société (édition/lecture). Vide pour un admin = accès total implicite. */
  access: CompanyAccessGrant[];
}

/** Invitation en attente (l'utilisateur n'a pas encore de compte). */
export interface TeamInvitation {
  id: string;
  email: string;
  role: OrgRole;
  access: CompanyAccessGrant[];
  status: InvitationStatus;
  createdAt: string | null;
}

/** Droits effectifs de l'utilisateur courant sur la société active (pour l'UI). */
export interface MyAccess {
  /** rôle dans l'organisation de la société. */
  role: OrgRole | null;
  /** mode effectif sur cette société : 'edit' | 'view' | null (aucun accès). */
  mode: AccessMode | null;
  /** vrai si l'utilisateur est admin du compte (owner/admin). */
  isAccountAdmin: boolean;
  /** vrai si l'utilisateur peut modifier (mode edit ou admin). */
  canEdit: boolean;
}
