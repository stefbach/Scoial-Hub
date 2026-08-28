/**
 * GET /api/pilotage?companyId=…
 *
 * Indicateurs de pilotage calculés sur les VRAIES données des réseaux connectés,
 * et alertes qui en découlent. Les tokens de Page ne quittent jamais le serveur :
 * l'écran Pilotage appelle cette route au lieu de calculer localement.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { fetchLiveKpis, alertsFromLiveKpis } from "@/lib/pilotage-live";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const guard = await requireCompanyAccess(companyId, { mode: "view" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  try {
    const uuid = await resolveCompanyUuid(companyId);
    const kpis = await fetchLiveKpis(uuid);
    return NextResponse.json({
      kpis,
      alerts: alertsFromLiveKpis(kpis),
      measuredAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[GET /api/pilotage]", e);
    // Jamais fatal : l'écran doit s'afficher même si un réseau est injoignable.
    return NextResponse.json({ kpis: [], alerts: [], error: "Indicateurs indisponibles." });
  }
}
