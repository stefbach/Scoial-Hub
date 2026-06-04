// GET /api/meta/insights?companyId=…
// Données réelles de la Page Facebook + compte Instagram actuellement
// sélectionnés (abonnés, posts, engagement).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getMetaContext, fetchMetaInsights } from "@/lib/connectors/meta-pages";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.pageToken) {
      return NextResponse.json({ connected: false, facebookPosts: [], instagramPosts: [] });
    }

    const insights = await fetchMetaInsights(ctx);
    return NextResponse.json({ connected: true, ...insights });
  } catch (err) {
    console.error("[GET /api/meta/insights]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
