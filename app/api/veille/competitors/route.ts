/**
 * GET  /api/veille/competitors?companyId=xxx  → liste des compétiteurs
 * POST /api/veille/competitors               → ajout { companyId, network, handle, name, source }
 * DELETE /api/veille/competitors?id=xxx      → suppression
 */

import { NextRequest, NextResponse } from "next/server";
import { listCompetitors, addCompetitor, removeCompetitor } from "@/lib/repositories/competitors";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { requireCompanyAccess, requireUser } from "@/lib/auth/guard";
import type { ScrapeNetwork } from "@/lib/scraping/types";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const competitors = await listCompetitors(await resolveCompanyUuid(companyId));
    return NextResponse.json({ competitors });
  } catch (err) {
    console.error("[GET /api/veille/competitors]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      companyId?: string;
      network?: string;
      handle?: string;
      name?: string;
      source?: string;
    };

    const { companyId, network, handle, name, source } = body;

    if (!companyId || !network || !handle) {
      return NextResponse.json(
        { error: "companyId, network et handle sont requis" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const validNetworks: ScrapeNetwork[] = ["youtube", "instagram", "tiktok", "linkedin", "twitter", "facebook"];
    if (!validNetworks.includes(network as ScrapeNetwork)) {
      return NextResponse.json({ error: "Réseau non valide" }, { status: 400 });
    }

    const competitor = await addCompetitor({
      companyId: await resolveCompanyUuid(companyId),
      network: network as ScrapeNetwork,
      handle: handle.startsWith("@") ? handle : `@${handle}`,
      name: name ?? handle,
      source: source ?? "manuel",
    });

    return NextResponse.json({ competitor }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/veille/competitors]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }
    await removeCompetitor(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/veille/competitors]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
