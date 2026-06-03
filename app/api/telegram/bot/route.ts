/**
 * POST /api/telegram/bot
 * Webhook du BOT CENTRAL AXON-AI (un seul bot pour tous les comptes).
 *
 * Routage :
 *   • "/start <CODE>"  → relie le chat à l'entité dont le pairing_code = CODE
 *   • autre message    → résout l'entité via les chats déjà reliés, puis dispatch
 *
 * Le token du bot vient de l'env (TELEGRAM_BOT_TOKEN). Répond toujours 200.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { listByChannel, upsertConnection } from "@/lib/repositories/channel-connections";
import { listCompanies } from "@/lib/repositories/companies";
import { handleCommand } from "@/lib/telegram/dispatch";
import { sendMessage } from "@/lib/telegram/client";
import { env } from "@/lib/env";

async function companyName(companyId: string): Promise<string> {
  try {
    const companies = await listCompanies();
    return companies.find((c) => c.id === companyId)?.name ?? "votre compte";
  } catch {
    return "votre compte";
  }
}

interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
}
interface TgUpdate {
  message?: TgMessage;
  edited_message?: TgMessage;
}

const WELCOME = (companyName: string) =>
  `✅ *Connecté à ${companyName} !*\n\n` +
  `Je suis votre copilote AXON-AI. Vous pouvez maintenant piloter vos campagnes ici.\n\n` +
  `🚀 */lancer <objectif>* — lance les agents\n` +
  `📡 */veille* — analyse concurrentielle\n` +
  `🎯 */objectif <texte>* — fixe un objectif\n` +
  `📊 */status* — état du compte\n` +
  `❓ */aide* — toutes les commandes\n\n` +
  `_Vous pouvez aussi écrire un objectif directement._`;

function addChatId(existing: string, chatId: number): string {
  const set = new Set(
    existing.split(",").map((s) => s.trim()).filter(Boolean)
  );
  set.add(String(chatId));
  return Array.from(set).join(",");
}

function chatIsLinked(linked: string | undefined, chatId: number): boolean {
  if (!linked) return false;
  return linked.split(",").map((s) => s.trim()).includes(String(chatId));
}

export async function POST(req: NextRequest) {
  const ok = NextResponse.json({ ok: true }, { status: 200 });

  const token = env.telegramBotToken;
  if (!token) {
    console.warn("[telegram/bot] TELEGRAM_BOT_TOKEN non configuré");
    return ok;
  }

  // Vérification optionnelle du secret
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (secret) {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (incoming !== secret) return ok;
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return ok;
  }

  const message = update.message ?? update.edited_message;
  if (!message || !message.text) return ok;

  const chatId = message.chat.id;
  const text = message.text.trim();

  try {
    // ── 1. Jumelage : /start <CODE> ────────────────────────────────────────────
    const startMatch = text.match(/^\/start\s+([A-Za-z0-9]+)/);
    if (startMatch) {
      const code = startMatch[1].toUpperCase();
      const all = await listByChannel("telegram");
      const target = all.find((c) => (c.config?.pairing_code ?? "").toUpperCase() === code);

      if (!target) {
        await sendMessage(token, chatId, "❌ Code de connexion invalide ou expiré. Récupérez le lien depuis AXON-AI → Telegram.");
        return ok;
      }

      const linked = addChatId(target.config?.linked_chat_ids ?? "", chatId);
      await upsertConnection(
        target.company_id,
        "telegram",
        { linked_chat_ids: linked },
        "connected"
      );
      await sendMessage(token, chatId, WELCOME(await companyName(target.company_id)));
      return ok;
    }

    // ── 2. /start sans code ────────────────────────────────────────────────────
    if (/^\/start\b/.test(text)) {
      await sendMessage(
        token,
        chatId,
        "👋 Bienvenue sur AXON-AI. Pour relier ce chat à votre compte, ouvrez AXON-AI → *Telegram* et cliquez sur le bouton de connexion."
      );
      return ok;
    }

    // ── 3. Message normal : résoudre l'entité via les chats reliés ─────────────
    const all = await listByChannel("telegram");
    const conn = all.find((c) => chatIsLinked(c.config?.linked_chat_ids, chatId));

    if (!conn) {
      await sendMessage(
        token,
        chatId,
        "🔗 Ce chat n'est relié à aucun compte. Ouvrez AXON-AI → *Telegram* et cliquez sur le bouton de connexion pour démarrer."
      );
      return ok;
    }

    const response = await handleCommand({ companyId: conn.company_id, text, chatId });
    await sendMessage(token, chatId, response);
  } catch (err) {
    console.error("[telegram/bot] erreur:", err);
  }

  return ok;
}
