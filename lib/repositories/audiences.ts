import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { COMPANY_DATA } from "@/lib/mock-data";
import type { Audience, AudienceType } from "@/lib/types";
import type { DbAudience } from "@/lib/supabase/db-types";

// ── Mapper DB → type métier ──────────────────────────────────

function rowToAudience(row: DbAudience): Audience {
  return {
    id: row.id,
    type: (row.type as AudienceType) ?? "saved",
    name: row.name,
    description: row.description ?? "",
    detail: row.detail ?? "",
    reach: row.reach ?? "—",
    created: "",
    inUse: row.in_use ?? 0,
    config: (row.config as Audience["config"]) ?? undefined,
    metaAudienceId: row.meta_audience_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    lastSyncedAt: row.last_synced_at ?? undefined,
    createdAt: row.created_at ? row.created_at.slice(0, 10) : undefined,
    usedByAdSetIds: [],
  };
}

function audienceToRow(
  companyId: string,
  input: Omit<Audience, "id" | "created">
): Omit<DbAudience, "id" | "created_at"> {
  return {
    company_id: companyId,
    type: input.type,
    name: input.name,
    description: input.description || null,
    detail: input.detail || null,
    reach: input.reach || null,
    in_use: input.inUse ?? 0,
    config: (input.config as Record<string, unknown>) ?? null,
    meta_audience_id: input.metaAudienceId ?? null,
    created_by: input.createdBy ?? null,
    last_synced_at: input.lastSyncedAt ?? null,
  };
}

// ── Repository ───────────────────────────────────────────────

/**
 * Liste les audiences d'une company.
 * En mode mock, retourne COMPANY_DATA[companyId].audiences.list.
 */
export async function listAudiences(companyId: string): Promise<Audience[]> {
  if (!isSupabaseConfigured) {
    return [...(COMPANY_DATA[companyId]?.audiences.list ?? [])];
  }

  const supabase = createClient();
  if (!supabase) return [...(COMPANY_DATA[companyId]?.audiences.list ?? [])];

  const { data, error } = await supabase
    .from("sh_audiences")
    .select("*")
    .eq("company_id", await resolveCompanyUuid(companyId))
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[audiences] listAudiences error:", error);
    return [...(COMPANY_DATA[companyId]?.audiences.list ?? [])];
  }

  return (data as DbAudience[]).map(rowToAudience);
}

/**
 * Crée une nouvelle audience.
 * En mode mock, pousse dans COMPANY_DATA[companyId].audiences.list.
 */
export async function createAudience(
  companyId: string,
  input: Omit<Audience, "id" | "created">
): Promise<Audience> {
  const mockAudience = (): Audience => ({
    id: `aud-${Date.now()}`,
    created: "Created just now",
    ...input,
  });

  if (!isSupabaseConfigured) {
    const audience = mockAudience();
    if (COMPANY_DATA[companyId]) {
      COMPANY_DATA[companyId].audiences.list.unshift(audience);
    }
    return audience;
  }

  const supabase = createClient();
  if (!supabase) {
    const audience = mockAudience();
    if (COMPANY_DATA[companyId]) {
      COMPANY_DATA[companyId].audiences.list.unshift(audience);
    }
    return audience;
  }

  const row = audienceToRow(await resolveCompanyUuid(companyId), input);
  const { data, error } = await supabase
    .from("sh_audiences")
    .insert(row)
    .select()
    .single();

  if (error || !data) {
    console.error("[audiences] createAudience error:", error);
    throw new Error(error?.message ?? "Failed to create audience");
  }

  return rowToAudience(data as DbAudience);
}

/**
 * Met à jour une audience existante.
 * En mode mock, patch dans COMPANY_DATA.
 */
export async function updateAudience(
  id: string,
  patch: Partial<Omit<Audience, "id" | "created">>
): Promise<Audience> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.audiences.list.findIndex((a) => a.id === id);
      if (idx >= 0) {
        data.audiences.list[idx] = { ...data.audiences.list[idx], ...patch };
        return data.audiences.list[idx];
      }
    }
    throw new Error(`Audience ${id} not found`);
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.audiences.list.findIndex((a) => a.id === id);
      if (idx >= 0) {
        data.audiences.list[idx] = { ...data.audiences.list[idx], ...patch };
        return data.audiences.list[idx];
      }
    }
    throw new Error(`Audience ${id} not found`);
  }

  const dbPatch: Partial<Omit<DbAudience, "id" | "company_id" | "created_at">> = {};
  if (patch.type !== undefined) dbPatch.type = patch.type;
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description || null;
  if (patch.detail !== undefined) dbPatch.detail = patch.detail || null;
  if (patch.reach !== undefined) dbPatch.reach = patch.reach || null;
  if (patch.inUse !== undefined) dbPatch.in_use = patch.inUse;
  if (patch.config !== undefined) dbPatch.config = (patch.config as Record<string, unknown>) ?? null;
  if (patch.metaAudienceId !== undefined) dbPatch.meta_audience_id = patch.metaAudienceId ?? null;
  if (patch.createdBy !== undefined) dbPatch.created_by = patch.createdBy ?? null;
  if (patch.lastSyncedAt !== undefined) dbPatch.last_synced_at = patch.lastSyncedAt ?? null;

  const { data, error } = await supabase
    .from("sh_audiences")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    console.error("[audiences] updateAudience error:", error);
    throw new Error(error?.message ?? "Failed to update audience");
  }

  return rowToAudience(data as DbAudience);
}

/**
 * Supprime une audience.
 * En mode mock, retire de COMPANY_DATA.
 */
export async function deleteAudience(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.audiences.list.findIndex((a) => a.id === id);
      if (idx >= 0) {
        data.audiences.list.splice(idx, 1);
        return;
      }
    }
    return;
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.audiences.list.findIndex((a) => a.id === id);
      if (idx >= 0) {
        data.audiences.list.splice(idx, 1);
        return;
      }
    }
    return;
  }

  const { error } = await supabase.from("sh_audiences").delete().eq("id", id);

  if (error) {
    console.error("[audiences] deleteAudience error:", error);
    throw new Error(error.message ?? "Failed to delete audience");
  }
}

/** Société propriétaire d'une audience (pour les gardes d'autorisation). */
export async function getAudienceCompanyId(id: string): Promise<string | null> {
  if (!isSupabaseConfigured) {
    for (const [companyId, data] of Object.entries(COMPANY_DATA)) {
      if (data.audiences.list.some((a) => a.id === id)) return companyId;
    }
    return null;
  }
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("sh_audiences").select("company_id").eq("id", id).maybeSingle();
  return (data?.company_id as string | undefined) ?? null;
}
