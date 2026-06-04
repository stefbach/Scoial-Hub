// POST /api/memory/synthesize { companyId } → régénère le brief stratégique
// à partir de toute la mémoire (analyse continue par l'IA).

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { synthesizeBrief } from "@/lib/memory";
import { getCompanyName } from "@/lib/connectors/meta-pages";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { companyId } = (await req.json()) as { companyId?: string };
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const name = await getCompanyName(await resolveCompanyUuid(companyId));
    const brief = await synthesizeBrief(companyId, name || "la marque");
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[POST /api/memory/synthesize]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
