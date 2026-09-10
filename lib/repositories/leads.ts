// Répertoire d'accès aux leads Meta (Lead Ads) ingérés par /api/inbox/webhook.
// Table : public.sh_leads. Écrit via le client service_role (le webhook Meta
// n'a pas de session utilisateur). Ne throw jamais.

import { createAdminClient } from "@/lib/supabase/server";

export interface LeadRecord {
  id: string;
  company_id: string;
  leadgen_id: string;
  page_id: string | null;
  form_id: string | null;
  ad_id: string | null;
  adgroup_id: string | null;
  field_data: Record<string, string>;
  raw: Record<string, unknown>;
  lead_created_at: string | null;
  created_at: string;
}

export interface InsertLeadInput {
  companyId: string;
  leadgenId: string;
  pageId?: string;
  formId?: string;
  adId?: string;
  adgroupId?: string;
  fieldData: Record<string, string>;
  raw: Record<string, unknown>;
  leadCreatedAt?: string;
}

/**
 * Insère un lead (idempotent sur leadgen_id) ou ignore silencieusement s'il
 * existe déjà — Meta peut renvoyer le même événement plusieurs fois (retries).
 */
export async function insertLead(input: InsertLeadInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { error } = await supabase.from("sh_leads").upsert(
      {
        company_id: input.companyId,
        leadgen_id: input.leadgenId,
        page_id: input.pageId,
        form_id: input.formId,
        ad_id: input.adId,
        adgroup_id: input.adgroupId,
        field_data: input.fieldData,
        raw: input.raw,
        lead_created_at: input.leadCreatedAt ?? null,
      },
      { onConflict: "leadgen_id", ignoreDuplicates: true }
    );

    if (error) {
      console.error("[leads] insertLead error:", error);
    }
  } catch (err) {
    console.error("[leads] insertLead exception:", err);
  }
}

/**
 * Liste les leads d'une société (les plus récents d'abord). Ne throw jamais.
 */
export async function listLeads(companyId: string, limit = 100): Promise<LeadRecord[]> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("sh_leads")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[leads] listLeads error:", error);
      return [];
    }
    return data as LeadRecord[];
  } catch (err) {
    console.error("[leads] listLeads exception:", err);
    return [];
  }
}
