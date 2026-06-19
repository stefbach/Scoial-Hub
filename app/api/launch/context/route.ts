// GET /api/launch/context?companyId=… → statut des données récupérées (RAG)
// pour le Copilote de lancement (identité de marque, veille, pubs, campagnes).

export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { buildLaunchContext, launchContextStatus } from "@/lib/launch/context";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
  const companyName = req.nextUrl.searchParams.get("companyName") ?? "la marque";
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  try {
    const ctx = await buildLaunchContext(companyId, companyName);
    return NextResponse.json({ status: launchContextStatus(ctx) });
  } catch (e) {
    console.error("[GET /api/launch/context]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
