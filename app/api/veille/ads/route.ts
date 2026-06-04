/**
 * POST /api/veille/ads
 * Body : { country?, searchTerms?, searchPageIds?[], adType?, limit? }
 * → publicités concurrentes réelles (Meta Ad Library), triées par impressions.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { fetchAds, isAdLibraryConfigured } from "@/lib/scraping/ad-library";
import { getMetaContext } from "@/lib/connectors/meta-pages";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      country?: string;
      searchTerms?: string;
      searchPageIds?: string[];
      adType?: "POLITICAL_AND_ISSUE_ADS" | "ALL";
      limit?: number;
      companyId?: string;
    };

    // On utilise en priorité le token utilisateur Meta de la société connectée
    // (le token d'env est souvent expiré). Repli sur META_AD_LIBRARY_TOKEN.
    let token: string | undefined;
    if (body.companyId) {
      try {
        token = (await getMetaContext(body.companyId)).userToken;
      } catch {
        /* ignore */
      }
    }

    if (!token && !isAdLibraryConfigured()) {
      return NextResponse.json(
        {
          ads: [],
          error:
            "Connectez Meta (Facebook) pour la société, ou ajoutez META_AD_LIBRARY_TOKEN dans Vercel, pour interroger la bibliothèque publicitaire.",
        },
        { status: 200 }
      );
    }

    const result = await fetchAds({ ...body, token });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/veille/ads]", err);
    return NextResponse.json({ ads: [], error: "Erreur serveur." }, { status: 200 });
  }
}
