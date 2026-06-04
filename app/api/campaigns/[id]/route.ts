import { NextRequest, NextResponse } from "next/server";
import { getCampaign, updateCampaign, deleteCampaign } from "@/lib/repositories/campaigns";

// GET /api/campaigns/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    await deleteCampaign(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/campaigns/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
