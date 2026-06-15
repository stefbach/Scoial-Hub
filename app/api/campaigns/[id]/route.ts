import { NextRequest, NextResponse } from "next/server";
import { getCampaign, getCampaignCompanyId, updateCampaign, deleteCampaign } from "@/lib/repositories/campaigns";
import { requireCompanyAccess } from "@/lib/auth/guard";
import type { AccessMode } from "@/lib/rbac/types";

/** Garde d'ownership : la campagne doit appartenir à une société accessible. */
async function guardCampaign(id: string, mode: AccessMode) {
  const companyId = await getCampaignCompanyId(id);
  if (!companyId) return { ok: false as const, status: 404, error: "Campaign not found" };
  return requireCompanyAccess(companyId, { mode });
}

// GET /api/campaigns/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await guardCampaign(params.id, "view");
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const campaign = await getCampaign(params.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch (err) {
    console.error("[GET /api/campaigns/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/campaigns/[id]
// Body: partial Campaign fields (name, objective, platforms, status, enabled, budget, dailyBudget, lifetimeBudget, startDate, endDate)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await guardCampaign(params.id, "edit");
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const body = await req.json();
    const campaign = await updateCampaign(params.id, body);
    return NextResponse.json(campaign);
  } catch (err) {
    console.error("[PATCH /api/campaigns/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/campaigns/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await guardCampaign(params.id, "edit");
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await deleteCampaign(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/campaigns/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
