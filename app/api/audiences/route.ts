import { NextRequest, NextResponse } from "next/server";
import { listAudiences, createAudience } from "@/lib/repositories/audiences";
import { requireCompanyAccess } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/audiences?companyId=...
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId query parameter is required" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const audiences = await listAudiences(companyId);
    return NextResponse.json(audiences);
  } catch (err) {
    console.error("[GET /api/audiences]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/audiences
// Body: { companyId, type, name, description?, detail?, reach?, inUse?, config?, metaAudienceId?, createdBy?, lastSyncedAt? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, ...input } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    if (!input.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!input.type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const audience = await createAudience(companyId, {
      type: input.type,
      name: input.name,
      description: input.description ?? "",
      detail: input.detail ?? "",
      reach: input.reach ?? "—",
      inUse: input.inUse ?? 0,
      config: input.config,
      metaAudienceId: input.metaAudienceId,
      createdBy: input.createdBy,
      lastSyncedAt: input.lastSyncedAt,
      usedByAdSetIds: input.usedByAdSetIds ?? [],
    });

    return NextResponse.json(audience, { status: 201 });
  } catch (err) {
    console.error("[POST /api/audiences]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
