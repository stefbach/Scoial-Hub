// GET /api/meta/geo?companyId=…&q=…&types=country,city,region
// Recherche de localisations de ciblage Meta (Graph /search?type=adgeolocation).
// Renvoie des entrées avec la CLÉ Meta (indispensable pour cibler des villes),
// comme l'autocomplétion de localisation du Gestionnaire de publicités.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

export interface MetaGeoResult {
  key: string;
  name: string;
  type: string;            // country | city | region | zip | …
  countryCode?: string;
  countryName?: string;
  region?: string;
}

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const typesParam = (req.nextUrl.searchParams.get("types") ?? "country,city,region").trim();
    // Locale Meta → noms de lieux dans la langue de l'UI (corrige #3).
    const localeParam = (req.nextUrl.searchParams.get("locale") ?? "").trim();
    const locale = localeParam === "en" ? "en_US" : localeParam === "fr" ? "fr_FR" : "";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (q.length < 2) return NextResponse.json({ results: [] });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken) return NextResponse.json({ results: [], connected: false });

    const locationTypes = JSON.stringify(typesParam.split(",").map((s) => s.trim()).filter(Boolean));
    const url =
      `https://graph.facebook.com/${V}/search?type=adgeolocation` +
      `&location_types=${encodeURIComponent(locationTypes)}` +
      (locale ? `&locale=${locale}` : "") +
      `&q=${encodeURIComponent(q)}&limit=15&access_token=${encodeURIComponent(ctx.userToken)}`;

    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>>; error?: { message?: string } };
    if (json.error) return NextResponse.json({ error: json.error.message ?? "Erreur recherche localisation" }, { status: 502 });

    const results: MetaGeoResult[] = (json.data ?? [])
      .map((g) => ({
        key: String(g.key ?? ""),
        name: String(g.name ?? ""),
        type: String(g.type ?? ""),
        countryCode: g.country_code ? String(g.country_code) : undefined,
        countryName: g.country_name ? String(g.country_name) : undefined,
        region: g.region ? String(g.region) : undefined,
      }))
      .filter((g) => g.key && g.name);

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[GET /api/meta/geo]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
