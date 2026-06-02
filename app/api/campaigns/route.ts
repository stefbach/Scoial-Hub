import { NextRequest, NextResponse } from "next/server";
import { listCampaigns, createCampaign } from "@/lib/repositories/campaigns";

// GET /api/campaigns?companyId=...
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId query parameter is required" },
        { status: 400 }
      );
    }

    const campaigns = await listCampaigns(companyId);
    return NextResponse.json(campaigns);
  } catch (err) {
    console.error("[GET /api/campaigns]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/campaigns
// Body: { companyId, name, objective?, platforms?, status?, enabled?, budget?, dailyBudget?, startDate?, endDate? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, ...input } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    if (!input.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const campaign = await createCampaign(companyId, {
      name: input.name,
      objective: input.objective ?? "",
      platforms: input.platforms ?? [],
      status: input.status ?? "paused",
      enabled: input.enabled ?? false,
      spend: input.spend ?? 0,
      budget: input.budget ?? 0,
      dailyBudget: input.dailyBudget,
      lifetimeBudget: input.lifetimeBudget,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("[POST /api/campaigns]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
