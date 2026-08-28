// POST /api/assets/acquire { companyId, asset: AssetResult }
//
// Appelé au premier EXPORT du montage, jamais à l'insertion (copie différée,
// §6.4). Applique la politique du fournisseur (règle 3) et renvoie la
// provenance à écrire dans le document de projet immédiatement (règle 4).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { acquireAsset } from "@/lib/assets/gateway";
import type { AssetResult } from "@/lib/assets/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string; asset?: AssetResult };
    if (!body.companyId || !body.asset?.provider || !body.asset?.providerId || !body.asset?.sourceUrl) {
      return NextResponse.json({ error: "companyId et asset requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const outcome = await acquireAsset(body.companyId, body.asset);
    if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: 502 });
    return NextResponse.json(outcome);
  } catch (e) {
    console.error("[POST /api/assets/acquire]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
