// GET  /api/media?companyId=…            → bibliothèque média (assets + brand kit)
// POST /api/media { companyId, url, type, format?, source?, prompt? } → enregistre
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { listMediaAssets, saveMediaAsset } from "@/lib/repositories/media";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const limitParam = Number(req.nextUrl.searchParams.get("limit"));
    const assets = await listMediaAssets(companyId, Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined);
    return NextResponse.json({ assets });
  } catch (e) {
    console.error("[GET /api/media]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string; url?: string; type?: "image" | "video"; format?: string; source?: string; prompt?: string };
    if (!body.companyId || !body.url) return NextResponse.json({ error: "companyId et url requis" }, { status: 400 });
    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    await saveMediaAsset(body.companyId, { url: body.url, type: body.type, format: body.format, source: body.source, prompt: body.prompt });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/media]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
