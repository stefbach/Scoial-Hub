/**
 * POST /api/veille/ads
 * Body : { country?, searchTerms?, searchPageIds?[], adType?, limit? }
 * → publicités concurrentes réelles (Meta Ad Library), triées par impressions.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { fetchAds, isAdLibraryConfigured } from "@/lib/scraping/ad-library";

export async function POST(req: NextRequest) {
  try {
    if (!isAdLibraryConfigured()) {
      return NextResponse.json(
        {
          ads: [],
          error:
            "Connecteur non configuré. Ajoutez META_AD_LIBRARY_TOKEN (token UTILISATEUR « EAA… », identité vérifiée) dans Vercel.",
        },
        { status: 200 }
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      country?: string;
      searchTerms?: string;
      searchPageIds?: string[];
      adType?: "POLITICAL_AND_ISSUE_ADS" | "ALL";
      limit?: number;
    };
    const result = await fetchAds(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/veille/ads]", err);
    return NextResponse.json({ ads: [], error: "Erreur serveur." }, { status: 200 });
  }
}
