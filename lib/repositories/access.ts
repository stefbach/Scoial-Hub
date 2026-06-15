// Répertoire RBAC — appartenances, accès par société, invitations.
// Utilise le client admin (service-role) ; l'autorisation est faite en amont
// par les gardes (requireCompanyAccess / requireAccountAdmin). Ne throw jamais.

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, env } from "@/lib/env";
import {
  AccessMode,
  CompanyAccessGrant,
  OrgRole,
  TeamInvitation,
  TeamMember,
  isAccountAdmin,
} from "@/lib/rbac/types";

export interface Membership {
  orgId: string;
  userId: string;
  role: OrgRole;
  status: "active" | "suspended";
}

/** Appartenance d'un utilisateur à une organisation (ou null). */
export async function getMembership(orgId: string, userId: string): Promise<Membership | null> {
  if (!isSupabaseConfigured) return null;
  const sb = createAdminClient();
  if (!sb) return null;
  const { data } = await sb
    .from("sh_memberships")
    .select("org_id, user_id, role, status")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    orgId: String(data.org_id),
    userId: String(data.user_id),
    role: (data.role as OrgRole) ?? "member",
    status: (data.status as "active" | "suspended") ?? "active",
  };
}

/** Statut d'une organisation (validation par l'admin générale). */
export async function getOrgStatus(orgId: string): Promise<"pending" | "approved" | "suspended"> {
  if (!isSupabaseConfigured) return "approved";
  const sb = createAdminClient();
  if (!sb) return "approved";
  const { data } = await sb.from("sh_organizations").select("status").eq("id", orgId).maybeSingle();
  return ((data?.status as "pending" | "approved" | "suspended") ?? "approved");
}

/**
 * Mode d'accès EFFECTIF d'un utilisateur sur une société.
 * - owner/admin de l'org → 'edit' (accès total implicite sur toutes les sociétés).
 * - sinon → le mode de la ligne sh_company_access, ou null (aucun accès).
 */
export async function getEffectiveMode(
  companyUuid: string,
  orgId: string,
  userId: string,
  role: OrgRole
): Promise<AccessMode | null> {
  if (isAccountAdmin(role)) return "edit";
  if (!isSupabaseConfigured) return "edit";
  const sb = createAdminClient();
  if (!sb) return "edit";
  const { data } = await sb
    .from("sh_company_access")
    .select("mode")
    .eq("company_id", companyUuid)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return (data.mode as AccessMode) ?? "view";
}

// ── Équipe : liste, ajout, mise à jour, suppression ──────────────────────────

/** Résout email → id pour tous les membres de l'org (via auth admin). */
async function emailMap(sb: NonNullable<ReturnType<typeof createAdminClient>>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    // listUsers est paginé ; une page suffit pour des équipes raisonnables.
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.id && u.email) map.set(u.id, u.email);
  } catch { /* ignore */ }
  return map;
}

/** Liste les membres de l'org avec leurs accès par société. */
export async function listTeam(orgId: string): Promise<{ members: TeamMember[]; invitations: TeamInvitation[] }> {
  if (!isSupabaseConfigured) return { members: [], invitations: [] };
  const sb = createAdminClient();
  if (!sb) return { members: [], invitations: [] };

  const [{ data: memberships }, { data: companies }, emails] = await Promise.all([
    sb.from("sh_memberships").select("user_id, role, status").eq("org_id", orgId),
    sb.from("sh_companies").select("id").eq("org_id", orgId),
    emailMap(sb),
  ]);

  const companyIds = (companies ?? []).map((c) => String(c.id));
  // Accès par utilisateur, restreint aux sociétés de l'org.
  const accessByUser = new Map<string, CompanyAccessGrant[]>();
  if (companyIds.length) {
    const { data: access } = await sb
      .from("sh_company_access")
      .select("user_id, company_id, mode")
      .in("company_id", companyIds);
    for (const a of access ?? []) {
      const list = accessByUser.get(String(a.user_id)) ?? [];
      list.push({ companyId: String(a.company_id), mode: (a.mode as AccessMode) ?? "view" });
      accessByUser.set(String(a.user_id), list);
    }
  }

  const members: TeamMember[] = (memberships ?? []).map((m) => ({
    userId: String(m.user_id),
    email: emails.get(String(m.user_id)) ?? "(utilisateur)",
    role: (m.role as OrgRole) ?? "member",
    status: (m.status as "active" | "suspended") ?? "active",
    access: accessByUser.get(String(m.user_id)) ?? [],
  }));

  const { data: invites } = await sb
    .from("sh_invitations")
    .select("id, email, role, company_access, status, created_at")
    .eq("org_id", orgId)
    .eq("status", "pending");
  const invitations: TeamInvitation[] = (invites ?? []).map((i) => ({
    id: String(i.id),
    email: String(i.email),
    role: (i.role as OrgRole) ?? "member",
    access: Array.isArray(i.company_access) ? (i.company_access as CompanyAccessGrant[]) : [],
    status: "pending",
    createdAt: i.created_at ? String(i.created_at) : null,
  }));

  return { members, invitations };
}

/** Remplace les accès par société d'un utilisateur (au sein d'une org). */
async function setUserAccess(
  sb: NonNullable<ReturnType<typeof createAdminClient>>,
  orgId: string,
  userId: string,
  access: CompanyAccessGrant[],
  grantedBy?: string
) {
  const { data: companies } = await sb.from("sh_companies").select("id").eq("org_id", orgId);
  const orgCompanyIds = new Set((companies ?? []).map((c) => String(c.id)));
  // Purge les accès existants de cet utilisateur sur les sociétés de l'org.
  if (orgCompanyIds.size) {
    await sb.from("sh_company_access").delete().eq("user_id", userId).in("company_id", Array.from(orgCompanyIds));
  }
  const rows = access
    .filter((a) => orgCompanyIds.has(a.companyId) && (a.mode === "edit" || a.mode === "view"))
    .map((a) => ({ company_id: a.companyId, user_id: userId, mode: a.mode, granted_by: grantedBy ?? null }));
  if (rows.length) await sb.from("sh_company_access").insert(rows);
}

/**
 * Ajoute/invite un membre par email. Si un compte existe déjà → membership +
 * accès immédiats. Sinon → invitation en attente (consommée au login).
 */
export async function addOrInviteMember(
  orgId: string,
  email: string,
  role: OrgRole,
  access: CompanyAccessGrant[],
  invitedBy?: string
): Promise<{ added?: boolean; invited?: boolean; emailSent?: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configuré" };
  const sb = createAdminClient();
  if (!sb) return { error: "Supabase non configuré" };
  const norm = email.trim().toLowerCase();
  if (!norm) return { error: "Email requis" };

  const emails = await emailMap(sb);
  let userId: string | null = null;
  for (const [id, e] of emails) if (e.toLowerCase() === norm) { userId = id; break; }

  if (userId) {
    await sb.from("sh_memberships").upsert(
      { org_id: orgId, user_id: userId, role, status: "active" },
      { onConflict: "org_id,user_id" }
    );
    await setUserAccess(sb, orgId, userId, access, invitedBy);
    return { added: true };
  }

  await sb.from("sh_invitations").insert({
    org_id: orgId,
    email: norm,
    role,
    company_access: access,
    status: "pending",
    invited_by: invitedBy ?? null,
  });

  // #10 — Envoi d'un VRAI e-mail d'invitation via Supabase Auth. Le destinataire
  // reçoit un lien d'inscription ; à sa première connexion, consumeInvitations()
  // applique automatiquement le rôle + les accès. Dégradation gracieuse : si
  // l'e-mail échoue (SMTP non configuré côté Supabase, utilisateur déjà inscrit…)
  // l'invitation reste créée et le lien-relais copiable prend le relais.
  let emailSent = false;
  try {
    const redirectTo = `${env.appUrl.replace(/\/$/, "")}/auth/callback`;
    const { error: inviteErr } = await sb.auth.admin.inviteUserByEmail(norm, { redirectTo });
    emailSent = !inviteErr;
  } catch {
    emailSent = false;
  }

  return { invited: true, emailSent };
}

/** Met à jour le rôle et les accès d'un membre existant. */
export async function updateMember(
  orgId: string,
  userId: string,
  role: OrgRole,
  access: CompanyAccessGrant[],
  grantedBy?: string
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  await sb.from("sh_memberships").update({ role }).eq("org_id", orgId).eq("user_id", userId);
  await setUserAccess(sb, orgId, userId, access, grantedBy);
  return { ok: true };
}

/** Retire un membre de l'org (et tous ses accès aux sociétés de l'org). */
export async function removeMember(orgId: string, userId: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  const { data: companies } = await sb.from("sh_companies").select("id").eq("org_id", orgId);
  const ids = (companies ?? []).map((c) => String(c.id));
  if (ids.length) await sb.from("sh_company_access").delete().eq("user_id", userId).in("company_id", ids);
  await sb.from("sh_memberships").delete().eq("org_id", orgId).eq("user_id", userId);
  return { ok: true };
}

export async function revokeInvitation(orgId: string, invitationId: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const sb = createAdminClient();
  if (!sb) return { ok: false };
  await sb.from("sh_invitations").update({ status: "revoked" }).eq("id", invitationId).eq("org_id", orgId);
  return { ok: true };
}

/**
 * Consomme les invitations en attente pour un email donné (appelé au login) :
 * crée les memberships + accès, marque les invitations acceptées.
 */
export async function consumeInvitations(userId: string, email: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const sb = createAdminClient();
  if (!sb) return 0;
  const norm = email.trim().toLowerCase();
  const { data: invites } = await sb
    .from("sh_invitations")
    .select("id, org_id, role, company_access")
    .eq("status", "pending")
    .ilike("email", norm);
  let n = 0;
  for (const inv of invites ?? []) {
    const orgId = String(inv.org_id);
    await sb.from("sh_memberships").upsert(
      { org_id: orgId, user_id: userId, role: (inv.role as OrgRole) ?? "member", status: "active" },
      { onConflict: "org_id,user_id" }
    );
    const access = Array.isArray(inv.company_access) ? (inv.company_access as CompanyAccessGrant[]) : [];
    await setUserAccess(sb, orgId, userId, access);
    await sb.from("sh_invitations").update({ status: "accepted" }).eq("id", inv.id);
    n++;
  }
  return n;
}
