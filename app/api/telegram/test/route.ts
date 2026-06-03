/**
 * POST /api/telegram/test   { companyId, chatId }
 *
 * Envoie un message de test au chatId indiqué pour vérifier que le bot
 * est correctement configuré et opérationnel.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/repositories/channel-connections";
import { sendMessage } from "@/lib/telegram/client";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      chatId?: string | number;
    };

    const { companyId, chatId } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }
    if (!chatId) {
      return NextResponse.json({ error: "chatId requis" }, { status: 400 });
    }

    const conn = await getConnection(companyId, "telegram");
    const config = conn?.config as Record<string, string> | undefined;
    const botToken = config?.bot_token ?? "";

    if (!botToken) {
      return NextResponse.json(
        { error: "Aucun token bot configuré pour ce compte." },
        { status: 400 }
      );
    }

    if (conn?.status !== "connected") {
      return NextResponse.json(
        { error: "Le bot n'est pas activé. Activez le webhook d'abord." },
        { status: 400 }
      );
    }

    const testMessage =
      `✅ *AXON-AI connecté*\n\n` +
      `Le bot Telegram est opérationnel pour ce compte.\n\n` +
      `Tapez */aide* pour voir les commandes disponibles.`;

    const result = await sendMessage(botToken, chatId, testMessage);

    if (!result.ok) {
      return NextResponse.json(
        { error: `Impossible d'envoyer le message : ${result.error}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, messageId: result.data?.message_id });
  } catch (err) {
    console.error("[POST /api/telegram/test]", err);
    return NextResponse.json({ error: "Erreur interne lors du test" }, { status: 500 });
  }
}
