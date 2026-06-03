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

/* ── Types exportés pour le composant Pilotage ─────────────────────────── */

export interface VeilleInsight {
  id: string;
  type: "format" | "angle" | "benchmark";
  label: string;
  detail: string;
  reseau?: string;
}

export interface VeilleReco {
  id: string;
  priorite: "haute" | "moyenne" | "basse";
  titre: string;
  detail: string;
  action: string;
}

export interface VeilleLatestResult {
  runId: string | null;
  companyId: string;
  finishedAt: string;
  simulated: boolean;
  resume: string;
  insights: VeilleInsight[];
  recommandations: VeilleReco[];
}

/* ── Mock déterministe ─────────────────────────────────────────────────── */

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
  return h;
}

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildSimulatedResult(companyId: string): VeilleLatestResult {
  const r = rng(hashSeed(`${companyId}|veille-latest`));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];

  const insights: VeilleInsight[] = [
    {
      id: "vi-1",
      type: "format",
      label: pick([
        "Les Reels < 60 s dominent l'engagement concurrent",
        "Les carrousels éducatifs génèrent 2× plus de sauvegardes",
        "Les vidéos coulisses surperforment sur Instagram",
      ]),
      detail: pick([
        "Taux d'engagement moyen 8,3 % sur ce format chez vos concurrents directs.",
        "Portée organique +42 % vs posts statiques sur les 30 derniers jours.",
        "Format privilégié par 3 concurrents sur 4 dans la zone marché.",
      ]),
      reseau: pick(["instagram", "tiktok", "linkedin"]),
    },
    {
      id: "vi-2",
      type: "angle",
      label: pick([
        "Angle 'témoignage client' très porteur sur ce marché",
        "Angle 'coulisses & transparence' en forte croissance",
        "Angle 'chiffres & preuves' génère le plus de partages",
      ]),
      detail: pick([
        "3 concurrents ont publié des témoignages vidéo cette semaine avec un ER moyen de 6,1 %.",
        "Les posts authenticité cumulent 2 400 vues supplémentaires en moyenne.",
        "Les infographies data génèrent 3× plus de partages organiques.",
      ]),
      reseau: pick(["facebook", "instagram", "linkedin"]),
    },
    {
      id: "vi-3",
      type: "benchmark",
      label: pick([
        "Concurrent en forte accélération détecté",
        "Un concurrent a lancé une série hebdomadaire",
        "Fréquence de publication concurrente en hausse",
      ]),
      detail: pick([
        "Publication quotidienne depuis 2 semaines — +18 % de followers en 30 jours.",
        "Série thématique le mardi + vendredi, ER 5,4 % en moyenne.",
        "Cadence passée de 2 à 5 posts/semaine — algorithme plus favorable.",
      ]),
      reseau: "instagram",
    },
  ];

  const recommandations: VeilleReco[] = [
    {
      id: "vr-1",
      priorite: "haute",
      titre: pick([
        "Lancer une série Reels hebdomadaire",
        "Produire 3 carrousels éducatifs ce mois-ci",
        "Activer le format Stories quotidiennes",
      ]),
      detail: "Insight issu de la veille concurrentielle — format dominant identifié sur votre marché.",
      action: pick([
        "Planifier 2 Reels/semaine sur les 4 prochaines semaines.",
        "Décliner les 3 angles thématiques détectés en carrousels.",
        "Mettre en place un story-telling quotidien avec sondage intégré.",
      ]),
    },
    {
      id: "vr-2",
      priorite: "moyenne",
      titre: pick([
        "Augmenter la fréquence de publication sur LinkedIn",
        "Tester l'angle témoignage client sur Facebook",
        "Répliquer l'angle 'coulisses' d'un concurrent performant",
      ]),
      detail: "La veille détecte un écart de cadence vs la concurrence — opportunité de rattrapage.",
      action: pick([
        "Passer de 2 à 4 posts/semaine sur LinkedIn pendant 30 jours.",
        "Créer 2 posts témoignages avec avis clients réels d'ici 10 jours.",
        "Produire une vidéo coulisses / processus interne cette semaine.",
      ]),
    },
  ];

  return {
    runId: null,
    companyId,
    finishedAt: new Date().toISOString(),
    simulated: true,
    resume: `La veille concurrentielle simulée pour ${companyId} identifie 3 insights clés : les formats courts vidéo dominent l'engagement, l'angle authenticité est en forte croissance, et au moins un concurrent a accéléré sa cadence de publication. Opportunité d'agir rapidement.`,
    insights,
    recommandations,
  };
}

/* ── Mapper un run Supabase → VeilleLatestResult ──────────────────────── */

function mapRunToResult(
  run: Record<string, unknown>,
  companyId: string
): VeilleLatestResult {
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
      label: `Format gagnant : ${fg.type}`,
      detail: fg.description ?? "",
      reseau: fg.network,
    });
  }
  if (analysis?.anglesThematiques?.length) {
    const at = analysis.anglesThematiques[0];
    insights.push({
      id: "vi-run-2",
      type: "angle",
      label: `Angle porteur : ${at.angle}`,
      detail: `Exemples : ${(at.exemples ?? []).slice(0, 2).join(", ")}.`,
    });
  }
  if (analysis?.benchmarkParReseau?.length) {
    const bk = analysis.benchmarkParReseau[0];
    insights.push({
      id: "vi-run-3",
      type: "benchmark",
      label: `Benchmark ${bk.network} : ER moyen ${(bk.tauxEngagementMoyen * 100).toFixed(1)} %`,
      detail: `Médiane likes : ${bk.medianeLikes}, fréquence : ${bk.fréquencePostsSemaine} posts/sem.`,
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
        titre: rec.titre ?? "Recommandation issue de la veille",
        detail: rec.detail ?? "",
        action: rec.action ?? "",
      })
    );

  // Si l'analyse est absente ou incomplète, compléter avec du simulé
  const sim = buildSimulatedResult(companyId);
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
        const { data, error } = await supabase
          .from("sh_benchmark_runs")
          .select("id, company_id, status, results, finished_at, created_at")
          .eq("company_id", companyId)
          .eq("status", "done")
          .order("finished_at", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          return NextResponse.json(
            mapRunToResult(data as Record<string, unknown>, companyId)
          );
        }
        // Pas de run "done" — on tombe sur le simulé ci-dessous
      }
    } catch (err) {
      console.warn("[GET /api/veille/latest] Supabase error, fallback simulé:", err);
    }
  }

  // Aucun run disponible → résumé simulé
  return NextResponse.json(buildSimulatedResult(companyId));
}
