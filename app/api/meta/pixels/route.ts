// GET /api/meta/pixels?companyId=…  → pixels du compte (pour les conversions).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken || !ctx.adAccountId) return NextResponse.json({ pixels: [] });

    const act = `act_${String(ctx.adAccountId).replace(/^act_/, "")}`;
    const url = `https://graph.facebook.com/${V}/${act}/adspixels?fields=id,name,last_fired_time&access_token=${encodeURIComponent(ctx.userToken)}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>>; error?: { message?: string } };
    if (json.error) return NextResponse.json({ pixels: [], error: json.error.message });
    const pixels = (json.data ?? []).map((p) => ({ id: String(p.id ?? ""), name: String(p.name ?? "Pixel") })).filter((p) => p.id);
    return NextResponse.json({ pixels });
  } catch (e) {
    console.error("[GET /api/meta/pixels]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
