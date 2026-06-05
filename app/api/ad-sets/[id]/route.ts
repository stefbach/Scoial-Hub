import { NextRequest, NextResponse } from "next/server";
import { updateAdSet, deleteAdSet } from "@/lib/repositories/ad-sets";
import { requireUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/ad-sets/[id]
// Body: partial AdSet fields (enabled, status, name, dailyBudget, …)
// Persiste dans sh_ad_sets. No-op (persisted:false) si l'id n'est pas un UUID.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const body = await req.json();
    const persisted = await updateAdSet(params.id, body);
    return NextResponse.json({ ok: true, persisted });
  } catch (err) {
    console.error("[PATCH /api/ad-sets/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/ad-sets/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await deleteAdSet(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/ad-sets/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
