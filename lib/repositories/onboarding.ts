// Répertoire d'accès aux profils de marque et aux états d'onboarding.
// Tables :
//   public.sh_brand_profiles  (company_id uuid PRIMARY KEY, …)
//   public.sh_onboarding_state (company_id uuid PRIMARY KEY, …)
//
// Dégradation gracieuse : si Supabase est absent → store en mémoire (Map).
// Ne throw jamais.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import {
  BrandProfile,
  OnboardingState,
  makeEmptyOnboardingState,
} from "@/lib/onboarding/types";

// ── Stores en mémoire (fallback sans Supabase) ────────────────────────────────

const BRAND_PROFILE_STORE = new Map<string, BrandProfile>();
const ONBOARDING_STATE_STORE = new Map<string, OnboardingState>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

// ── getBrandProfile ───────────────────────────────────────────────────────────

/**
 * Retourne le profil de marque d'une société, ou null si absent.
 * Préfère la colonne `raw` (objet JSON complet) quand elle est disponible.
 * Ne throw jamais.
 */
export async function getBrandProfile(companyId: string): Promise<BrandProfile | null> {
  // Fallback mémoire
  if (!isSupabaseConfigured) {
    return BRAND_PROFILE_STORE.get(companyId) ?? null;
  }

  try {
    const supabase = createClient();
    if (!supabase) return BRAND_PROFILE_STORE.get(companyId) ?? null;

    const uuid = await resolveCompanyUuid(companyId);

    const { data: row, error } = await supabase
      .from("sh_brand_profiles")
      .select("*")
      .eq("company_id", uuid)
      .maybeSingle();

    if (error) {
      console.error("[onboarding] getBrandProfile error:", error);
      return null;
    }

    if (!row) return null;

    // La colonne `raw` stocke l'objet BrandProfile complet — priorité maximale
    if (row.raw && typeof row.raw === "object") {
      return { ...(row.raw as BrandProfile), companyId };
    }

    // Reconstruction depuis les colonnes individuelles (compatibilité)
    return {
      companyId,
      website: row.website ?? "",
      handles: (row.handles as BrandProfile["handles"]) ?? {},
      description: "",
      summary: row.summary ?? "",
      positioning: row.positioning ?? "",
      tone: row.tone ?? "",
      audience: row.audience ?? "",
      themes: (row.themes as string[]) ?? [],
      strengths: (row.strengths as string[]) ?? [],
      mission: "",
      values: [],
      keyMessage: "",
      personality: [],
      visualDirection: "",
      philosophyLocked: false,
      keywords: [],
      recommendedNetworks: [],
      competitorAngles: [],
      suggestedObjectives:
        (row.suggested_objectives as BrandProfile["suggestedObjectives"]) ?? [],
      aiGenerated: false,
      analyzedAt: row.analyzed_at ?? null,
    };
  } catch (err) {
    console.error("[onboarding] getBrandProfile exception:", err);
    return null;
  }
}

// ── saveBrandProfile ──────────────────────────────────────────────────────────

/**
 * Persiste (insert ou update) un profil de marque.
 * Stocke l'objet complet dans `raw` pour une relecture fidèle.
 * Ne throw jamais — retourne le profil transmis.
 */
export async function saveBrandProfile(profile: BrandProfile): Promise<BrandProfile> {
  // Fallback mémoire
  if (!isSupabaseConfigured) {
    BRAND_PROFILE_STORE.set(profile.companyId, profile);
    return profile;
  }

  try {
    const supabase = createClient();
    if (!supabase) {
      BRAND_PROFILE_STORE.set(profile.companyId, profile);
      return profile;
    }

    const uuid = await resolveCompanyUuid(profile.companyId);

    const payload = {
      company_id: uuid,
      website: profile.website,
      handles: profile.handles,
      summary: profile.summary,
      positioning: profile.positioning,
      tone: profile.tone,
      audience: profile.audience,
      themes: profile.themes,
      strengths: profile.strengths,
      suggested_objectives: profile.suggestedObjectives,
      // Stocke l'objet complet pour garantir une relecture intégrale
      raw: profile,
      analyzed_at: profile.analyzedAt,
      updated_at: now(),
    };

    const { error } = await supabase
      .from("sh_brand_profiles")
      .upsert(payload, { onConflict: "company_id" });

    if (error) {
      console.error("[onboarding] saveBrandProfile error:", error);
    }
  } catch (err) {
    console.error("[onboarding] saveBrandProfile exception:", err);
  }

  return profile;
}

// ── getOnboardingState ────────────────────────────────────────────────────────

/**
 * Retourne l'état d'onboarding d'une société.
 * Si aucun enregistrement n'existe, retourne l'état vierge par défaut.
 * Ne throw jamais.
 */
export async function getOnboardingState(companyId: string): Promise<OnboardingState> {
  // Fallback mémoire
  if (!isSupabaseConfigured) {
    return ONBOARDING_STATE_STORE.get(companyId) ?? makeEmptyOnboardingState(companyId);
  }

  try {
    const supabase = createClient();
    if (!supabase) {
      return ONBOARDING_STATE_STORE.get(companyId) ?? makeEmptyOnboardingState(companyId);
    }

    const uuid = await resolveCompanyUuid(companyId);

    const { data: row, error } = await supabase
      .from("sh_onboarding_state")
      .select("*")
      .eq("company_id", uuid)
      .maybeSingle();

    if (error) {
      console.error("[onboarding] getOnboardingState error:", error);
      return makeEmptyOnboardingState(companyId);
    }

    if (!row) return makeEmptyOnboardingState(companyId);

    // Mapping colonnes DB → OnboardingState (défensif sur les jsonb nullables)
    return {
      companyId,
      step: row.step ?? 1,
      objectives: (row.objectives as string[]) ?? [],
      networks: (row.networks as OnboardingState["networks"]) ?? [],
      campaignCount: row.campaign_count ?? 1,
      geo: (row.geo as OnboardingState["geo"]) ?? { countries: [] },
      creativeMode: (row.creative_mode as OnboardingState["creativeMode"]) ?? null,
      campaignType: (row.campaign_type as OnboardingState["campaignType"]) ?? null,
      schedule: (row.schedule as OnboardingState["schedule"]) ?? {},
      completed: row.completed ?? false,
      updatedAt: row.updated_at ?? now(),
    };
  } catch (err) {
    console.error("[onboarding] getOnboardingState exception:", err);
    return makeEmptyOnboardingState(companyId);
  }
}

// ── saveOnboardingState ───────────────────────────────────────────────────────

/**
 * Applique un patch partiel sur l'état d'onboarding et le persiste.
 * Les champs `companyId` et `updatedAt` du patch sont ignorés.
 * Ne throw jamais — retourne l'état fusionné.
 */
export async function saveOnboardingState(
  companyId: string,
  patch: Partial<OnboardingState>
): Promise<OnboardingState> {
  // Lecture de l'état existant, puis fusion du patch
  const existing = await getOnboardingState(companyId);

  // On ignore les champs réservés éventuellement présents dans le patch
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { companyId: _cid, updatedAt: _uat, ...safePatch } = patch as Partial<OnboardingState> & {
    companyId?: string;
    updatedAt?: string;
  };

  const merged: OnboardingState = {
    ...existing,
    ...safePatch,
    companyId,
    updatedAt: now(),
  };

  // Fallback mémoire
  if (!isSupabaseConfigured) {
    ONBOARDING_STATE_STORE.set(companyId, merged);
    return merged;
  }

  try {
    const supabase = createClient();
    if (!supabase) {
      ONBOARDING_STATE_STORE.set(companyId, merged);
      return merged;
    }

    const uuid = await resolveCompanyUuid(companyId);

    const payload = {
      company_id: uuid,
      step: merged.step,
      objectives: merged.objectives,
      networks: merged.networks,
      campaign_count: merged.campaignCount,
      geo: merged.geo,
      creative_mode: merged.creativeMode,
      campaign_type: merged.campaignType,
      schedule: merged.schedule,
      completed: merged.completed,
      updated_at: merged.updatedAt,
    };

    const { error } = await supabase
      .from("sh_onboarding_state")
      .upsert(payload, { onConflict: "company_id" });

    if (error) {
      console.error("[onboarding] saveOnboardingState error:", error);
    }
  } catch (err) {
    console.error("[onboarding] saveOnboardingState exception:", err);
  }

  return merged;
}
