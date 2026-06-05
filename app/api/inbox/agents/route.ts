import { NextRequest, NextResponse } from "next/server";
import { listAgents, createAgent } from "@/lib/repositories/inbox";
import { requireCompanyAccess } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/inbox/agents?companyId=...
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
  try {
    return NextResponse.json(await listAgents(companyId));
  } catch (e) {
    console.error("[GET /api/inbox/agents]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/inbox/agents  { companyId, name, scope, channels, ... }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, ...input } = body;
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!input.name) return NextResponse.json({ error: "name requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const agent = await createAgent(companyId, input);
    return NextResponse.json(agent, { status: 201 });
  } catch (e) {
    console.error("[POST /api/inbox/agents]", e);
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
