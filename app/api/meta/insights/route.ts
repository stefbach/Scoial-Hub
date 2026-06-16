// GET /api/meta/insights?companyId=…
// Données réelles de la Page Facebook + compte Instagram actuellement
// sélectionnés (abonnés, posts, engagement).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getMetaContext, fetchMetaInsights } from "@/lib/connectors/meta-pages";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { cached } from "@/lib/cache/ttl-cache";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    // Lecture en cache (TTL 2 min) : les insights Page/IG évoluent lentement →
    // on évite de retaper Graph à chaque visite/onglet (latence + rate-limits).
    const payload = await cached(`meta:insights:${companyId}`, 120_000, async () => {
      const ctx = await getMetaContext(companyId);
      if (!ctx.pageToken) return { connected: false, facebookPosts: [], instagramPosts: [] };
      const insights = await fetchMetaInsights(ctx);
      return { connected: true, ...insights };
    });
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[GET /api/meta/insights]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
