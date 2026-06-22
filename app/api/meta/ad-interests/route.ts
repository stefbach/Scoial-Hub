// GET /api/meta/ad-interests?companyId=…&q=…
// Recherche de centres d'intérêt de ciblage Meta (Graph /search?type=adinterest).
// Renvoie [{ id, name, audience_size? }] pour alimenter le ciblage des pubs.

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
    // Locale Meta → noms d'intérêts dans la langue de l'UI (en_US / fr_FR).
    const localeParam = (req.nextUrl.searchParams.get("locale") ?? "").trim();
    const locale = localeParam === "en" ? "en_US" : localeParam === "fr" ? "fr_FR" : "";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (q.length < 2) return NextResponse.json({ interests: [] });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken) return NextResponse.json({ interests: [], connected: false });

    const url = `https://graph.facebook.com/${V}/search?type=adinterest&q=${encodeURIComponent(q)}${locale ? `&locale=${locale}` : ""}&limit=15&access_token=${encodeURIComponent(ctx.userToken)}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>>; error?: { message?: string } };
    if (json.error) return NextResponse.json({ error: json.error.message ?? "Erreur recherche intérêts" }, { status: 502 });

    const interests = (json.data ?? []).map((i) => ({
      id: String(i.id ?? ""),
      name: String(i.name ?? ""),
      audienceSize: Number(i.audience_size_lower_bound ?? i.audience_size ?? 0) || undefined,
    })).filter((i) => i.id && i.name);

    return NextResponse.json({ interests });
  } catch (e) {
    console.error("[GET /api/meta/ad-interests]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
