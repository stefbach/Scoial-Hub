// POST /api/meta/analyze { companyId }
// Analyse IA de la Page connectée (FB + IG) → recommandations d'optimisation.

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getMetaContext, fetchMetaInsights } from "@/lib/connectors/meta-pages";
import { analyzeMetaContent } from "@/lib/connectors/meta-analyze";
import { getCompanyName } from "@/lib/connectors/meta-pages";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { companyId } = await req.json();
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.pageToken) {
      return NextResponse.json({ error: "Aucune Page connectée" }, { status: 409 });
    }

    const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
    const name = await getCompanyName(await resolveCompanyUuid(companyId));
    const insights = await fetchMetaInsights(ctx);
    const analysis = await analyzeMetaContent(insights, name || "la marque");

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[POST /api/meta/analyze]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
