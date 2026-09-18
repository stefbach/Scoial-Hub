/**
 * lib/telegram/notify.ts
 *
 * Notifications Telegram PROACTIVES (déclenchées par l'app, pas en réponse à
 * une commande — cf. dispatch.ts pour ça). Best-effort : ne throw jamais,
 * une alerte manquée ne doit jamais faire échouer l'appelant (le cron de
 * publication, notamment).
 *
 * Réutilise le même couplage société ↔ chat que le bot (channel "telegram"
 * dans sh_channel_connections, config.linked_chat_ids — cf.
 * app/api/telegram/bot/route.ts).
 */

import { env } from "@/lib/env";
import { sendMessage } from "@/lib/telegram/client";
import { getConnectionAdmin } from "@/lib/repositories/channel-connections";

function parseChatIds(linked: string | undefined): string[] {
  if (!linked) return [];
  return linked.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Envoie un message à tous les chats Telegram liés à une société. Sans bot
 * configuré, sans société liée, ou en cas d'erreur réseau : ne fait rien
 * silencieusement (dégradation gracieuse, comme le reste de l'intégration
 * Telegram).
 */
export async function notifyCompanyTelegram(companyId: string, text: string): Promise<void> {
  const token = env.telegramBotToken;
  if (!token || !companyId) return;
  try {
    const conn = await getConnectionAdmin(companyId, "telegram");
    const chatIds = parseChatIds(conn?.config?.linked_chat_ids);
    if (chatIds.length === 0) return;
    await Promise.all(chatIds.map((chatId) => sendMessage(token, chatId, text)));
  } catch (err) {
    console.warn("[telegram/notify] notifyCompanyTelegram échoué (non bloquant) :", (err as Error).message);
  }
}
