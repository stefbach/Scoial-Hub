/**
 * GET /api/telegram/pairing?companyId=<id>
 * Renvoie le code de jumelage du compte (en génère un si absent) et le lien
 * profond vers le bot central AXON-AI. Connexion « quasi automatique » :
 * le client clique le lien, presse Start, le compte est relié — aucun bot à créer.
 *
 * Réponse : { botUsername, code, deepLink, linked, status, isBotConfigured }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnection, upsertConnection } from "@/lib/repositories/channel-connections";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { env, isTelegramBotConfigured } from "@/lib/env";

function genCode(): string {
  // 8 caractères lisibles (sans 0/O/1/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  }
  const cid = await resolveCompanyUuid(companyId);

  const conn = await getConnection(cid, "telegram");
  let code = conn?.config?.pairing_code ?? "";
  const linkedRaw = conn?.config?.linked_chat_ids ?? "";
  const linked = linkedRaw.trim().length > 0;

  // Génère un code si absent (statut "pending" tant que non relié)
  if (!code) {
    code = genCode();
    await upsertConnection(
      cid,
      "telegram",
      { pairing_code: code },
      conn?.status === "connected" ? "connected" : "pending"
    );
  }

  const botUsername = env.telegramBotUsername;
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : "";

  return NextResponse.json({
    botUsername,
    code,
    deepLink,
    linked,
    status: linked ? "connected" : "pending",
    isBotConfigured: isTelegramBotConfigured,
  });
}
