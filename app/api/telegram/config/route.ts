/**
 * GET  /api/telegram/config?companyId=<id>
 *   → renvoie la config Telegram de l'entité (bot_token masqué en "__secret__")
 *
 * POST /api/telegram/config
 *   Body : { companyId, bot_token?, allowed_chat_ids? }
 *   → upsert dans sh_channel_connections (ne remplace pas le token si vide)
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnection, upsertConnection } from "@/lib/repositories/channel-connections";
import type { ConnectionStatus } from "@/lib/repositories/channel-connections";

// ── Masquage des secrets ──────────────────────────────────────────────────────

function sanitize(config: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (k === "bot_token" || k === "webhook_secret") {
      if (v) result[k] = "__secret__";
      // absent = clé non renseignée → on omet
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    const conn = await getConnection(companyId, "telegram");

    if (!conn) {
      return NextResponse.json({
        companyId,
        channel: "telegram",
        status: "disconnected",
        config: {},
        connected_at: null,
      });
    }

    return NextResponse.json({
      companyId,
      channel: "telegram",
      status: conn.status,
      config: sanitize(conn.config),
      connected_at: conn.connected_at,
    });
  } catch (err) {
    console.error("[GET /api/telegram/config]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      bot_token?: string;
      allowed_chat_ids?: string;
    };

    const { companyId, bot_token, allowed_chat_ids } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    // Construire le patch de config (ne pas écraser le token si vide)
    const patch: Record<string, string> = {};
    if (bot_token && bot_token !== "__secret__") patch.bot_token = bot_token;
    if (typeof allowed_chat_ids === "string") patch.allowed_chat_ids = allowed_chat_ids;

    // Statut : reste "connected" si déjà connecté, sinon "pending"
    const existing = await getConnection(companyId, "telegram");
    const status: ConnectionStatus =
      existing?.status === "connected" ? "connected" : "pending";

    const result = await upsertConnection(companyId, "telegram", patch, status);

    if (!result) {
      return NextResponse.json({ error: "Échec de l'enregistrement" }, { status: 500 });
    }

    return NextResponse.json({
      companyId,
      channel: "telegram",
      status: result.status,
      config: sanitize(result.config),
      connected_at: result.connected_at,
    });
  } catch (err) {
    console.error("[POST /api/telegram/config]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
