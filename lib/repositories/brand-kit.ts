// Répertoire d'accès au brand kit persistant (public.sh_brand_kits).
// Utilise le client admin (service-role) — l'autorisation est assurée en amont
// par requireCompanyAccess dans les routes API. Ne throw jamais : dégradation
// gracieuse vers un store mémoire si Supabase est absent.

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { BrandKit, makeEmptyBrandKit } from "@/lib/brand-kit/types";

const STORE = new Map<string, BrandKit>();

function rowToKit(companyId: string, row: Record<string, unknown>): BrandKit {
  return {
    companyId,
    logoUrl: (row.logo_url as string) ?? "",
    charteUrl: (row.charte_url as string) ?? "",
    palette: Array.isArray(row.palette) ? (row.palette as string[]) : [],
    recommendedTextColor: (row.recommended_text_color as string) ?? "#ffffff",
    style: (row.style as string) ?? "",
    tone: (row.tone as string) ?? "",
    promptHints: (row.prompt_hints as string) ?? "",
    summary: (row.summary as string) ?? "",
    aiGenerated: Boolean(row.ai_generated),
    updatedAt: (row.updated_at as string) ?? null,
  };
}

/** Retourne le brand kit d'une société, ou null si absent. Ne throw jamais. */
export async function getBrandKit(companyId: string): Promise<BrandKit | null> {
  if (!isSupabaseConfigured) return STORE.get(companyId) ?? null;
  try {
    const sb = createAdminClient();
    if (!sb) return STORE.get(companyId) ?? null;
    const uuid = await resolveCompanyUuid(companyId);
    const { data, error } = await sb
      .from("sh_brand_kits")
      .select("*")
      .eq("company_id", uuid)
      .maybeSingle();
    if (error) {
      console.error("[brand-kit] get error:", error);
      return null;
    }
    return data ? rowToKit(companyId, data) : null;
  } catch (e) {
    console.error("[brand-kit] get exception:", e);
    return null;
  }
}

/** Persiste (upsert) le brand kit. Ne throw jamais — retourne le kit fusionné. */
export async function saveBrandKit(
  companyId: string,
  patch: Partial<BrandKit>
): Promise<BrandKit> {
  const existing = (await getBrandKit(companyId)) ?? makeEmptyBrandKit(companyId);
  const merged: BrandKit = {
    ...existing,
    ...patch,
    companyId,
    updatedAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    STORE.set(companyId, merged);
    return merged;
  }
  try {
    const sb = createAdminClient();
    if (!sb) {
      STORE.set(companyId, merged);
      return merged;
    }
    const uuid = await resolveCompanyUuid(companyId);
    const { error } = await sb.from("sh_brand_kits").upsert(
      {
        company_id: uuid,
        logo_url: merged.logoUrl,
        charte_url: merged.charteUrl,
        palette: merged.palette,
        recommended_text_color: merged.recommendedTextColor,
        style: merged.style,
        tone: merged.tone,
        prompt_hints: merged.promptHints,
        summary: merged.summary,
        ai_generated: merged.aiGenerated,
        updated_at: merged.updatedAt,
      },
      { onConflict: "company_id" }
    );
    if (error) console.error("[brand-kit] save error:", error);
  } catch (e) {
    console.error("[brand-kit] save exception:", e);
  }
  return merged;
}
