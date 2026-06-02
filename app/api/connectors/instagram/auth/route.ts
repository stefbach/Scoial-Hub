/**
 * app/api/connectors/instagram/auth/route.ts
 *
 * GET /api/connectors/instagram/auth
 *
 * Redirige l'utilisateur vers la page d'autorisation OAuth de Facebook
 * (Instagram Business utilise le même flow OAuth que Facebook).
 *
 * En mode simulé (META_APP_ID absent), redirige vers /accounts?simulated=true.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import crypto from "crypto";

export async function GET(): Promise<NextResponse> {
  try {
    const state = crypto.randomBytes(16).toString("hex");

    const connector = getConnector("instagram");
    const authUrl = connector.getAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[GET /api/connectors/instagram/auth] Erreur :", err);
    return NextResponse.json(
      { error: "Impossible de construire l'URL d'autorisation Instagram." },
      { status: 500 }
    );
  }
}
