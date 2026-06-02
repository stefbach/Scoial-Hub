import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { COMPANIES, COMPANY_DATA, registerCompany, makeEmptyCompanyData } from "@/lib/mock-data";
import type { Company } from "@/lib/types";
import type { DbCompany } from "@/lib/supabase/db-types";

// ── Mapper DB → type métier ──────────────────────────────────

function rowToCompany(row: DbCompany): Company {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    brandVoice: row.brand_voice ?? "",
    accent: row.accent ?? "#2563eb",
    logoUrl: row.logo_url ?? undefined,
    defaultPlatforms: (row.default_platforms ?? []) as Company["defaultPlatforms"],
    defaultPostingTime: row.default_posting_time ?? undefined,
    defaultNeedsReview: row.default_needs_review ?? false,
  };
}

function companyToRow(
  company: Omit<Company, "id">,
  orgId: string
): Omit<DbCompany, "id" | "created_at"> {
  return {
    org_id: orgId,
    code: company.code,
    name: company.name,
    brand_voice: company.brandVoice,
    accent: company.accent,
    logo_url: company.logoUrl ?? null,
    default_platforms: company.defaultPlatforms ?? [],
    default_posting_time: company.defaultPostingTime ?? null,
    default_needs_review: company.defaultNeedsReview ?? false,
  };
}

// ── Repository ───────────────────────────────────────────────

/**
 * Liste toutes les companies d'une organisation.
 * En mode mock, retourne COMPANIES (toutes, orgId ignoré).
 */
export async function listCompanies(orgId?: string): Promise<Company[]> {
  if (!isSupabaseConfigured) {
    return [...COMPANIES];
  }

  const supabase = createClient();
  if (!supabase) return [...COMPANIES];

  const query = supabase.from("companies").select("*").order("created_at");
  const { data, error } = orgId
    ? await query.eq("org_id", orgId)
    : await query;

  if (error || !data) {
    console.error("[companies] listCompanies error:", error);
    return [...COMPANIES];
  }

  return (data as DbCompany[]).map(rowToCompany);
}

/**
 * Récupère une company par son id.
 * En mode mock, cherche dans COMPANIES.
 */
export async function getCompany(id: string): Promise<Company | null> {
  if (!isSupabaseConfigured) {
    return COMPANIES.find((c) => c.id === id) ?? null;
  }

  const supabase = createClient();
  if (!supabase) return COMPANIES.find((c) => c.id === id) ?? null;

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[companies] getCompany error:", error);
    return COMPANIES.find((c) => c.id === id) ?? null;
  }

  return rowToCompany(data as DbCompany);
}

/**
 * Crée une nouvelle company.
 * En mode mock, enregistre dans les stores en mémoire.
 * @param orgId  ID de l'organisation (ignoré en mode mock).
 */
export async function createCompany(
  orgId: string,
  input: Omit<Company, "id">
): Promise<Company> {
  if (!isSupabaseConfigured) {
    const id = `company-${Date.now()}`;
    const company: Company = { id, ...input };
    registerCompany(company);
    return company;
  }

  const supabase = createClient();
  if (!supabase) {
    const id = `company-${Date.now()}`;
    const company: Company = { id, ...input };
    registerCompany(company);
    return company;
  }

  const row = companyToRow(input, orgId);
  const { data, error } = await supabase
    .from("companies")
    .insert(row)
    .select()
    .single();

  if (error || !data) {
    console.error("[companies] createCompany error:", error);
    throw new Error(error?.message ?? "Failed to create company");
  }

  const company = rowToCompany(data as DbCompany);

  // Crée une entrée ad_safety par défaut
  await supabase.from("ad_safety").insert({ company_id: company.id }).select();

  // Synchronise le mock en mémoire pour la cohérence session
  registerCompany(company);
  return company;
}

/**
 * Met à jour une company existante.
 * En mode mock, patch le tableau COMPANIES en mémoire.
 */
export async function updateCompany(
  id: string,
  patch: Partial<Omit<Company, "id">>
): Promise<Company> {
  if (!isSupabaseConfigured) {
    const idx = COMPANIES.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Company ${id} not found`);
    COMPANIES[idx] = { ...COMPANIES[idx], ...patch };
    return COMPANIES[idx];
  }

  const supabase = createClient();
  if (!supabase) {
    const idx = COMPANIES.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Company ${id} not found`);
    COMPANIES[idx] = { ...COMPANIES[idx], ...patch };
    return COMPANIES[idx];
  }

  const dbPatch: Partial<Omit<DbCompany, "id" | "org_id" | "created_at">> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.code !== undefined) dbPatch.code = patch.code;
  if (patch.brandVoice !== undefined) dbPatch.brand_voice = patch.brandVoice;
  if (patch.accent !== undefined) dbPatch.accent = patch.accent;
  if (patch.logoUrl !== undefined) dbPatch.logo_url = patch.logoUrl;
  if (patch.defaultPlatforms !== undefined) dbPatch.default_platforms = patch.defaultPlatforms;
  if (patch.defaultPostingTime !== undefined) dbPatch.default_posting_time = patch.defaultPostingTime;
  if (patch.defaultNeedsReview !== undefined) dbPatch.default_needs_review = patch.defaultNeedsReview;

  const { data, error } = await supabase
    .from("companies")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    console.error("[companies] updateCompany error:", error);
    throw new Error(error?.message ?? "Failed to update company");
  }

  const updated = rowToCompany(data as DbCompany);

  // Synchronise le mock en mémoire
  const idx = COMPANIES.findIndex((c) => c.id === id);
  if (idx >= 0) COMPANIES[idx] = updated;

  return updated;
}
