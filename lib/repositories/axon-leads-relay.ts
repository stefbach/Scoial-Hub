// Relais best-effort des leads Meta vers le projet Supabase d'axon-ai.tech —
// tables indépendantes (`leads_facebook_tibok`, `leads_facebook_occ`), sans
// rapport avec le pipeline `facebook_lead_configs` déjà en prod là-bas (pas de
// queue d'appel, pas de trigger BMI/éligibilité). Un échec ici ne doit jamais
// faire échouer l'ingestion locale (sh_leads) : le relais est une best-effort
// secondaire, appelée après l'insertion locale déjà réussie.

import { createClient } from "@supabase/supabase-js";

const AXON_SUPABASE_URL = (process.env.AXON_LEADS_SUPABASE_URL ?? "").trim();
const AXON_SUPABASE_SERVICE_ROLE_KEY = (process.env.AXON_LEADS_SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

/** Table axon-ai.tech par page_id Meta connu. Ajouter une entrée ici suffit à
 *  activer le relais pour une nouvelle société — aucun autre changement requis. */
const TABLE_BY_PAGE_ID: Record<string, string> = {
  "629672543572599": "leads_facebook_tibok", // TIBOK MU - Télémédecine Maurice
  "115871611517429": "leads_facebook_occ", // Obesity Care Clinic
};

export interface RelayLeadInput {
  pageId: string;
  leadgenId: string;
  formId?: string;
  adId?: string;
  adgroupId?: string;
  fieldData: Record<string, string>;
  raw: Record<string, unknown>;
  leadCreatedAt?: string;
}

/**
 * Relaie un lead déjà inséré dans sh_leads vers la table axon-ai.tech dédiée à
 * sa société, si son page_id en a une. No-op silencieux si :
 *  - le page_id n'a pas de table associée (société non concernée),
 *  - les identifiants axon-ai.tech ne sont pas configurés (dégradation gracieuse).
 * Ne throw jamais.
 */
export async function relayLeadToAxon(input: RelayLeadInput): Promise<void> {
  const table = TABLE_BY_PAGE_ID[input.pageId];
  if (!table) return;
  if (!AXON_SUPABASE_URL || !AXON_SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[axon-leads-relay] AXON_LEADS_SUPABASE_* absent — relais désactivé.");
    return;
  }

  try {
    const sb = createClient(AXON_SUPABASE_URL, AXON_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const fd = input.fieldData;
    const nom =
      fd.full_name ||
      [fd.first_name, fd.last_name].filter(Boolean).join(" ") ||
      null;
    const telephone = fd.phone_number || fd.phone || fd.mobile || null;
    const email = fd.email || null;

    const { error } = await sb.from(table).upsert(
      {
        nom,
        telephone,
        email,
        leadgen_id: input.leadgenId,
        page_id: input.pageId,
        form_id: input.formId || null,
        ad_id: input.adId || null,
        adgroup_id: input.adgroupId || null,
        field_data: fd,
        raw: input.raw,
        lead_created_at: input.leadCreatedAt ?? null,
      },
      { onConflict: "leadgen_id", ignoreDuplicates: true }
    );

    if (error) {
      console.error(`[axon-leads-relay] upsert ${table} error:`, error);
    }
  } catch (err) {
    console.error(`[axon-leads-relay] exception (page ${input.pageId}):`, err);
  }
}
