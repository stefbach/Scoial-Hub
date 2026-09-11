import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { COMPANY_DATA } from "@/lib/mock-data";

/**
 * Société propriétaire d'un item d'historique — nécessaire pour autoriser un
 * DELETE par id seul (même schéma que getScheduledPostCompanyId).
 */
export async function getHistoryItemCompanyId(id: string): Promise<string | null> {
  if (!isSupabaseConfigured) {
    for (const [companyId, data] of Object.entries(COMPANY_DATA)) {
      if (data.history.some((h) => h.id === id)) return companyId;
    }
    return null;
  }

  const supabase = createClient();
  if (!supabase) {
    for (const [companyId, data] of Object.entries(COMPANY_DATA)) {
      if (data.history.some((h) => h.id === id)) return companyId;
    }
    return null;
  }

  const { data, error } = await supabase
    .from("sh_history_items")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { company_id: string }).company_id;
}

/**
 * Supprime définitivement un item d'historique.
 * En mode mock, retire de COMPANY_DATA.
 */
export async function deleteHistoryItem(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.history.findIndex((h) => h.id === id);
      if (idx >= 0) {
        data.history.splice(idx, 1);
        return;
      }
    }
    return; // item inexistant — pas d'erreur
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.history.findIndex((h) => h.id === id);
      if (idx >= 0) {
        data.history.splice(idx, 1);
        return;
      }
    }
    return;
  }

  const { error } = await supabase
    .from("sh_history_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[history] deleteHistoryItem error:", error);
    throw new Error(error.message ?? "Failed to delete history item");
  }
}
