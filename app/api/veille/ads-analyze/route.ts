/**
 * POST /api/veille/ads-analyze
 * Body : { ads: AdEntry[], country?, terms? }
 * → analyse IA (Claude) de la stratégie publicitaire des concurrents.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { analyzeAds } from "@/lib/scraping/ad-analyze";
import type { AdEntry } from "@/lib/scraping/ad-library";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { ads?: AdEntry[]; country?: string; terms?: string };
    const ads = Array.isArray(body.ads) ? body.ads : [];
    if (ads.length === 0) {
      return NextResponse.json({ error: "Aucune publicité à analyser." }, { status: 400 });
    }
    const analysis = await analyzeAds(ads, { country: body.country, terms: body.terms });
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[POST /api/veille/ads-analyze]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
