/**
 * POST /api/telegram/bot/setup
 * Enregistre le webhook du bot central AXON-AI auprès de Telegram.
 * À lancer une seule fois après avoir configuré TELEGRAM_BOT_TOKEN +
 * TELEGRAM_BOT_USERNAME dans Vercel. Renvoie les infos du bot (getMe).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { setWebhook, getMe } from "@/lib/telegram/client";
import { env, isTelegramBotConfigured } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!isTelegramBotConfigured) {
    return NextResponse.json(
      {
        error:
          "Bot central non configuré. Ajoutez TELEGRAM_BOT_TOKEN et TELEGRAM_BOT_USERNAME dans Vercel → Settings → Environment Variables, puis redéployez.",
      },
      { status: 400 }
    );
  }

  const token = env.telegramBotToken;
  const webhookUrl = `${req.nextUrl.origin}/api/telegram/bot`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

  const set = await setWebhook(token, webhookUrl, secret);
  if (!set.ok) {
    return NextResponse.json({ error: set.error ?? "setWebhook a échoué" }, { status: 502 });
  }

  const me = await getMe(token);
  return NextResponse.json({
    ok: true,
    webhookUrl,
    bot: me.ok ? me.data : null,
  });
}

export async function GET(req: NextRequest) {
  // Permet de vérifier l'état rapidement (et de lancer le setup via navigateur).
  return POST(req);
}
