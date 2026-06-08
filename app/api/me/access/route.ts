// GET /api/me/access?companyId=… → droits effectifs de l'utilisateur courant sur
// la société active (pour piloter l'UI : édition vs lecture, admin de compte).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { isAccountAdmin } from "@/lib/rbac/types";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const g = await requireCompanyAccess(companyId);
  if (g.status === 401) return NextResponse.json({ error: g.error }, { status: 401 });

  const role = g.role ?? null;
  const mode = g.ok ? g.mode ?? null : null;
  const admin = isAccountAdmin(role);
  return NextResponse.json({
    role,
    mode,
    isAccountAdmin: admin,
    canEdit: admin || mode === "edit",
  });
}
