/**
 * app/api/connectors/facebook/auth/route.ts
 *
 * GET /api/connectors/facebook/auth
 *
 * Redirige l'utilisateur vers la page d'autorisation OAuth de Facebook.
 * Un paramètre `state` aléatoire (CSRF) est généré côté serveur.
 *
 * En mode simulé (META_APP_ID absent), redirige vers /accounts?simulated=true.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import crypto from "crypto";

export async function GET(): Promise<NextResponse> {
  try {
    // Génère un state CSRF aléatoire (hex 16 octets).
    const state = crypto.randomBytes(16).toString("hex");

    const connector = getConnector("facebook");
    const authUrl = connector.getAuthUrl(state);

    // Redirection 302 vers Facebook OAuth (ou vers /accounts en mode simulé).
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[GET /api/connectors/facebook/auth] Erreur :", err);
    return NextResponse.json(
      { error: "Impossible de construire l'URL d'autorisation Facebook." },
      { status: 500 }
    );
  }
}
