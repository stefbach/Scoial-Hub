/**
 * app/api/connectors/linkedin/auth/route.ts
 *
 * GET /api/connectors/linkedin/auth
 *
 * Redirige l'utilisateur vers la page d'autorisation OAuth de LinkedIn.
 * Un paramètre `state` aléatoire (CSRF) est généré côté serveur.
 *
 * En mode simulé (LINKEDIN_CLIENT_ID absent), redirige vers /accounts?simulated=true.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import crypto from "crypto";

export async function GET(): Promise<NextResponse> {
  try {
    const state = crypto.randomBytes(16).toString("hex");

    const connector = getConnector("linkedin");
    const authUrl = connector.getAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[GET /api/connectors/linkedin/auth] Erreur :", err);
    return NextResponse.json(
      { error: "Impossible de construire l'URL d'autorisation LinkedIn." },
      { status: 500 }
    );
  }
}
