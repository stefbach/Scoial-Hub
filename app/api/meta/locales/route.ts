// GET /api/meta/locales?companyId=…&q=…
// Recherche de langues de ciblage Meta (Graph /search?type=adlocale).
// Renvoie [{ key, name }] où `key` est l'identifiant de locale Meta.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (q.length < 2) return NextResponse.json({ results: [] });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken) return NextResponse.json({ results: [], connected: false });

    const url = `https://graph.facebook.com/${V}/search?type=adlocale&q=${encodeURIComponent(q)}&limit=20&access_token=${encodeURIComponent(ctx.userToken)}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>>; error?: { message?: string } };
    if (json.error) return NextResponse.json({ error: json.error.message ?? "Erreur recherche langues" }, { status: 502 });

    const results = (json.data ?? [])
      .map((l) => ({ key: Number(l.key ?? 0), name: String(l.name ?? "") }))
      .filter((l) => l.key && l.name);

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[GET /api/meta/locales]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
