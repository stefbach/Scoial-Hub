import { NextRequest, NextResponse } from "next/server";
import { setMessageStatus } from "@/lib/repositories/inbox";
import { requireCompanyAccess } from "@/lib/auth/guard";
import type { InboxMessageStatus } from "@/lib/inbox/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/inbox/messages/[id]  { companyId, status }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { companyId, status } = body as { companyId?: string; status?: InboxMessageStatus };
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    if (!status) return NextResponse.json({ error: "status requis" }, { status: 400 });
    await setMessageStatus(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/inbox/messages/:id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
