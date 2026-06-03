/**
 * POST /api/veille/run
 *
 * { companyId, geo, keywords[], theme, competitorIds[] }
 * → collecte les contenus concurrents + analyse IA
 * → enregistre un benchmark run dans sh_benchmark_runs
 * → retourne le résultat complet
 *
 * Runtime Node.js (pas edge) pour les imports dynamiques Anthropic.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { collectAll } from "@/lib/scraping/collectors";
import { analyzeCompetition } from "@/lib/scraping/analyze";
import { listCompetitors } from "@/lib/repositories/competitors";
import { getConnection } from "@/lib/repositories/channel-connections";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import type { ScrapeNetwork } from "@/lib/scraping/types";

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString();
  let runId: string | null = null;

  try {
    const body = await req.json() as {
      companyId?: string;
      geo?: string;
      keywords?: string[];
      theme?: string;
      competitorIds?: string[];
    };

    const {
      companyId,
      geo = "fr",
      keywords = [],
      theme = "",
      competitorIds = [],
    } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    // 0. Résout l'UUID réel (les sociétés démo ont un id non‑UUID type "occ").
    const cid = await resolveCompanyUuid(companyId);

    // 1. Charger la liste des compétiteurs sélectionnés
    const allCompetitors = await listCompetitors(cid);
    const selectedCompetitors = competitorIds.length > 0
      ? allCompetitors.filter((c) => competitorIds.includes(c.id))
      : allCompetitors;

    const queryCompetitors = selectedCompetitors.map((c) => ({
      network: c.network as ScrapeNetwork,
      handle: c.handle,
      name: c.name,
    }));

    // 2. Créer un run "pending" dans Supabase (best-effort)
    if (isSupabaseConfigured) {
      const supabase = createAdminClient();
      if (supabase) {
        const { data } = await supabase
          .from("sh_benchmark_runs")
          .insert({
            company_id: cid,
            params: { geo, keywords, theme, competitorIds },
            status: "running",
            results: null,
          })
          .select("id")
          .single();
        if (data) runId = String(data.id);
      }
    }

    // 2b. Charger l'auth Instagram (Business Discovery) depuis les connecteurs.
    //     businessId = IG Business Account ID (connecteur Instagram)
    //     token      = token Meta (connecteur Facebook ou Instagram)
    let igAuth: { businessId: string; token: string } | undefined;
    try {
      const ig = await getConnection(cid, "instagram");
      const fb = await getConnection(cid, "facebook");
      const businessId = ig?.config?.ig_business_account_id ?? "";
      const token =
        ig?.config?.access_token ??
        fb?.config?.page_access_token ??
        fb?.config?.access_token ??
        "";
      if (businessId && token) igAuth = { businessId, token };
    } catch { /* best-effort */ }

    // 3. Collecter les contenus
    const scrapeResult = await collectAll({
      geo,
      keywords,
      theme,
      competitors: queryCompetitors,
      limit: 18,
      igAuth,
    });

    // 4. Analyser via Claude
    const analysis = await analyzeCompetition(
      { geo, keywords, theme, competitors: queryCompetitors, limit: 18 },
      scrapeResult.contents
    );

    // 5. Construire le résultat final
    const result = {
      scrape: {
        contents: scrapeResult.contents,
        realNetworks: scrapeResult.realNetworks,
        simulatedNetworks: scrapeResult.simulatedNetworks,
        durationMs: scrapeResult.durationMs,
        collectedAt: scrapeResult.collectedAt,
      },
      analysis,
    };

    // 6. Mettre à jour le run en Supabase (best-effort)
    if (isSupabaseConfigured && runId) {
      const supabase = createAdminClient();
      if (supabase) {
        await supabase
          .from("sh_benchmark_runs")
          .update({
            status: "done",
            results: result,
            finished_at: new Date().toISOString(),
          })
          .eq("id", runId);
      }
    }

    return NextResponse.json({
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("[POST /api/veille/run]", err);

    // Mettre à jour le run en erreur (best-effort)
    if (isSupabaseConfigured && runId) {
      try {
        const supabase = createAdminClient();
        if (supabase) {
          await supabase
            .from("sh_benchmark_runs")
            .update({ status: "error", finished_at: new Date().toISOString() })
            .eq("id", runId);
        }
      } catch { /* ignore */ }
    }

    // Jamais 500 fatal : on retourne un résultat simulé minimal
    return NextResponse.json(
      {
        runId: null,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: "Collecte partielle — résultats simulés",
        scrape: { contents: [], realNetworks: [], simulatedNetworks: [], durationMs: 0, collectedAt: new Date().toISOString() },
        analysis: null,
      },
      { status: 200 }
    );
  }
}
