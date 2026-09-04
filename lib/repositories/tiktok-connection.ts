// Répertoire d'accès à la connexion TikTok — Brique 2 (partielle) : table
// DÉDIÉE à TikTok (public.sh_tiktok_connections), volontairement séparée de
// sh_channel_connections que partagent Facebook/Instagram/LinkedIn. Une seule
// connexion par société (unique(company_id)) : pas de notion de "channel",
// contrairement au répertoire générique.
//
// Le reste du pipeline TikTok (posts programmés, cron, historique) continue
// d'utiliser les tables génériques — seule la connexion/le token est isolé.
//
// Dégradation gracieuse : si Supabase est absent → store en mémoire.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

export type TikTokConnectionStatus = "connected" | "pending" | "disconnected";

export interface TikTokConnection {
  id: string;
  company_id: string;
  status: TikTokConnectionStatus;
  account_name: string | null;
  external_id: string | null;
  /** Déchiffré pour les appelants serveur — ne jamais renvoyer en clair au client. */
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface TikTokConnectionPatch {
  accountName?: string;
  externalId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}

// ── Mock en mémoire (fallback sans Supabase) ──────────────────────────────────

const MOCK_STORE: TikTokConnection[] = [];

function now(): string {
  return new Date().toISOString();
}

function decryptRow(row: TikTokConnection): TikTokConnection {
  return {
    ...row,
    access_token: row.access_token ? decryptSecret(row.access_token) : row.access_token,
    refresh_token: row.refresh_token ? decryptSecret(row.refresh_token) : row.refresh_token,
  };
}

// ── Lecture ───────────────────────────────────────────────────────────────────

/** Ne throw jamais — retourne null en cas d'absence ou d'erreur. */
export async function getTikTokConnection(companyId: string): Promise<TikTokConnection | null> {
  if (!isSupabaseConfigured) {
    const m = MOCK_STORE.find((r) => r.company_id === companyId);
    return m ? decryptRow(m) : null;
  }
  try {
    const supabase = createClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("sh_tiktok_connections")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) {
      console.error("[tiktok-connection] getTikTokConnection error:", error);
      return null;
    }
    return data ? decryptRow(data as TikTokConnection) : null;
  } catch (err) {
    console.error("[tiktok-connection] getTikTokConnection exception:", err);
    return null;
  }
}

/** Variante admin — client service_role (bypass RLS), pour le cron. Ne throw jamais. */
export async function getTikTokConnectionAdmin(companyId: string): Promise<TikTokConnection | null> {
  if (!isSupabaseConfigured) {
    const m = MOCK_STORE.find((r) => r.company_id === companyId);
    return m ? decryptRow(m) : null;
  }
  try {
    const supabase = createAdminClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("sh_tiktok_connections")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) {
      console.error("[tiktok-connection] getTikTokConnectionAdmin error:", error);
      return null;
    }
    return data ? decryptRow(data as TikTokConnection) : null;
  } catch (err) {
    console.error("[tiktok-connection] getTikTokConnectionAdmin exception:", err);
    return null;
  }
}

// ── Écriture ──────────────────────────────────────────────────────────────────

/** Crée ou met à jour la connexion TikTok d'une société. Ne throw jamais. */
export async function upsertTikTokConnection(
  companyId: string,
  patch: TikTokConnectionPatch,
  status: TikTokConnectionStatus = "connected"
): Promise<TikTokConnection | null> {
  const ts = now();

  if (!isSupabaseConfigured) {
    let existing = MOCK_STORE.find((r) => r.company_id === companyId);
    if (!existing) {
      existing = {
        id: `mock-${Date.now()}`,
        company_id: companyId,
        status,
        account_name: null,
        external_id: null,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        connected_at: null,
        updated_at: ts,
        created_at: ts,
      };
      MOCK_STORE.push(existing);
    }
    existing.status = status;
    existing.updated_at = ts;
    if (status === "connected") existing.connected_at = ts;
    if (patch.accountName !== undefined) existing.account_name = patch.accountName;
    if (patch.externalId !== undefined) existing.external_id = patch.externalId;
    if (patch.accessToken !== undefined) existing.access_token = encryptSecret(patch.accessToken);
    if (patch.refreshToken !== undefined) existing.refresh_token = encryptSecret(patch.refreshToken);
    if (patch.tokenExpiresAt !== undefined) existing.token_expires_at = patch.tokenExpiresAt;
    return decryptRow({ ...existing });
  }

  try {
    const supabase = createClient();
    if (!supabase) return null;

    const payload: Record<string, unknown> = {
      company_id: companyId,
      status,
      updated_at: ts,
      ...(status === "connected" ? { connected_at: ts } : {}),
    };
    if (patch.accountName !== undefined) payload.account_name = patch.accountName;
    if (patch.externalId !== undefined) payload.external_id = patch.externalId;
    if (patch.accessToken !== undefined) payload.access_token = encryptSecret(patch.accessToken);
    if (patch.refreshToken !== undefined) payload.refresh_token = encryptSecret(patch.refreshToken);
    if (patch.tokenExpiresAt !== undefined) payload.token_expires_at = patch.tokenExpiresAt;

    const { data, error } = await supabase
      .from("sh_tiktok_connections")
      .upsert(payload, { onConflict: "company_id" })
      .select()
      .single();

    if (error || !data) {
      console.error("[tiktok-connection] upsertTikTokConnection error:", error);
      return null;
    }
    return decryptRow(data as TikTokConnection);
  } catch (err) {
    console.error("[tiktok-connection] upsertTikTokConnection exception:", err);
    return null;
  }
}

/**
 * Déconnexion initiée par l'utilisateur (bouton « Déconnecter ») : statut
 * `disconnected` + tokens vidés (révoqués côté app immédiatement).
 * Ne throw jamais.
 */
export async function disconnectTikTokConnection(companyId: string): Promise<void> {
  const ts = now();

  if (!isSupabaseConfigured) {
    const existing = MOCK_STORE.find((r) => r.company_id === companyId);
    if (existing) {
      existing.status = "disconnected";
      existing.access_token = null;
      existing.refresh_token = null;
      existing.updated_at = ts;
    }
    return;
  }

  try {
    const supabase = createClient();
    if (!supabase) return;
    await supabase
      .from("sh_tiktok_connections")
      .update({ status: "disconnected", access_token: null, refresh_token: null, updated_at: ts })
      .eq("company_id", companyId);
  } catch (err) {
    console.error("[tiktok-connection] disconnectTikTokConnection exception:", err);
  }
}
