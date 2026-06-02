import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { COMPANY_DATA } from "@/lib/mock-data";
import type { Campaign } from "@/lib/types";
import type { DbCampaign } from "@/lib/supabase/db-types";

// ── Mapper DB → type métier ──────────────────────────────────

function rowToCampaign(row: DbCampaign): Campaign {
  const platforms = (row.platforms ?? []) as Campaign["platforms"];
  return {
    id: row.id,
    name: row.name,
    objective: row.objective ?? "",
    platforms,
    status: (row.status as Campaign["status"]) ?? "paused",
    enabled: row.enabled,
    spend: Number(row.spend ?? 0),
    budget: Number(row.budget ?? 0),
    metricsLabel: "",
    metricsValue: "",
    dailyBudget: row.daily_budget !== null ? Number(row.daily_budget) : undefined,
    lifetimeBudget: row.lifetime_budget !== null ? Number(row.lifetime_budget) : undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? null,
    adSets: [],
  };
}

function campaignToRow(
  companyId: string,
  input: Omit<Campaign, "id" | "adSets" | "metricsLabel" | "metricsValue" | "cplLabel" | "ads">
): Omit<DbCampaign, "id" | "created_at"> {
  return {
    company_id: companyId,
    name: input.name,
    objective: input.objective ?? null,
    platforms: input.platforms ?? [],
    status: input.status ?? "paused",
    enabled: input.enabled ?? false,
    spend: input.spend ?? 0,
    budget: input.budget ?? 0,
    daily_budget: input.dailyBudget ?? null,
    lifetime_budget: input.lifetimeBudget ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    metrics: {},
    meta_campaign_id: null,
  };
}

// ── Repository ───────────────────────────────────────────────

/**
 * Liste les campagnes d'une company.
 * En mode mock, retourne COMPANY_DATA[companyId].campaigns.list.
 */
export async function listCampaigns(companyId: string): Promise<Campaign[]> {
  if (!isSupabaseConfigured) {
    return [...(COMPANY_DATA[companyId]?.campaigns.list ?? [])];
  }

  const supabase = createClient();
  if (!supabase) return [...(COMPANY_DATA[companyId]?.campaigns.list ?? [])];

  const { data, error } = await supabase
    .from("sh_campaigns")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[campaigns] listCampaigns error:", error);
    return [...(COMPANY_DATA[companyId]?.campaigns.list ?? [])];
  }

  return (data as DbCampaign[]).map(rowToCampaign);
}

/**
 * Récupère une campagne par son id.
 * En mode mock, cherche dans COMPANY_DATA (toutes les companies).
 */
export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const campaign = data.campaigns.list.find((c) => c.id === id);
      if (campaign) return campaign;
    }
    return null;
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const campaign = data.campaigns.list.find((c) => c.id === id);
      if (campaign) return campaign;
    }
    return null;
  }

  const { data, error } = await supabase
    .from("sh_campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[campaigns] getCampaign error:", error);
    return null;
  }

  return rowToCampaign(data as DbCampaign);
}

/**
 * Crée une nouvelle campagne.
 * En mode mock, pousse dans COMPANY_DATA[companyId].campaigns.list.
 */
export async function createCampaign(
  companyId: string,
  input: Pick<Campaign, "name" | "objective" | "platforms" | "status" | "enabled" | "spend" | "budget" | "dailyBudget" | "lifetimeBudget" | "startDate" | "endDate">
): Promise<Campaign> {
  const mockCampaign = (): Campaign => ({
    id: `cmp-${Date.now()}`,
    name: input.name,
    objective: input.objective ?? "",
    platforms: input.platforms ?? [],
    status: input.status ?? "paused",
    enabled: input.enabled ?? false,
    spend: input.spend ?? 0,
    budget: input.budget ?? 0,
    metricsLabel: "",
    metricsValue: "",
    dailyBudget: input.dailyBudget,
    lifetimeBudget: input.lifetimeBudget,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    adSets: [],
  });

  if (!isSupabaseConfigured) {
    const campaign = mockCampaign();
    if (COMPANY_DATA[companyId]) {
      COMPANY_DATA[companyId].campaigns.list.unshift(campaign);
    }
    return campaign;
  }

  const supabase = createClient();
  if (!supabase) {
    const campaign = mockCampaign();
    if (COMPANY_DATA[companyId]) {
      COMPANY_DATA[companyId].campaigns.list.unshift(campaign);
    }
    return campaign;
  }

  const row = campaignToRow(companyId, input);
  const { data, error } = await supabase
    .from("sh_campaigns")
    .insert(row)
    .select()
    .single();

  if (error || !data) {
    console.error("[campaigns] createCampaign error:", error);
    throw new Error(error?.message ?? "Failed to create campaign");
  }

  return rowToCampaign(data as DbCampaign);
}

/**
 * Met à jour une campagne existante.
 * En mode mock, patch dans COMPANY_DATA.
 */
export async function updateCampaign(
  id: string,
  patch: Partial<Pick<Campaign, "name" | "objective" | "platforms" | "status" | "enabled" | "spend" | "budget" | "dailyBudget" | "lifetimeBudget" | "startDate" | "endDate">>
): Promise<Campaign> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.campaigns.list.findIndex((c) => c.id === id);
      if (idx >= 0) {
        data.campaigns.list[idx] = { ...data.campaigns.list[idx], ...patch };
        return data.campaigns.list[idx];
      }
    }
    throw new Error(`Campaign ${id} not found`);
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.campaigns.list.findIndex((c) => c.id === id);
      if (idx >= 0) {
        data.campaigns.list[idx] = { ...data.campaigns.list[idx], ...patch };
        return data.campaigns.list[idx];
      }
    }
    throw new Error(`Campaign ${id} not found`);
  }

  const dbPatch: Partial<Omit<DbCampaign, "id" | "company_id" | "created_at">> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.objective !== undefined) dbPatch.objective = patch.objective ?? null;
  if (patch.platforms !== undefined) dbPatch.platforms = patch.platforms ?? [];
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.spend !== undefined) dbPatch.spend = patch.spend;
  if (patch.budget !== undefined) dbPatch.budget = patch.budget;
  if (patch.dailyBudget !== undefined) dbPatch.daily_budget = patch.dailyBudget ?? null;
  if (patch.lifetimeBudget !== undefined) dbPatch.lifetime_budget = patch.lifetimeBudget ?? null;
  if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate ?? null;
  if (patch.endDate !== undefined) dbPatch.end_date = patch.endDate ?? null;

  const { data, error } = await supabase
    .from("sh_campaigns")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    console.error("[campaigns] updateCampaign error:", error);
    throw new Error(error?.message ?? "Failed to update campaign");
  }

  return rowToCampaign(data as DbCampaign);
}

/**
 * Supprime une campagne.
 * En mode mock, retire de COMPANY_DATA.
 */
export async function deleteCampaign(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.campaigns.list.findIndex((c) => c.id === id);
      if (idx >= 0) {
        data.campaigns.list.splice(idx, 1);
        return;
      }
    }
    return;
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.campaigns.list.findIndex((c) => c.id === id);
      if (idx >= 0) {
        data.campaigns.list.splice(idx, 1);
        return;
      }
    }
    return;
  }

  const { error } = await supabase.from("sh_campaigns").delete().eq("id", id);

  if (error) {
    console.error("[campaigns] deleteCampaign error:", error);
    throw new Error(error.message ?? "Failed to delete campaign");
  }
}
