/**
 * app/api/connectors/route.ts
 *
 * GET /api/connectors
 *
 * Retourne le statut de configuration et de connexion pour chaque plateforme
 * sociale (Facebook, Instagram, LinkedIn).
 *
 * Réponse JSON : ConnectorStatus[]
 * {
 *   platform: "facebook" | "instagram" | "linkedin",
 *   configured: boolean,       // variables d'env présentes ?
 *   connectedAccounts: number, // comptes actifs dans social_accounts
 *   accounts: [{ id, accountName, externalId?, status }]
 * }
 *
 * Fonctionne sans aucune clé (retourne configured: false pour chaque plateforme).
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { listConnectorStatus } from "@/lib/connectors/index";

export async function GET(): Promise<NextResponse> {
  try {
    const statuses = await listConnectorStatus();
    return NextResponse.json(statuses);
  } catch (err) {
    console.error("[GET /api/connectors] Erreur :", err);
    return NextResponse.json(
      { error: "Impossible de récupérer le statut des connecteurs." },
      { status: 500 }
    );
  }
}
