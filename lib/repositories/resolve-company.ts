// Résout l'UUID réel d'une société à partir d'un id OU d'un code.
// Les sociétés de démo (mock-data) ont un id non‑UUID (ex. "occ") : on retrouve
// alors la vraie ligne sh_companies via son code. Indispensable pour que les
// requêtes Supabase (company_id uuid) fonctionnent au lieu d'échouer → mock.

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/**
 * Retourne un UUID de société exploitable.
 * - si `idOrCode` est déjà un UUID → tel quel
 * - sinon, recherche sh_companies par code (insensible à la casse)
 * - sinon, renvoie la valeur d'origine (dégradation gracieuse)
 */
export async function resolveCompanyUuid(idOrCode: string): Promise<string> {
  if (!idOrCode) return idOrCode;
  if (isUuid(idOrCode)) return idOrCode;
  if (!isSupabaseConfigured) return idOrCode;

  const supabase = createAdminClient();
  if (!supabase) return idOrCode;

  try {
    const { data } = await supabase
      .from("sh_companies")
      .select("id")
      .ilike("code", idOrCode)
      .limit(1)
      .maybeSingle();
    return data?.id ? String(data.id) : idOrCode;
  } catch {
    return idOrCode;
  }
}
