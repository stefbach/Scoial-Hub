import { NextRequest, NextResponse } from "next/server";
import { createAdSet } from "@/lib/repositories/ad-sets";
import { requireUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/ad-sets
// Body: { campaignId, name, placement?, targeting?, audienceId?, dailyBudget?, … }
// Persiste dans sh_ad_sets quand campaignId est un UUID (campagne réelle).
// Retourne { ok, persisted, adSet } — persisted:false si non persistable (mock).
export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const body = await req.json();
    const { campaignId, ...input } = body;

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
    }
    if (!input.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const adSet = await createAdSet(campaignId, {
      name: input.name,
      placement: input.placement ?? "",
      targeting: input.targeting ?? "",
      audienceId: input.audienceId,
      dailyBudget: input.dailyBudget ?? 0,
      lifetimeBudget: input.lifetimeBudget,
      budgetType: input.budgetType,
      optimizationGoal: input.optimizationGoal,
      status: input.status,
      enabled: input.enabled,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    return NextResponse.json({ ok: true, persisted: !!adSet, adSet }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ad-sets]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
