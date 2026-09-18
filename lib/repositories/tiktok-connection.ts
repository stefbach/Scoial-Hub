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

/** Écrit la connexion en base via le client Supabase donné (user ou admin). */
async function writeTikTokConnection(
  supabase: ReturnType<typeof createClient> | ReturnType<typeof createAdminClient>,
  companyId: string,
  patch: TikTokConnectionPatch,
  status: TikTokConnectionStatus,
  ts: string,
  logLabel: string
): Promise<TikTokConnection | null> {
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
    console.error(`[tiktok-connection] ${logLabel} error:`, error);
    return null;
  }
  return decryptRow(data as TikTokConnection);
}

function upsertMock(
  companyId: string,
  patch: TikTokConnectionPatch,
  status: TikTokConnectionStatus,
  ts: string
): TikTokConnection {
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

/** Crée ou met à jour la connexion TikTok d'une société. Ne throw jamais. */
export async function upsertTikTokConnection(
  companyId: string,
  patch: TikTokConnectionPatch,
  status: TikTokConnectionStatus = "connected"
): Promise<TikTokConnection | null> {
  const ts = now();
  if (!isSupabaseConfigured) return upsertMock(companyId, patch, status, ts);
  try {
    return await writeTikTokConnection(createClient(), companyId, patch, status, ts, "upsertTikTokConnection");
  } catch (err) {
    console.error("[tiktok-connection] upsertTikTokConnection exception:", err);
    return null;
  }
}

/** Variante admin (service_role) — pour les rafraîchissements de token déclenchés par un cron. Ne throw jamais. */
export async function upsertTikTokConnectionAdmin(
  companyId: string,
  patch: TikTokConnectionPatch,
  status: TikTokConnectionStatus = "connected"
): Promise<TikTokConnection | null> {
  const ts = now();
  if (!isSupabaseConfigured) return upsertMock(companyId, patch, status, ts);
  try {
    return await writeTikTokConnection(createAdminClient(), companyId, patch, status, ts, "upsertTikTokConnectionAdmin");
  } catch (err) {
    console.error("[tiktok-connection] upsertTikTokConnectionAdmin exception:", err);
    return null;
  }
}

// ── Token toujours valide (rafraîchissement transparent) ──────────────────────

const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
/** Marge de sécurité avant l'expiration réelle, pour ne pas utiliser un token
 * qui expire pendant l'appel qui s'apprête à le consommer. */
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/**
 * Retourne la connexion TikTok avec un `access_token` VALIDE, en le
 * rafraîchissant via `refresh_token` si le token stocké est expiré ou proche
 * de l'expiration (TikTok : access_token ~24h, refresh_token ~365 jours).
 *
 * Root cause du "access_token_invalid" observé sur /compose (Réglages
 * TikTok) et potentiellement sur toute publication/cron TikTok plus de ~24h
 * après la connexion : `refresh_token` et `token_expires_at` étaient bien
 * capturés à la connexion (callback OAuth) mais jamais utilisés ensuite —
 * tous les appelants lisaient `access_token` tel quel. Ce helper centralise
 * le rafraîchissement pour ne plus avoir à le refaire à chaque appelant.
 *
 * `admin: true` utilise le client service_role (cron, sans session
 * utilisateur) pour la lecture ET la persistance du nouveau token.
 *
 * Retourne `null` si aucune connexion active, ou si le refresh_token
 * lui-même est expiré/révoqué (reconnexion manuelle requise dans Comptes &
 * connexions) — sinon la connexion (éventuellement rafraîchie, sans garantie
 * que la persistance ait réussi : le nouveau token est quand même renvoyé
 * pour l'appel en cours).
 */
export async function getValidTikTokConnection(
  companyId: string,
  opts: { admin?: boolean } = {}
): Promise<TikTokConnection | null> {
  const conn = opts.admin ? await getTikTokConnectionAdmin(companyId) : await getTikTokConnection(companyId);
  if (!conn || conn.status !== "connected" || !conn.access_token) return null;

  const expiresAtMs = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : NaN;
  const needsRefresh = Number.isFinite(expiresAtMs) && expiresAtMs - TOKEN_EXPIRY_MARGIN_MS < Date.now();
  if (!needsRefresh) return conn;
  // Pas de refresh_token connu (ex. mode simulé, connexion ancienne) : rien à
  // rafraîchir, on tente l'appel avec le token existant tel quel.
  if (!conn.refresh_token) return conn;

  const clientKey = (process.env.TIKTOK_CLIENT_KEY ?? "").trim();
  const clientSecret = (process.env.TIKTOK_CLIENT_SECRET ?? "").trim();
  if (!clientKey || !clientSecret) return conn; // provider non configuré : rien à rafraîchir

  try {
    const form = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    });
    const res = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      console.warn(
        "[tiktok-connection] rafraîchissement du token échoué — reconnexion nécessaire :",
        json.error ?? res.status,
        json.error_description ?? ""
      );
      return null;
    }

    const merged: TikTokConnection = {
      ...conn,
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? conn.refresh_token,
      token_expires_at: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : conn.token_expires_at,
    };
    const patch: TikTokConnectionPatch = {
      accessToken: merged.access_token!,
      ...(json.refresh_token ? { refreshToken: json.refresh_token } : {}),
      ...(json.expires_in ? { tokenExpiresAt: merged.token_expires_at! } : {}),
    };
    // Best-effort : si la persistance échoue, le token rafraîchi sert quand
    // même à l'appel en cours (prochain appel referafraîchira).
    if (opts.admin) await upsertTikTokConnectionAdmin(companyId, patch);
    else await upsertTikTokConnection(companyId, patch);
    return merged;
  } catch (err) {
    console.error("[tiktok-connection] rafraîchissement exception:", err);
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
