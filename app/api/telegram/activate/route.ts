/**
 * POST /api/telegram/activate   { companyId }
 *   → lit le bot_token, enregistre le webhook, passe status "connected"
 *   → retourne { username, webhookUrl }
 *
 * DELETE /api/telegram/activate   { companyId }
 *   → supprime le webhook, passe status "disconnected"
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnection, upsertConnection } from "@/lib/repositories/channel-connections";
import { setWebhook, deleteWebhook, getMe } from "@/lib/telegram/client";
import { env } from "@/lib/env";
import crypto from "crypto";

// ── POST — activer ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string };
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    const conn = await getConnection(companyId, "telegram");
    const config = conn?.config as Record<string, string> | undefined;
    const botToken = config?.bot_token ?? "";

    if (!botToken) {
      return NextResponse.json(
        { error: "Aucun token bot configuré pour ce compte. Enregistrez d'abord un token." },
        { status: 400 }
      );
    }

    // Générer (ou réutiliser) un secret token pour sécuriser le webhook
    const existingSecret = config?.webhook_secret ?? "";
    const webhookSecret =
      existingSecret || crypto.randomBytes(24).toString("hex");

    // URL du webhook pour ce compte
    const webhookUrl = `${env.appUrl}/api/telegram/webhook?company=${encodeURIComponent(companyId)}`;

    // Vérification du bot avant d'enregistrer
    const meResult = await getMe(botToken);
    if (!meResult.ok) {
      return NextResponse.json(
        { error: `Token invalide ou bot inaccessible : ${meResult.error}` },
        { status: 400 }
      );
    }

    // Enregistrement du webhook
    const webhookResult = await setWebhook(botToken, webhookUrl, webhookSecret);
    if (!webhookResult.ok) {
      return NextResponse.json(
        { error: `Impossible d'enregistrer le webhook : ${webhookResult.error}` },
        { status: 502 }
      );
    }

    // Mise à jour du statut et sauvegarde du secret
    const updatedConfig: Record<string, string> = {
      ...config,
      webhook_secret: webhookSecret,
      webhook_url: webhookUrl,
    };

    await upsertConnection(companyId, "telegram", updatedConfig, "connected");

    const botInfo = meResult.data!;

    return NextResponse.json({
      ok: true,
      username: botInfo.username,
      firstName: botInfo.first_name,
      botId: botInfo.id,
      webhookUrl,
    });
  } catch (err) {
    console.error("[POST /api/telegram/activate]", err);
    return NextResponse.json({ error: "Erreur interne lors de l'activation" }, { status: 500 });
  }
}

// ── DELETE — désactiver ───────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string };
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    const conn = await getConnection(companyId, "telegram");
    const config = conn?.config as Record<string, string> | undefined;
    const botToken = config?.bot_token ?? "";

    if (botToken) {
      // Best-effort — on ne bloque pas si ça échoue
      const result = await deleteWebhook(botToken);
      if (!result.ok) {
        console.warn(`[telegram/deactivate] deleteWebhook failed: ${result.error}`);
      }
    }

    // Nettoyage du secret + mise à jour du statut
    const updatedConfig: Record<string, string> = { ...(config ?? {}) };
    delete updatedConfig.webhook_secret;
    delete updatedConfig.webhook_url;

    await upsertConnection(companyId, "telegram", updatedConfig, "disconnected");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/telegram/activate]", err);
    return NextResponse.json({ error: "Erreur interne lors de la désactivation" }, { status: 500 });
  }
}
