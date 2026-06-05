// POST /api/meta/ads/activate { companyId, campaignId, adSetId, adId, live }
// Diffuse (live:true) ou met en pause (live:false) une publicité créée.
// ⚠️ Activer = dépense réelle. Action explicite uniquement.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { setAdLive } from "@/lib/connectors/meta-ads";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { companyId, campaignId, adSetId, adId, live } = (await req.json()) as {
      companyId?: string;
      campaignId?: string;
      adSetId?: string;
      adId?: string;
      live?: boolean;
    };
    if (!companyId || !campaignId || !adSetId || !adId) {
      return NextResponse.json({ error: "companyId, campaignId, adSetId, adId requis" }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await setAdLive(companyId, { campaignId, adSetId, adId }, Boolean(live));
    return NextResponse.json({ ok: true, live: Boolean(live) });
  } catch (err) {
    console.error("[POST /api/meta/ads/activate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors de l'activation." },
      { status: 500 }
    );
  }
}
