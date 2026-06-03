/**
 * POST /api/telegram/webhook?company=<companyId>
 *
 * Reçoit les updates Telegram pour le bot associé à une entité.
 * Identifie l'entité via :
 *   1. Le paramètre ?company=<id> dans l'URL
 *   2. (optionnel) vérification du header X-Telegram-Bot-Api-Secret-Token
 *
 * Vérifie les allowed_chat_ids si définis, dispatche la commande,
 * répond toujours 200 à Telegram (obligation spec Bot API).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/repositories/channel-connections";
import { handleCommand } from "@/lib/telegram/dispatch";
import { sendMessage } from "@/lib/telegram/client";

// ── Types Telegram Update ─────────────────────────────────────────────────────

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Toujours répondre 200 à Telegram (même si on ignore l'update)
  const ok = NextResponse.json({ ok: true }, { status: 200 });

  try {
    // 1. Identifier le compte via ?company=
    const companyId = req.nextUrl.searchParams.get("company") ?? "";
    if (!companyId) {
      console.warn("[telegram/webhook] company manquant dans l'URL");
      return ok;
    }

    // 2. Charger la config Telegram de ce compte
    const conn = await getConnection(companyId, "telegram");
    if (!conn || conn.status !== "connected") {
      console.warn(`[telegram/webhook] compte ${companyId} non connecté`);
      return ok;
    }

    const config = conn.config as Record<string, string>;
    const botToken = config.bot_token ?? "";
    if (!botToken) {
      console.warn(`[telegram/webhook] pas de bot_token pour ${companyId}`);
      return ok;
    }

    // 3. Vérification optionnelle du secret token (header Telegram)
    const webhookSecret = config.webhook_secret ?? "";
    if (webhookSecret) {
      const incoming = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
      if (incoming !== webhookSecret) {
        console.warn(`[telegram/webhook] secret token invalide pour ${companyId}`);
        return ok;
      }
    }

    // 4. Parser le body Telegram
    let update: TelegramUpdate;
    try {
      update = (await req.json()) as TelegramUpdate;
    } catch {
      console.warn("[telegram/webhook] body JSON invalide");
      return ok;
    }

    // 5. Extraire le message (message ou edited_message)
    const message = update.message ?? update.edited_message ?? update.channel_post;
    if (!message || !message.text) {
      // Update sans texte (sticker, photo, etc.) → ignorer poliment
      return ok;
    }

    const chatId = message.chat.id;
    const text = message.text;

    // 6. Vérifier les chat IDs autorisés
    const allowedRaw = config.allowed_chat_ids ?? "";
    if (allowedRaw.trim()) {
      const allowed = allowedRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowed.length > 0 && !allowed.includes(String(chatId))) {
        console.info(`[telegram/webhook] chat ${chatId} non autorisé pour ${companyId}`);
        // Message poli de refus
        await sendMessage(
          botToken,
          chatId,
          "⛔ Accès non autorisé. Contactez l'administrateur de ce compte."
        );
        return ok;
      }
    }

    // 7. Dispatcher la commande
    const response = await handleCommand({ companyId, text, chatId });

    // 8. Envoyer la réponse au chat
    await sendMessage(botToken, chatId, response);
  } catch (err) {
    // Ne jamais laisser un 500 remonter à Telegram
    console.error("[telegram/webhook] erreur inattendue :", err);
  }

  return ok;
}
