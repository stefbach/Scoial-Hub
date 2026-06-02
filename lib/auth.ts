/**
 * Helpers d'authentification côté serveur.
 * À n'utiliser que dans des Server Components, API routes ou Server Actions.
 */

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

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
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.org_id as string;
}
