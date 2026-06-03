// Répertoire d'accès aux connexions de canaux par entité.
// Table : public.sh_channel_connections
// Colonnes : id, company_id uuid, channel text, status text, config jsonb,
//            connected_at, updated_at, created_at ; unique(company_id, channel).
//
// Dégradation gracieuse : si Supabase est absent → store en mémoire.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionStatus = "connected" | "pending" | "disconnected";

export interface ChannelConnection {
  id: string;
  company_id: string;
  channel: string;
  status: ConnectionStatus;
  /** config brute depuis la DB — les secrets y sont stockés chiffrés côté DB,
   *  mais sont présents ici côté serveur uniquement. Ne jamais exposer en clair
   *  dans les réponses HTTP. */
  config: Record<string, string>;
  connected_at: string | null;
  updated_at: string;
  created_at: string;
}

// ── Mock en mémoire (fallback sans Supabase) ──────────────────────────────────

const MOCK_STORE: ChannelConnection[] = [];

function mockFind(companyId: string, channel: string): ChannelConnection | undefined {
  return MOCK_STORE.find((r) => r.company_id === companyId && r.channel === channel);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

// ── listConnections ───────────────────────────────────────────────────────────

/**
 * Retourne toutes les connexions d'une entité.
 * Ne throw jamais — retourne [] en cas d'erreur.
 */
export async function listConnections(companyId: string): Promise<ChannelConnection[]> {
  if (!isSupabaseConfigured) {
    return MOCK_STORE.filter((r) => r.company_id === companyId);
  }

  try {
    const supabase = createClient();
    if (!supabase) return MOCK_STORE.filter((r) => r.company_id === companyId);

    const { data, error } = await supabase
      .from("sh_channel_connections")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at");

    if (error || !data) {
      console.error("[channel-connections] listConnections error:", error);
      return [];
    }

    return data as ChannelConnection[];
  } catch (err) {
    console.error("[channel-connections] listConnections exception:", err);
    return [];
  }
}

// ── getConnection ─────────────────────────────────────────────────────────────

/**
 * Retourne la connexion d'un canal pour une entité, ou null.
 * Ne throw jamais.
 */
export async function getConnection(
  companyId: string,
  channel: string
): Promise<ChannelConnection | null> {
  if (!isSupabaseConfigured) {
    return mockFind(companyId, channel) ?? null;
  }

  try {
    const supabase = createClient();
    if (!supabase) return mockFind(companyId, channel) ?? null;

    const { data, error } = await supabase
      .from("sh_channel_connections")
      .select("*")
      .eq("company_id", companyId)
      .eq("channel", channel)
      .maybeSingle();

    if (error) {
      console.error("[channel-connections] getConnection error:", error);
      return null;
    }

    return (data as ChannelConnection | null) ?? null;
  } catch (err) {
    console.error("[channel-connections] getConnection exception:", err);
    return null;
  }
}

// ── upsertConnection ──────────────────────────────────────────────────────────

/**
 * Crée ou met à jour la connexion d'un canal pour une entité.
 * En cas d'update partiel, les champs non fournis dans `config` sont fusionnés
 * avec les valeurs existantes (patch — on ne supprime pas un secret existant
 * si l'utilisateur laisse le champ vide).
 *
 * Ne throw jamais — retourne null en cas d'erreur.
 */
export async function upsertConnection(
  companyId: string,
  channel: string,
  config: Record<string, string>,
  status: ConnectionStatus = "pending"
): Promise<ChannelConnection | null> {
  const ts = now();

  if (!isSupabaseConfigured) {
    const existing = mockFind(companyId, channel);
    if (existing) {
      // Patch : on ne remplace un secret par une chaîne vide
      const merged = mergeConfig(existing.config, config);
      existing.config = merged;
      existing.status = status;
      existing.updated_at = ts;
      if (status === "connected") existing.connected_at = ts;
      return { ...existing };
    }

    const newRow: ChannelConnection = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      company_id: companyId,
      channel,
      status,
      config,
      connected_at: status === "connected" ? ts : null,
      updated_at: ts,
      created_at: ts,
    };
    MOCK_STORE.push(newRow);
    return { ...newRow };
  }

  try {
    const supabase = createClient();
    if (!supabase) return null;

    // Charge la config existante pour le merge (protection des secrets)
    const existing = await getConnection(companyId, channel);
    const mergedConfig = existing ? mergeConfig(existing.config, config) : config;

    const payload = {
      company_id: companyId,
      channel,
      status,
      config: mergedConfig,
      updated_at: ts,
      ...(status === "connected" ? { connected_at: ts } : {}),
    };

    const { data, error } = await supabase
      .from("sh_channel_connections")
      .upsert(payload, { onConflict: "company_id,channel" })
      .select()
      .single();

    if (error || !data) {
      console.error("[channel-connections] upsertConnection error:", error);
      return null;
    }

    return data as ChannelConnection;
  } catch (err) {
    console.error("[channel-connections] upsertConnection exception:", err);
    return null;
  }
}

// ── Utilitaire de merge config ────────────────────────────────────────────────

/**
 * Fusionne `next` dans `prev` :
 * - si une clé de `next` est vide ("") on conserve la valeur de `prev`
 *   (cas typique : l'utilisateur laisse un champ secret déjà enregistré vide).
 */
function mergeConfig(
  prev: Record<string, string>,
  next: Record<string, string>
): Record<string, string> {
  const result = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v !== "") result[k] = v;
  }
  return result;
}
