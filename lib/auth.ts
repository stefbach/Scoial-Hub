/**
 * Helpers d'authentification côté serveur.
 * À n'utiliser que dans des Server Components, API routes ou Server Actions.
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { OrgStatus } from "@/lib/rbac/types";

/**
 * Retourne l'utilisateur connecté depuis la session courante.
 * Retourne `null` si non configuré ou non connecté.
 */
export async function getSessionUser() {
  if (!isSupabaseConfigured) return null;

  const supabase = createClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

/**
 * Retourne l'identifiant de l'organisation de l'utilisateur connecté
 * (première appartenance trouvée, généralement l'unique org).
 * Retourne `null` si non configuré, non connecté ou sans organisation.
 */
export async function getMyOrgId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Requête en dehors du schéma social_hub : memberships est dans social_hub
  const { data, error } = await supabase
    .from("sh_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.org_id as string;
}

/**
 * Statut de validation de l'organisation de l'utilisateur connecté.
 * Sert de source de vérité au verrou d'auto-inscription : une org auto-créée
 * démarre en `pending` (en attente de validation par l'admin générale), puis
 * `approved` une fois validée, ou `suspended` si bloquée.
 *
 * Retours particuliers :
 *  - `demo`           : Supabase non configuré ou AUTH_DISABLED → accès ouvert.
 *  - `unauthenticated`: aucune session.
 *  - `none`           : utilisateur connecté SANS organisation (provisionnement
 *                       en cours) → on n'enferme pas, l'accès reste possible.
 */
export type MyOrgStatus =
  | { status: OrgStatus; orgId: string }
  | { status: "demo" | "unauthenticated" | "none"; orgId: null };

export async function getMyOrgStatus(): Promise<MyOrgStatus> {
  if (!isSupabaseConfigured || process.env.AUTH_DISABLED === "true") {
    return { status: "demo", orgId: null };
  }

  const supabase = createClient();
  if (!supabase) return { status: "demo", orgId: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated", orgId: null };

  // Client admin : lecture directe du statut (RLS sans policy publique).
  const admin = createAdminClient() ?? supabase;

  const { data: membership } = await admin
    .from("sh_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const orgId = membership?.org_id as string | undefined;
  if (!orgId) return { status: "none", orgId: null };

  const { data: org } = await admin
    .from("sh_organizations")
    .select("status")
    .eq("id", orgId)
    .maybeSingle();

  const status = ((org?.status as OrgStatus) ?? "approved") as OrgStatus;
  return { status, orgId };
}
