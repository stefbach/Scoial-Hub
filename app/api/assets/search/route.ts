// POST /api/assets/search { companyId, query, kinds, page? }
//
// Point d'entrée UNIQUE de la bibliothèque d'assets (mission bibliothèque,
// chapitre 6). Aucune clé de fournisseur n'apparaît jamais dans la réponse —
// l'objet AssetResult ne porte que le NOM du fournisseur, jamais sa clé.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { searchAssets } from "@/lib/assets/gateway";
import type { AssetKind } from "@/lib/assets/types";

const VALID_KINDS: AssetKind[] = ["image", "video", "audio"];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      query?: string;
      kinds?: string[];
      page?: number;
    };
    if (!body.companyId || !body.query) {
      return NextResponse.json({ error: "companyId et query requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(body.companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const kinds = (body.kinds ?? ["image", "video"]).filter((k): k is AssetKind =>
      VALID_KINDS.includes(k as AssetKind)
    );
    if (kinds.length === 0) return NextResponse.json({ error: "kinds invalide" }, { status: 400 });

    const results = await searchAssets({ query: body.query, kinds, page: body.page });
    return NextResponse.json({ results });
  } catch (e) {
    console.error("[POST /api/assets/search]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
