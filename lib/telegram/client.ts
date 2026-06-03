/**
 * Helpers minimalistes pour l'API Bot Telegram.
 * Tous les appels utilisent fetch natif, ne throwent jamais au chargement,
 * et retournent { ok, data, error } pour une gestion explicite.
 *
 * Doc : https://core.telegram.org/bots/api
 */

const BASE = "https://api.telegram.org";

// ── Types internes ─────────────────────────────────────────────────────────────

export interface TelegramResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface TgApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

// ── Utilitaire bas niveau ──────────────────────────────────────────────────────

async function callApi<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramResult<T>> {
  if (!token || !token.trim()) {
    return { ok: false, error: "Token du bot manquant." };
  }

  try {
    const res = await fetch(`${BASE}/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      // Pas de cache — les webhooks sont sensibles au temps réel
      cache: "no-store",
    });

    const json = (await res.json()) as TgApiResponse<T>;

    if (!json.ok) {
      return { ok: false, error: json.description ?? `Erreur Telegram (${res.status})` };
    }

    return { ok: true, data: json.result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur réseau inconnue";
    return { ok: false, error: msg };
  }
}

// ── Méthodes publiques ─────────────────────────────────────────────────────────

/**
 * Envoie un message texte (Markdown supporté via parse_mode).
 */
export async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  parseMode: "Markdown" | "HTML" | undefined = "Markdown"
): Promise<TelegramResult<{ message_id: number }>> {
  return callApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

/**
 * Enregistre l'URL du webhook pour ce bot.
 * `secretToken` est un header que Telegram renverra dans chaque update
 * pour vérifier l'authenticité (X-Telegram-Bot-Api-Secret-Token).
 */
export async function setWebhook(
  token: string,
  url: string,
  secretToken?: string
): Promise<TelegramResult<boolean>> {
  const body: Record<string, unknown> = { url };
  if (secretToken) body.secret_token = secretToken;
  return callApi<boolean>(token, "setWebhook", body);
}

/**
 * Supprime le webhook du bot (passe en mode polling désactivé).
 */
export async function deleteWebhook(token: string): Promise<TelegramResult<boolean>> {
  return callApi<boolean>(token, "deleteWebhook", { drop_pending_updates: false });
}

/**
 * Retourne les informations du bot (username, first_name, id…).
 */
export interface BotInfo {
  id: number;
  username: string;
  first_name: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
}

export async function getMe(token: string): Promise<TelegramResult<BotInfo>> {
  return callApi<BotInfo>(token, "getMe");
}
