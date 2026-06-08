// POST /api/meta/ads/apply { companyId, action }
// Applique UNE action du Pilote Pub. Pause/baisse de budget = sûr. Activation /
// hausse de budget = dépense réelle (re-vérification d'appartenance côté connecteur).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { setCampaignStatus, scaleCampaignBudget } from "@/lib/connectors/meta-ads";

interface Action { type: "pause" | "activate" | "budget"; campaignId: string; factor?: number }

export async function POST(req: NextRequest) {
  try {
    const { companyId, action } = (await req.json()) as { companyId?: string; action?: Action };
    if (!companyId || !action?.type || !action.campaignId) {
      return NextResponse.json({ error: "companyId et action (type, campaignId) requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    if (action.type === "pause") {
      await setCampaignStatus(companyId, action.campaignId, "PAUSED");
      return NextResponse.json({ ok: true, applied: "pause" });
    }
    if (action.type === "activate") {
      await setCampaignStatus(companyId, action.campaignId, "ACTIVE");
      return NextResponse.json({ ok: true, applied: "activate" });
    }
    if (action.type === "budget") {
      const changes = await scaleCampaignBudget(companyId, action.campaignId, Number(action.factor ?? 1));
      return NextResponse.json({ ok: true, applied: "budget", changes });
    }
    return NextResponse.json({ error: "Type d'action inconnu" }, { status: 400 });
  } catch (e) {
    console.error("[POST /api/meta/ads/apply]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur serveur" }, { status: 500 });
  }
}
