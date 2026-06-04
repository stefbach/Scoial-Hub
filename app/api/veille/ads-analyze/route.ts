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
    const body = (await req.json()) as { ads?: AdEntry[]; country?: string; terms?: string; companyId?: string };
    const ads = Array.isArray(body.ads) ? body.ads : [];
    if (ads.length === 0) {
      return NextResponse.json({ error: "Aucune publicité à analyser." }, { status: 400 });
    }
    const analysis = await analyzeAds(ads, { country: body.country, terms: body.terms });

    // Mémoire stratégique : conclusions sur la stratégie publicitaire concurrente.
    if (body.companyId) {
      try {
        const { appendMemory } = await import("@/lib/memory");
        const a = analysis as unknown as {
          resume?: string;
          anglesDominants?: { angle: string }[];
          offres?: string[];
          ctas?: string[];
          recommandations?: { titre: string; detail: string }[];
        };
        const e: import("@/lib/memory").MemoryEntry[] = [];
        if (a.resume) e.push({ source: "ads", kind: "insight", title: "Synthèse pubs concurrentes", content: a.resume, score: 3 });
        for (const ang of a.anglesDominants ?? []) e.push({ source: "ads", kind: "angle", title: `Angle pub: ${ang.angle}`, content: ang.angle, score: 3 });
        if (a.offres?.length) e.push({ source: "ads", kind: "insight", title: "Offres concurrentes", content: a.offres.join(" · "), score: 2 });
        if (a.ctas?.length) e.push({ source: "ads", kind: "insight", title: "CTA concurrents", content: a.ctas.join(" · "), score: 2 });
        for (const r of a.recommandations ?? []) e.push({ source: "ads", kind: "recommendation", title: r.titre, content: r.detail, score: 3 });
        await appendMemory(body.companyId, e);
      } catch (memErr) {
        console.warn("[ads-analyze] memory:", memErr);
      }
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[POST /api/veille/ads-analyze]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
