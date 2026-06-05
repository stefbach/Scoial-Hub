/**
 * POST /api/veille/ads
 * Body : { country?, searchTerms?, searchPageIds?[], adType?, limit? }
 * → publicités concurrentes réelles (Meta Ad Library), triées par impressions.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import {
  fetchAds,
  fetchAdsScrapeCreators,
  isAdLibraryConfigured,
  isScrapeCreatorsConfigured,
} from "@/lib/scraping/ad-library";
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

    // Priorité 1 : voie Meta officielle si un token est disponible (donne les
    // impressions pour les pubs politiques/sociales).
    if (token || isAdLibraryConfigured()) {
      const result = await fetchAds({ ...body, token });
      // Si Meta échoue/retourne vide mais que ScrapeCreators est configuré, on
      // bascule dessus plutôt que de laisser une page vide.
      if (result.ads.length === 0 && isScrapeCreatorsConfigured()) {
        const sc = await fetchAdsScrapeCreators(body);
        if (sc.ads.length > 0) return NextResponse.json(sc);
      }
      return NextResponse.json(result);
    }

    // Priorité 2 : ScrapeCreators — fonctionne avec la seule clé, sans token Meta.
    if (isScrapeCreatorsConfigured()) {
      const sc = await fetchAdsScrapeCreators(body);
      return NextResponse.json(sc);
    }

    return NextResponse.json(
      {
        ads: [],
        error:
          "Ajoutez SCRAPECREATORS_API_KEY (recommandé, une seule clé) ou connectez Meta / ajoutez META_AD_LIBRARY_TOKEN dans Vercel, pour interroger la bibliothèque publicitaire.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/veille/ads]", err);
    return NextResponse.json({ ads: [], error: "Erreur serveur." }, { status: 200 });
  }
}
