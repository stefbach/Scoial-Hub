import { NextRequest, NextResponse } from "next/server";
import { updateAudience, deleteAudience, getAudienceCompanyId } from "@/lib/repositories/audiences";
import { requireCompanyAccess } from "@/lib/auth/guard";
import type { AccessMode } from "@/lib/rbac/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Garde d'ownership : l'audience doit appartenir à une société accessible. */
async function guardAudience(id: string, mode: AccessMode) {
  const companyId = await getAudienceCompanyId(id);
  if (!companyId) return { ok: false as const, status: 404, error: "Audience not found" };
  return requireCompanyAccess(companyId, { mode });
}

// PATCH /api/audiences/[id]
// Body: partial Audience fields (name, description, detail, reach, inUse, config, …)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await guardAudience(params.id, "edit");
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const body = await req.json();
    const audience = await updateAudience(params.id, body);
    return NextResponse.json(audience);
  } catch (err) {
    console.error("[PATCH /api/audiences/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/audiences/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await guardAudience(params.id, "edit");
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await deleteAudience(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/audiences/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
