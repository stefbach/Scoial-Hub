import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isUuid } from "@/lib/repositories/resolve-company";
import type { AdSet } from "@/lib/types";
import type { DbAdSet } from "@/lib/supabase/db-types";

// Repo léger pour persister l'état des ad sets (toggle/édition/suppression).
// Les ad sets riches (séries, rollups d'annonces) restent calculés côté client
// dans lib/campaign-store ; ici on ne persiste que ce qui doit survivre au reload.

function rowToAdSet(row: DbAdSet): AdSet {
  return {
    id: row.id,
    name: row.name,
    placement: row.placement ?? "",
    targeting: row.targeting ?? "",
    ads: 0,
    dailyBudget: row.daily_budget !== null ? Number(row.daily_budget) : 0,
    enabled: row.enabled ?? undefined,
    audienceId: row.audience_id ?? undefined,
    budgetType: (row.budget_type as AdSet["budgetType"]) ?? undefined,
    lifetimeBudget: row.lifetime_budget !== null ? Number(row.lifetime_budget) : undefined,
    optimizationGoal: (row.optimization_goal as AdSet["optimizationGoal"]) ?? undefined,
    status: (row.status as AdSet["status"]) ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
  };
}

/**
 * Crée un ad set persisté pour une campagne.
 * `campaignId` doit être un UUID (campagne réelle en base).
 */
export async function createAdSet(
  campaignId: string,
  input: Pick<AdSet, "name" | "placement" | "targeting" | "audienceId" | "dailyBudget" | "lifetimeBudget" | "budgetType" | "optimizationGoal" | "status" | "enabled" | "startDate" | "endDate">
): Promise<AdSet | null> {
  if (!isSupabaseConfigured || !isUuid(campaignId)) return null;

  const supabase = createClient();
  if (!supabase) return null;

  const row: Omit<DbAdSet, "id" | "created_at"> = {
    campaign_id: campaignId,
    name: input.name,
    placement: input.placement || null,
    targeting: input.targeting || null,
    audience_id: input.audienceId && isUuid(input.audienceId) ? input.audienceId : null,
    daily_budget: input.dailyBudget ?? null,
    lifetime_budget: input.lifetimeBudget ?? null,
    budget_type: input.budgetType ?? "daily",
    optimization_goal: input.optimizationGoal ?? "conversions",
    status: input.status ?? (input.enabled === false ? "paused" : "active"),
    enabled: input.enabled ?? true,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    metrics: {},
    meta_ad_set_id: null,
  };

  const { data, error } = await supabase
    .from("sh_ad_sets")
    .insert(row)
    .select()
    .single();

  if (error || !data) {
    console.error("[ad-sets] createAdSet error:", error);
    return null;
  }
  return rowToAdSet(data as DbAdSet);
}

/**
 * Met à jour un ad set persisté. No-op si l'id n'est pas un UUID (ad set mock).
 * Retourne true si une ligne a été persistée.
 */
export async function updateAdSet(
  id: string,
  patch: Partial<Pick<AdSet, "name" | "placement" | "targeting" | "audienceId" | "dailyBudget" | "lifetimeBudget" | "budgetType" | "optimizationGoal" | "status" | "enabled" | "startDate" | "endDate">>
): Promise<boolean> {
  if (!isSupabaseConfigured || !isUuid(id)) return false;

  const supabase = createClient();
  if (!supabase) return false;

  const dbPatch: Partial<Omit<DbAdSet, "id" | "campaign_id" | "created_at">> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.placement !== undefined) dbPatch.placement = patch.placement || null;
  if (patch.targeting !== undefined) dbPatch.targeting = patch.targeting || null;
  if (patch.audienceId !== undefined)
    dbPatch.audience_id = patch.audienceId && isUuid(patch.audienceId) ? patch.audienceId : null;
  if (patch.dailyBudget !== undefined) dbPatch.daily_budget = patch.dailyBudget ?? null;
  if (patch.lifetimeBudget !== undefined) dbPatch.lifetime_budget = patch.lifetimeBudget ?? null;
  if (patch.budgetType !== undefined) dbPatch.budget_type = patch.budgetType ?? null;
  if (patch.optimizationGoal !== undefined) dbPatch.optimization_goal = patch.optimizationGoal ?? null;
  if (patch.status !== undefined) dbPatch.status = patch.status ?? null;
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate || null;
  if (patch.endDate !== undefined) dbPatch.end_date = patch.endDate || null;

  const { error } = await supabase.from("sh_ad_sets").update(dbPatch).eq("id", id);
  if (error) {
    console.error("[ad-sets] updateAdSet error:", error);
    return false;
  }
  return true;
}

/**
 * Supprime un ad set persisté. No-op si l'id n'est pas un UUID (ad set mock).
 */
export async function deleteAdSet(id: string): Promise<void> {
  if (!isSupabaseConfigured || !isUuid(id)) return;

  const supabase = createClient();
  if (!supabase) return;

  const { error } = await supabase.from("sh_ad_sets").delete().eq("id", id);
  if (error) {
    console.error("[ad-sets] deleteAdSet error:", error);
    throw new Error(error.message ?? "Failed to delete ad set");
  }
}
