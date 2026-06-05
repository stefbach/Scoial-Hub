import { NextRequest, NextResponse } from "next/server";
import { syncMetaComments } from "@/lib/inbox/meta-sync";
import { requireCompanyAccess } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/inbox/sync  { companyId }
// Importe les commentaires récents (Facebook + Instagram) de la Page connectée.
export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json();
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const result = await syncMetaComments(companyId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/inbox/sync]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
