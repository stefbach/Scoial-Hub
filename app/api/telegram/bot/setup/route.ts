/**
 * POST /api/telegram/bot/setup
 * Enregistre le webhook du bot central AXON-AI auprès de Telegram.
 * À lancer UNE fois après avoir configuré TELEGRAM_BOT_TOKEN dans Vercel.
 * Le username n'est PAS requis (déduit du token via getMe). Renvoie les infos
 * du bot + l'état du webhook, pour diagnostic direct dans le navigateur.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { setWebhook, getMe } from "@/lib/telegram/client";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const token = env.telegramBotToken;
  // Seul le TOKEN est requis (le username est déduit du token, cf. getMe).
  if (!token) {
    return NextResponse.json(
      {
        error:
          "TELEGRAM_BOT_TOKEN manquant. Créez un bot via @BotFather (/newbot), ajoutez le token dans Vercel → Settings → Environment Variables, puis redéployez.",
      },
      { status: 400 }
    );
  }

  // Vérifie d'abord que le token correspond à un vrai bot.
  const me = await getMe(token);
  if (!me.ok) {
    return NextResponse.json(
      { error: `Token invalide : Telegram a refusé getMe (${me.error ?? "erreur inconnue"}). Vérifiez TELEGRAM_BOT_TOKEN.` },
      { status: 400 }
    );
  }

  const webhookUrl = `${req.nextUrl.origin}/api/telegram/bot`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

  const set = await setWebhook(token, webhookUrl, secret);
  if (!set.ok) {
    return NextResponse.json({ error: set.error ?? "setWebhook a échoué" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    webhookUrl,
    bot: me.data,
    message: `Webhook enregistré. Le bot @${me.data?.username ?? "?"} est prêt : ouvrez-le sur Telegram et pressez « Démarrer ».`,
  });
}

export async function GET(req: NextRequest) {
  // Permet de vérifier l'état rapidement (et de lancer le setup via navigateur).
  return POST(req);
}
