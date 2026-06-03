/**
 * Repository pour les compétiteurs de veille (table sh_competitors).
 * Dégradation gracieuse : mock en mémoire si Supabase non configuré.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { ScrapeNetwork } from "@/lib/scraping/types";

/* ─────────────────────────────────────────────────────────────────────────────
   Type métier
───────────────────────────────────────────────────────────────────────────── */

export interface Competitor {
  id: string;
  companyId: string;
  network: ScrapeNetwork;
  handle: string;
  name: string;
  source: string;
  metrics: Record<string, unknown>;
  createdAt: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mock en mémoire (par companyId)
───────────────────────────────────────────────────────────────────────────── */

const MOCK_STORE: Map<string, Competitor[]> = new Map();

function getMock(companyId: string): Competitor[] {
  if (!MOCK_STORE.has(companyId)) {
    // Données d'exemple préremplies
    MOCK_STORE.set(companyId, [
      {
        id: `mock-1-${companyId}`,
        companyId,
        network: "instagram",
        handle: "@concurrent_mode",
        name: "Concurrent Mode",
        source: "manuel",
        metrics: {},
        createdAt: new Date().toISOString(),
      },
      {
        id: `mock-2-${companyId}`,
        companyId,
        network: "tiktok",
        handle: "@tendance_fr",
        name: "Tendance FR",
        source: "identifié",
        metrics: {},
        createdAt: new Date().toISOString(),
      },
    ]);
  }
  return MOCK_STORE.get(companyId)!;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mapper DB → métier
───────────────────────────────────────────────────────────────────────────── */

function rowToCompetitor(row: Record<string, unknown>): Competitor {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    network: row.network as ScrapeNetwork,
    handle: String(row.handle),
    name: String(row.name ?? row.handle),
    source: String(row.source ?? "manuel"),
    metrics: (row.metrics as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Repository
───────────────────────────────────────────────────────────────────────────── */

/** Liste les compétiteurs d'une company. */
export async function listCompetitors(companyId: string): Promise<Competitor[]> {
  if (!isSupabaseConfigured) {
    return getMock(companyId);
  }

  const supabase = createAdminClient();
  // En mode Supabase : jamais de faux concurrents. Un vrai compte démarre vide,
  // l'utilisateur ajoute ses propres concurrents réels.
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("sh_competitors")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[competitors] Supabase list error:", error.message);
    return [];
  }

  return (data ?? []).map(rowToCompetitor);
}

/** Ajoute un compétiteur. */
export async function addCompetitor(
  input: Pick<Competitor, "companyId" | "network" | "handle" | "name" | "source">
): Promise<Competitor> {
  if (!isSupabaseConfigured) {
    const newItem: Competitor = {
      id: `mock-${Date.now()}`,
      ...input,
      metrics: {},
      createdAt: new Date().toISOString(),
    };
    const list = getMock(input.companyId);
    list.unshift(newItem);
    return newItem;
  }

  const supabase = createAdminClient();
  if (!supabase) {
    const newItem: Competitor = {
      id: `mock-${Date.now()}`,
      ...input,
      metrics: {},
      createdAt: new Date().toISOString(),
    };
    const list = getMock(input.companyId);
    list.unshift(newItem);
    return newItem;
  }

  const { data, error } = await supabase
    .from("sh_competitors")
    .insert({
      company_id: input.companyId,
      network: input.network,
      handle: input.handle,
      name: input.name,
      source: input.source,
      metrics: {},
    })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[competitors] Supabase insert error:", error?.message);
    const newItem: Competitor = {
      id: `mock-${Date.now()}`,
      ...input,
      metrics: {},
      createdAt: new Date().toISOString(),
    };
    return newItem;
  }

  return rowToCompetitor(data as Record<string, unknown>);
}

/** Supprime un compétiteur par id. */
export async function removeCompetitor(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    for (const [key, list] of MOCK_STORE.entries()) {
      const idx = list.findIndex((c) => c.id === id);
      if (idx !== -1) {
        list.splice(idx, 1);
        MOCK_STORE.set(key, list);
        return;
      }
    }
    return;
  }

  const supabase = createAdminClient();
  if (!supabase) return;

  const { error } = await supabase.from("sh_competitors").delete().eq("id", id);
  if (error) console.warn("[competitors] Supabase delete error:", error.message);
}
