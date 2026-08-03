/**
 * POST /api/reputation/scan   { companyId, force? }
 *
 * Lance une veille de réputation : mentions publiques de la marque sur le web
 * et la presse, classées par sentiment et déposées dans la Messagerie.
 *
 * Reste sans effet tant qu'aucune clé de recherche n'est configurée
 * (BRAVE_SEARCH_API_KEY ou SERPAPI_KEY) — la réponse le dit explicitement
 * plutôt que d'échouer en silence.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getCompanyName } from "@/lib/connectors/meta-pages";
import { scanReputation } from "@/lib/reputation/scan";
import { isSearchConfigured } from "@/lib/reputation/search";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { companyId?: string; force?: boolean };
  const companyId = (body.companyId ?? "").trim();
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const guard = await requireCompanyAccess(companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  if (!isSearchConfigured()) {
    return NextResponse.json({
      configured: false,
      error:
        "La veille de réputation nécessite une clé de recherche (BRAVE_SEARCH_API_KEY ou SERPAPI_KEY). " +
        "Une fois la clé ajoutée, la veille démarre sans redéploiement.",
    });
  }

  try {
    const uuid = await resolveCompanyUuid(companyId);
    const brand = await getCompanyName(uuid);
    const result = await scanReputation(uuid, brand, { force: Boolean(body.force) });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/reputation/scan]", e);
    return NextResponse.json({ error: "Veille indisponible." }, { status: 500 });
  }
}
