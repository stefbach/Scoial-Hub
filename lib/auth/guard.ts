// Garde d'autorisation pour les routes API : vérifie que l'utilisateur connecté
// appartient bien à l'organisation de la société ciblée (corrige l'IDOR).
//
// Dégradation : en mode démo (Supabase absent) ou AUTH_DISABLED=true → autorisé.
// En prod : refuse si non authentifié (401) ou non membre (403). Fail-closed.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

export interface GuardResult {
  ok: boolean;
  /** UUID de la société résolu (à utiliser dans les requêtes). */
  uuid?: string;
  status?: number;
  error?: string;
  userId?: string;
}

/** Autorise l'accès à une société pour l'utilisateur courant. */
export async function requireCompanyAccess(
  companyId: string | null | undefined
): Promise<GuardResult> {
  // Mode démo / échappatoire de dépannage → autorisé.
  if (!isSupabaseConfigured || process.env.AUTH_DISABLED === "true") {
    return { ok: true, uuid: companyId ? await resolveCompanyUuid(companyId) : undefined };
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

    const { data: membership } = await admin
      .from("sh_memberships")
      .select("user_id")
      .eq("org_id", company.org_id as string)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { ok: false, status: 403, error: "Accès refusé à cette société" };

    return { ok: true, uuid, userId: user.id };
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
