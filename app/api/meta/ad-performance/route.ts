// Performance réelle pour la page Performance Ads : séries quotidiennes (graphe),
// totaux (KPI) et lignes par publicité (tableau), via Marketing API. Lecture seule.
// Période : ?datePreset=  OU  ?since=YYYY-MM-DD&until=YYYY-MM-DD.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext, fetchAdPerformance } from "@/lib/connectors/meta-pages";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const companyId = sp.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken || !ctx.adAccountId) {
      return NextResponse.json({ connected: false, account: null, totals: null, series: null, ads: [] });
    }

    const data = await fetchAdPerformance(ctx.userToken, ctx.adAccountId, {
      datePreset: sp.get("datePreset") ?? undefined,
      since: sp.get("since") ?? undefined,
      until: sp.get("until") ?? undefined,
    });
    return NextResponse.json({ connected: true, ...data });
  } catch (e) {
    console.error("[GET /api/meta/ad-performance]", e);
    return NextResponse.json({ error: "Erreur serveur lors de la lecture Meta." }, { status: 500 });
  }
}
