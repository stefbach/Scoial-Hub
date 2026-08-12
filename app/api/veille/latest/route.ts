/**
 * GET /api/veille/latest?companyId=
 *
 * Retourne le dernier run de veille pour une entité donnée.
 * Lit `sh_benchmark_runs` (colonne company_id, status, results, finished_at).
 *
 * Si Supabase n'est pas configuré ou qu'aucun run n'existe, renvoie
 * un résumé simulé cohérent (même structure) pour que le Pilotage
 * dispose toujours d'insights.
 *
 * Shape de retour :
 * {
 *   runId        : string | null
 *   companyId    : string
 *   finishedAt   : string          — ISO 8601
 *   simulated    : boolean
 *   insights     : VeilleInsight[] — 2-3 insights concurrents
 *   recommandations : VeilleReco[] — recommandations prêtes à injecter en décisions
 *   resume       : string          — résumé exécutif
 * }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { buildSimulatedResult, type Lang } from "@/lib/veille/simulated";

/* ── Types exportés pour le composant Pilotage ─────────────────────────── */

// Les formes de données vivent dans lib/veille/types.ts et sont ré-exportées
// ici pour les consommateurs existants de cette route.
import type { VeilleInsight, VeilleReco, VeilleLatestResult } from "@/lib/veille/types";
export type { VeilleInsight, VeilleReco, VeilleLatestResult };

/* ── Mapper un run Supabase → VeilleLatestResult ──────────────────────── */

function mapRunToResult(
  run: Record<string, unknown>,
  companyId: string,
  lang: Lang = "fr"
): VeilleLatestResult {
  const en = lang === "en";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (run.results ?? {}) as any;
  const analysis = results?.analysis ?? null;

  // Extraire les insights depuis l'analyse IA ou le mock
  const insights: VeilleInsight[] = [];

  if (analysis?.formatsGagnants?.length) {
    const fg = analysis.formatsGagnants[0];
    insights.push({
      id: "vi-run-1",
      type: "format",
      label: `${en ? "Winning format" : "Format gagnant"} : ${fg.type}`,
      detail: fg.description ?? "",
      reseau: fg.network,
    });
  }
  if (analysis?.anglesThematiques?.length) {
    const at = analysis.anglesThematiques[0];
    insights.push({
      id: "vi-run-2",
      type: "angle",
      label: `${en ? "Strong angle" : "Angle porteur"} : ${at.angle}`,
      detail: `${en ? "Examples" : "Exemples"} : ${(at.exemples ?? []).slice(0, 2).join(", ")}.`,
    });
  }
  if (analysis?.benchmarkParReseau?.length) {
    const bk = analysis.benchmarkParReseau[0];
    insights.push({
      id: "vi-run-3",
      type: "benchmark",
      label: `Benchmark ${bk.network} : ${en ? "avg ER" : "ER moyen"} ${(bk.tauxEngagementMoyen * 100).toFixed(1)} %`,
      detail: en
        ? `Median likes: ${bk.medianeLikes}, frequency: ${bk.fréquencePostsSemaine} posts/week.`
        : `Médiane likes : ${bk.medianeLikes}, fréquence : ${bk.fréquencePostsSemaine} posts/sem.`,
      reseau: bk.network,
    });
  }

  // Extraire les recommandations depuis l'analyse
  const recommandations: VeilleReco[] = (analysis?.recommandations ?? [])
    .slice(0, 2)
    .map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rec: any, i: number): VeilleReco => ({
        id: `vr-run-${i}`,
        priorite: rec.priorite ?? "moyenne",
        titre: rec.titre ?? (en ? "Recommendation from competitive intelligence" : "Recommandation issue de la veille"),
        detail: rec.detail ?? "",
        action: rec.action ?? "",
      })
    );

  // Si l'analyse est absente ou incomplète, compléter avec du simulé
  const sim = buildSimulatedResult(companyId, lang);
  while (insights.length < 2) insights.push(sim.insights[insights.length]);
  if (recommandations.length === 0) recommandations.push(...sim.recommandations);

  return {
    runId: String(run.id),
    companyId,
    finishedAt: String(run.finished_at ?? run.created_at ?? new Date().toISOString()),
    simulated: !analysis?.aiGenerated,
    resume: analysis?.resume ?? sim.resume,
    insights,
    recommandations,
  };
}

/* ── Handler ───────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId");
  // Le contenu simulé et les libellés générés suivent la langue de l'interface.
  const lang: Lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "fr";

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId requis" },
      { status: 400 }
    );
  }

  // Tentative de lecture Supabase
  if (isSupabaseConfigured) {
    try {
      const supabase = createAdminClient();
      if (supabase) {
        // Les sociétés de démo ont un id non-UUID (ex. "occ"). On résout
        // l'UUID réel, sinon `.eq("company_id", …)` ne matche jamais la ligne
        // et le dernier run n'est pas retrouvé (→ on retombe toujours sur le simulé).
        const companyUuid = await resolveCompanyUuid(companyId);
        const { data, error } = await supabase
          .from("sh_benchmark_runs")
          .select("id, company_id, status, results, finished_at, created_at")
          .eq("company_id", companyUuid)
          .eq("status", "done")
          .order("finished_at", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          return NextResponse.json(
            mapRunToResult(data as Record<string, unknown>, companyId, lang)
          );
        }
        // Pas de run "done" — on tombe sur le simulé ci-dessous
      }
    } catch (err) {
      console.warn("[GET /api/veille/latest] Supabase error, fallback simulé:", err);
    }
  }

  // Aucun run disponible → résumé simulé
  return NextResponse.json(buildSimulatedResult(companyId, lang));
}
