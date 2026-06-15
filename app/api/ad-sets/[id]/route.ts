import { NextRequest, NextResponse } from "next/server";
import { updateAdSet, deleteAdSet, getAdSetCompanyId } from "@/lib/repositories/ad-sets";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { isSupabaseConfigured } from "@/lib/env";
import type { AccessMode } from "@/lib/rbac/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Garde d'ownership : l'ad set doit appartenir à une société accessible.
 *  En mode démo (Supabase absent) on laisse passer (updateAdSet est no-op). */
async function guardAdSet(id: string, mode: AccessMode) {
  if (!isSupabaseConfigured) return { ok: true as const };
  const companyId = await getAdSetCompanyId(id);
  if (!companyId) return { ok: false as const, status: 404, error: "Ad set not found" };
  return requireCompanyAccess(companyId, { mode });
}

// PATCH /api/ad-sets/[id]
// Body: partial AdSet fields (enabled, status, name, dailyBudget, …)
// Persiste dans sh_ad_sets. No-op (persisted:false) si l'id n'est pas un UUID.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await guardAdSet(params.id, "edit");
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
    const guard = await guardAdSet(params.id, "edit");
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await deleteAdSet(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/ad-sets/[id]]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
