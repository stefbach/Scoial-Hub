/**
 * GET  /api/api-keys?companyId=<id>   → liste les clés (sans secret)
 * POST /api/api-keys                  → crée une clé { companyId, name }
 *                                       renvoie le secret en clair UNE seule fois
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  }
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
  const keys = await listApiKeys(await resolveCompanyUuid(companyId));
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string; name?: string };
    if (!body.companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const created = await createApiKey(await resolveCompanyUuid(body.companyId), body.name ?? "Clé MCP");
    if (!created) {
      return NextResponse.json({ error: "Échec de la création" }, { status: 500 });
    }
    // plaintext renvoyé une seule fois — l'app ne le stocke jamais en clair.
    return NextResponse.json(
      { ...created.key, plaintext: created.plaintext },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/api-keys]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
