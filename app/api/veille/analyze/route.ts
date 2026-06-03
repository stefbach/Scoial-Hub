/**
 * POST /api/veille/analyze
 * Body : { contents: CompetitorContent[], geo?, keywords?, theme? }
 * → analyse IA (Claude) des contenus déjà collectés. Découplé de /run pour
 *   que ni la collecte ni l'analyse ne dépassent la limite de 60 s.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { analyzeCompetition } from "@/lib/scraping/analyze";
import type { CompetitorContent, ScrapeNetwork } from "@/lib/scraping/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      contents?: CompetitorContent[];
      geo?: string;
      keywords?: string[];
      theme?: string;
    };

    const contents = Array.isArray(body.contents) ? body.contents : [];
    const competitors = [
      ...new Set(contents.map((c) => `${c.network}|${c.handle}`)),
    ].map((k) => {
      const [network, handle] = k.split("|");
      return { network: network as ScrapeNetwork, handle };
    });

    const analysis = await analyzeCompetition(
      {
        geo: body.geo ?? "fr",
        keywords: body.keywords ?? [],
        theme: body.theme ?? "",
        competitors,
        limit: contents.length,
      },
      contents
    );

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[POST /api/veille/analyze]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
