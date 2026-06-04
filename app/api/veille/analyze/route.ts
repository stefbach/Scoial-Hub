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
      companyId?: string;
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

    // Mémoire stratégique persistante : on conserve les conclusions de la veille.
    if (body.companyId) {
      try {
        const { appendMemory } = await import("@/lib/memory");
        const e: import("@/lib/memory").MemoryEntry[] = [];
        if (analysis.resume) e.push({ source: "veille", kind: "insight", title: "Synthèse veille", content: analysis.resume, score: 3 });
        for (const c of analysis.competiteurs ?? []) e.push({ source: "veille", kind: "competitor", title: `Concurrent ${c.handle}`, content: `${c.strategie ?? ""} ${c.pourquoiPuissant ?? ""}`.trim(), tags: [c.network], score: 4 });
        for (const f of analysis.formatsGagnants ?? []) e.push({ source: "veille", kind: "format", title: `Format ${f.type}`, content: f.description, tags: [f.network], score: 2 });
        for (const a of analysis.anglesThematiques ?? []) e.push({ source: "veille", kind: "angle", title: `Angle: ${a.angle}`, content: a.exemples?.length ? `${a.angle} — ex: ${a.exemples.join(", ")}` : a.angle, score: a.potentiel === "fort" ? 3 : 2 });
        for (const r of analysis.recommandations ?? []) e.push({ source: "veille", kind: "recommendation", title: r.titre, content: `${r.detail} → ${r.action}`, score: r.priorite === "haute" ? 4 : 2 });
        await appendMemory(body.companyId, e);
      } catch (memErr) {
        console.warn("[veille/analyze] memory:", memErr);
      }
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[POST /api/veille/analyze]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
