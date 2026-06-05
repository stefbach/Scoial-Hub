import { NextRequest, NextResponse } from "next/server";
import { updateAgent, deleteAgent } from "@/lib/repositories/inbox";
import { requireCompanyAccess } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/inbox/agents/[id]  { companyId, ...patch }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { companyId, ...patch } = body;
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const agent = await updateAgent(params.id, patch);
    return NextResponse.json(agent);
  } catch (e) {
    console.error("[PATCH /api/inbox/agents/:id]", e);
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/inbox/agents/[id]?companyId=...
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
  try {
    await deleteAgent(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/inbox/agents/:id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
