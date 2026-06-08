// Garde d'autorisation pour les routes API : vérifie que l'utilisateur connecté
// appartient bien à l'organisation de la société ciblée (corrige l'IDOR) ET
// qu'il dispose du bon NIVEAU d'accès (édition vs lecture) sur cette société.
//
// Dégradation : en mode démo (Supabase absent) ou AUTH_DISABLED=true → autorisé.
// En prod : refuse si non authentifié (401), non membre / sans accès (403),
// société introuvable (404) ou organisation suspendue (403). Fail-closed.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getEffectiveMode } from "@/lib/repositories/access";
import { AccessMode, OrgRole, isAccountAdmin } from "@/lib/rbac/types";

export interface GuardResult {
  ok: boolean;
  /** UUID de la société résolu (à utiliser dans les requêtes). */
  uuid?: string;
  status?: number;
  error?: string;
  userId?: string;
  /** rôle de l'utilisateur dans l'org de la société. */
  role?: OrgRole;
  /** mode d'accès effectif sur cette société. */
  mode?: AccessMode;
  /** org de la société. */
  orgId?: string;
}

export interface GuardOptions {
  /** Niveau requis : 'view' (défaut) ou 'edit' pour les écritures. */
  mode?: AccessMode;
}

/** Autorise l'accès à une société pour l'utilisateur courant. */
export async function requireCompanyAccess(
  companyId: string | null | undefined,
  opts: GuardOptions = {}
): Promise<GuardResult> {
  const required: AccessMode = opts.mode ?? "view";

  // Mode démo / échappatoire de dépannage → autorisé (édition).
  if (!isSupabaseConfigured || process.env.AUTH_DISABLED === "true") {
    return {
      ok: true,
      uuid: companyId ? await resolveCompanyUuid(companyId) : undefined,
      role: "owner",
      mode: "edit",
    };
  }
  if (!companyId) return { ok: false, status: 400, error: "companyId requis" };

  try {
    const supabase = createClient();
    if (!supabase) return { ok: false, status: 401, error: "Session indisponible" };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, status: 401, error: "Non authentifié" };

    const uuid = await resolveCompanyUuid(companyId);
    const admin = createAdminClient() ?? supabase;

    const { data: company } = await admin
      .from("sh_companies")
      .select("org_id")
      .eq("id", uuid)
      .maybeSingle();
    if (!company?.org_id) return { ok: false, status: 404, error: "Société introuvable" };
    const orgId = company.org_id as string;

    const { data: membership } = await admin
      .from("sh_memberships")
      .select("role, status")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { ok: false, status: 403, error: "Accès refusé à cette société" };
    if ((membership.status as string) === "suspended") {
      return { ok: false, status: 403, error: "Compte suspendu" };
    }

    // Organisation suspendue par l'admin générale → blocage.
    const { data: org } = await admin
      .from("sh_organizations")
      .select("status")
      .eq("id", orgId)
      .maybeSingle();
    if ((org?.status as string) === "suspended") {
      return { ok: false, status: 403, error: "Organisation suspendue" };
    }

    const role = (membership.role as OrgRole) ?? "member";
    const mode = await getEffectiveMode(uuid, orgId, user.id, role);
    if (!mode) return { ok: false, status: 403, error: "Accès refusé à cette société" };
    if (required === "edit" && mode !== "edit") {
      return { ok: false, status: 403, error: "Lecture seule sur cette société", uuid, userId: user.id, role, mode, orgId };
    }

    return { ok: true, uuid, userId: user.id, role, mode, orgId };
  } catch (e) {
    console.error("[guard] requireCompanyAccess error:", e);
    return { ok: false, status: 500, error: "Erreur d'autorisation" };
  }
}

/** Vérifie simplement qu'un utilisateur est connecté (sans société). */
export async function requireUser(): Promise<GuardResult> {
  if (!isSupabaseConfigured || process.env.AUTH_DISABLED === "true") return { ok: true };
  try {
    const supabase = createClient();
    if (!supabase) return { ok: false, status: 401, error: "Session indisponible" };
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, status: 401, error: "Non authentifié" };
    return { ok: true, userId: user.id };
  } catch {
    return { ok: false, status: 500, error: "Erreur d'autorisation" };
  }
}

/**
 * Vérifie que l'utilisateur courant est ADMIN d'une organisation (owner/admin),
 * c.-à-d. un « compte admin » qui gère ses sociétés et son équipe.
 * Si orgId est omis, prend la première org de l'utilisateur.
 */
export async function requireAccountAdmin(
  orgId?: string
): Promise<GuardResult & { orgId?: string }> {
  if (!isSupabaseConfigured || process.env.AUTH_DISABLED === "true") {
    return { ok: true, role: "owner", orgId };
  }
  try {
    const supabase = createClient();
    if (!supabase) return { ok: false, status: 401, error: "Session indisponible" };
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, status: 401, error: "Non authentifié" };

    const admin = createAdminClient() ?? supabase;
    let targetOrg = orgId;
    if (!targetOrg) {
      const { data } = await admin
        .from("sh_memberships")
        .select("org_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      targetOrg = data?.org_id as string | undefined;
    }
    if (!targetOrg) return { ok: false, status: 403, error: "Aucune organisation" };

    const { data: membership } = await admin
      .from("sh_memberships")
      .select("role")
      .eq("org_id", targetOrg)
      .eq("user_id", user.id)
      .maybeSingle();
    const role = (membership?.role as OrgRole) ?? null;
    if (!role || !isAccountAdmin(role)) {
      return { ok: false, status: 403, error: "Réservé aux administrateurs du compte" };
    }
    return { ok: true, userId: user.id, role, orgId: targetOrg };
  } catch (e) {
    console.error("[guard] requireAccountAdmin error:", e);
    return { ok: false, status: 500, error: "Erreur d'autorisation" };
  }
}
