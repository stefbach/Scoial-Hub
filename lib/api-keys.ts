// Gestion des clés API personnelles (connecteur MCP Claude).
// Table : public.sh_api_keys — la clé en clair n'est JAMAIS stockée,
// seulement son hash SHA-256. On l'affiche une seule fois à la création.
//
// Dégradation gracieuse : si Supabase est absent → store en mémoire.

import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

const PREFIX = "axon_";

export interface ApiKeyRow {
  id: string;
  company_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: string | null;
  created_at: string;
}

/** Vue publique d'une clé (jamais le secret en clair, sauf à la création). */
export interface ApiKeyPublic {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

// ── Mock en mémoire (fallback sans Supabase) ──────────────────────────────────
const MOCK: ApiKeyRow[] = [];

// ── Crypto ────────────────────────────────────────────────────────────────────

export function hashKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

/** Génère une clé : "axon_" + 36 caractères base62. */
function generatePlain(): string {
  const raw = randomBytes(27).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 36);
  return PREFIX + raw;
}

function toPublic(r: ApiKeyRow): ApiKeyPublic {
  return {
    id: r.id,
    name: r.name,
    keyPrefix: r.key_prefix,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
  };
}

// ── Création ──────────────────────────────────────────────────────────────────

export async function createApiKey(
  companyId: string,
  name: string
): Promise<{ key: ApiKeyPublic; plaintext: string } | null> {
  const plaintext = generatePlain();
  const key_hash = hashKey(plaintext);
  const key_prefix = plaintext.slice(0, 12); // "axon_" + 7 chars
  const ts = new Date().toISOString();

  if (!isSupabaseConfigured) {
    const row: ApiKeyRow = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      company_id: companyId,
      name: name || "Clé MCP",
      key_prefix,
      key_hash,
      last_used_at: null,
      created_at: ts,
    };
    MOCK.push(row);
    return { key: toPublic(row), plaintext };
  }

  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sh_api_keys")
    .insert({ company_id: companyId, name: name || "Clé MCP", key_prefix, key_hash })
    .select()
    .single();

  if (error || !data) {
    console.error("[api-keys] createApiKey error:", error);
    return null;
  }
  return { key: toPublic(data as ApiKeyRow), plaintext };
}

// ── Liste ─────────────────────────────────────────────────────────────────────

export async function listApiKeys(companyId: string): Promise<ApiKeyPublic[]> {
  if (!isSupabaseConfigured) {
    return MOCK.filter((r) => r.company_id === companyId).map(toPublic);
  }
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sh_api_keys")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as ApiKeyRow[]).map(toPublic);
}

// ── Révocation ────────────────────────────────────────────────────────────────

export async function revokeApiKey(companyId: string, id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    const i = MOCK.findIndex((r) => r.id === id && r.company_id === companyId);
    if (i >= 0) MOCK.splice(i, 1);
    return i >= 0;
  }
  const supabase = createAdminClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("sh_api_keys")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  return !error;
}

// ── Vérification (utilisée par les endpoints MCP) ─────────────────────────────

/** Vérifie une clé en clair → renvoie le company_id associé, ou null. */
export async function verifyApiKey(plain: string): Promise<{ companyId: string } | null> {
  if (!plain || !plain.startsWith(PREFIX)) return null;
  const key_hash = hashKey(plain);

  if (!isSupabaseConfigured) {
    const row = MOCK.find((r) => r.key_hash === key_hash);
    if (!row) return null;
    row.last_used_at = new Date().toISOString();
    return { companyId: row.company_id };
  }

  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("sh_api_keys")
    .select("id, company_id")
    .eq("key_hash", key_hash)
    .maybeSingle();
  if (error || !data) return null;

  // Met à jour last_used_at (best-effort, non bloquant)
  void supabase
    .from("sh_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", (data as { id: string }).id);

  return { companyId: (data as { company_id: string }).company_id };
}
