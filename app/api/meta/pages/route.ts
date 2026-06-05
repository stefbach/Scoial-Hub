// GET  /api/meta/pages?companyId=…  → liste des Pages de l'utilisateur + Page sélectionnée
// POST /api/meta/pages { companyId, pageId } → sélectionne une Page pour la société
//
// Utilise le token UTILISATEUR Meta stocké lors de l'OAuth pour lister toutes
// les Pages gérées, et permettre d'en choisir une (sociétés multi-Pages).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  fetchMetaPages,
  getMetaContext,
  storeMetaConnections,
} from "@/lib/connectors/meta-pages";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken) {
      return NextResponse.json({ pages: [], selectedPageId: ctx.pageId ?? null, needsReconnect: true });
    }

    const pages = await fetchMetaPages(ctx.userToken);
    return NextResponse.json({
      // on n'expose jamais les tokens de page au client
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        igUsername: p.igUsername ?? null,
        hasInstagram: Boolean(p.igId),
        picture: p.picture ?? null,
        fanCount: p.fanCount ?? null,
      })),
      selectedPageId: ctx.pageId ?? null,
      needsReconnect: false,
    });
  } catch (err) {
    console.error("[GET /api/meta/pages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { companyId, pageId } = await req.json();
    if (!companyId || !pageId) {
      return NextResponse.json({ error: "companyId et pageId requis" }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken) {
      return NextResponse.json({ error: "Reconnexion Meta requise" }, { status: 409 });
    }

    const pages = await fetchMetaPages(ctx.userToken);
    const page = pages.find((p) => p.id === String(pageId));
    if (!page) return NextResponse.json({ error: "Page introuvable" }, { status: 404 });

    await storeMetaConnections(companyId, page, ctx.userToken);
    return NextResponse.json({ ok: true, selectedPageId: page.id, name: page.name });
  } catch (err) {
    console.error("[POST /api/meta/pages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
