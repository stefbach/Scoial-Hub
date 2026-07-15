// GET /api/me/org-status → statut de validation de l'organisation de
// l'utilisateur courant. Pilote le verrou d'auto-inscription côté client
// (AccountGate) : une org auto-créée reste `pending` tant que l'admin générale
// ne l'a pas validée.
//
// Réponses : { status: "demo" | "unauthenticated" | "none" | "pending"
//                       | "approved" | "suspended" }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getMyOrgStatus } from "@/lib/auth";

export async function GET() {
  const { status } = await getMyOrgStatus();
  return NextResponse.json({ status });
}
