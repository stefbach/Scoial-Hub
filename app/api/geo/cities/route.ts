/**
 * GET /api/geo/cities?country=fr,mu&q=par
 *
 * Autocomplétion de villes pour le(s) pays sélectionné(s), via Nominatim
 * (OpenStreetMap) — gratuit, sans clé. Filtré par codes pays ISO2.
 * Retour : { cities: { name: string; label: string }[] }
 *
 * Remarque : Nominatim impose un User-Agent et un usage modéré ; on appelle
 * côté serveur (UA correct, pas de CORS) et le client débounce les requêtes.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

interface NominatimItem {
  name?: string;
  display_name?: string;
  addresstype?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    region?: string;
    country?: string;
  };
}

export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") ?? "").trim().toLowerCase();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ cities: [] });

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "fr");
    url.searchParams.set("limit", "8");
    url.searchParams.set("featureType", "city");
    url.searchParams.set("city", q);
    if (country) url.searchParams.set("countrycodes", country);

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "SocialHub/1.0 (city-autocomplete)",
        "Accept-Language": "fr",
      },
      // Cache court côté plateforme.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json({ cities: [] });

    const data = (await res.json()) as NominatimItem[];
    const seen = new Set<string>();
    const cities: { name: string; label: string }[] = [];
    for (const it of data) {
      const a = it.address ?? {};
      const name = it.name || a.city || a.town || a.village || a.municipality || "";
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const region = a.state || a.region || "";
      const ctry = a.country || "";
      const label = [name, region, ctry].filter(Boolean).join(", ");
      cities.push({ name, label });
    }
    return NextResponse.json({ cities });
  } catch (err) {
    console.warn("[geo/cities] error:", err);
    return NextResponse.json({ cities: [] });
  }
}
