// POST /api/meta/analyze { companyId }
// Analyse IA de la Page connectée (FB + IG) → recommandations d'optimisation.

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getMetaContext, fetchMetaInsights } from "@/lib/connectors/meta-pages";
import { analyzeMetaContent } from "@/lib/connectors/meta-analyze";
import { getCompanyName } from "@/lib/connectors/meta-pages";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { companyId } = await req.json();
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.pageToken) {
      return NextResponse.json({ error: "Aucune Page connectée" }, { status: 409 });
    }

    const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
    const name = await getCompanyName(await resolveCompanyUuid(companyId));
    const insights = await fetchMetaInsights(ctx);
    const analysis = await analyzeMetaContent(insights, name || "la marque");

    // Mémoire stratégique : conclusions de l'analyse de Page.
    try {
      const { appendMemory } = await import("@/lib/memory");
      const e: import("@/lib/memory").MemoryEntry[] = [];
      if (analysis.synthese) e.push({ source: "page", kind: "insight", title: "Analyse de ma Page", content: analysis.synthese, score: 3 });
      for (const f of analysis.formatsGagnants ?? []) e.push({ source: "page", kind: "format", title: `Format gagnant: ${f}`, content: f, score: 3 });
      for (const a of analysis.actions ?? []) e.push({ source: "page", kind: "recommendation", title: a.action.slice(0, 60), content: a.action, score: a.priorite === "haute" ? 4 : 2 });
      await appendMemory(companyId, e);
    } catch (memErr) {
      console.warn("[meta/analyze] memory:", memErr);
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[POST /api/meta/analyze]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
