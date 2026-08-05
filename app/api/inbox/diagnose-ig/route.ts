// GET /api/inbox/diagnose-ig?companyId=…
// Diagnostic des messages privés Instagram : dit LAQUELLE des causes possibles
// bloque la messagerie IG, au lieu de laisser une boîte vide sans explication.
// Les tokens ne quittent pas le serveur : seul le verdict est renvoyé.

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { diagnoseIgDm, explain } from "@/lib/inbox/ig-dm-diagnosis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  try {
    const diagnosis = await diagnoseIgDm(companyId);
    return NextResponse.json({ ...diagnosis, explanation: explain(diagnosis) });
  } catch (e) {
    console.error("[GET /api/inbox/diagnose-ig]", e);
    return NextResponse.json({ error: "Diagnostic indisponible." }, { status: 500 });
  }
}
