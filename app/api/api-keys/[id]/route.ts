/**
 * DELETE /api/api-keys/<id>   → révoque une clé { companyId }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api-keys";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => ({}))) as { companyId?: string };
    if (!body.companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }
    const ok = await revokeApiKey(await resolveCompanyUuid(body.companyId), params.id);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error("[DELETE /api/api-keys/:id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
