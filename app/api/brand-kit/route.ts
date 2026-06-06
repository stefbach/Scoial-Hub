// Route /api/brand-kit — lecture (GET) et enregistrement (PUT) du brand kit
// persistant d'une société. Autorisation via requireCompanyAccess (anti-IDOR).

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getBrandKit, saveBrandKit } from "@/lib/repositories/brand-kit";
import type { BrandKit } from "@/lib/brand-kit/types";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  const kit = await getBrandKit(companyId);
  return NextResponse.json({ kit });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string; kit?: Partial<BrandKit> };
    const companyId = body.companyId ?? "";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    // On ne persiste que les champs connus (évite l'injection de colonnes).
    const p = body.kit ?? {};
    const patch: Partial<BrandKit> = {};
    if (typeof p.logoUrl === "string") patch.logoUrl = p.logoUrl;
    if (typeof p.charteUrl === "string") patch.charteUrl = p.charteUrl;
    if (Array.isArray(p.palette)) patch.palette = p.palette.filter((c) => typeof c === "string").slice(0, 8);
    if (typeof p.recommendedTextColor === "string") patch.recommendedTextColor = p.recommendedTextColor;
    if (typeof p.style === "string") patch.style = p.style;
    if (typeof p.tone === "string") patch.tone = p.tone;
    if (typeof p.promptHints === "string") patch.promptHints = p.promptHints;
    if (typeof p.summary === "string") patch.summary = p.summary;
    if (p.chart && typeof p.chart === "object") patch.chart = p.chart;
    if (typeof p.aiGenerated === "boolean") patch.aiGenerated = p.aiGenerated;

    const kit = await saveBrandKit(companyId, patch);
    return NextResponse.json({ kit });
  } catch (e) {
    console.error("[PUT /api/brand-kit]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
