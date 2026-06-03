"use client";

/**
 * BenchmarkCard — affiche le benchmark sectoriel ciblé produit par l'agent Analyste.
 * Tableau KPIs (cible vs sectoriel), projection de captation d'audience et recommandations.
 */

import type { BenchmarkResult, BenchmarkKPIRow, Cadence } from "@/lib/agents/types";
import { useT } from "@/lib/i18n";

// ── Helpers ────────────────────────────────────────────────────────────────────

function AssessmentBadge({ assessment }: { assessment: BenchmarkKPIRow["assessment"] }) {
  const t = useT();
  const config = {
    above: { label: t("↑ Au-dessus", "↑ Above"), cls: "bg-success-50 text-success-700 ring-1 ring-success-500/20" },
    inline: { label: t("≈ Dans la norme", "≈ On target"), cls: "bg-canvas text-muted ring-1 ring-hair" },
    below: { label: t("↓ En dessous", "↓ Below"), cls: "bg-danger-50 text-danger-700 ring-1 ring-danger-500/20" },
  }[assessment];

  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold ${config.cls}`}>
      {config.label}
    </span>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

interface BenchmarkCardProps {
  benchmark: BenchmarkResult;
  cadence?: Cadence;
}

export function BenchmarkCard({ benchmark, cadence }: BenchmarkCardProps) {
  const t = useT();

  const PERIOD_LABELS: Record<Required<Cadence>["reportingPeriod"], string> = {
    day: t("Journalier", "Daily"),
    week: t("Hebdomadaire", "Weekly"),
    month: t("Mensuel", "Monthly"),
    quarter: t("Trimestriel", "Quarterly"),
    year: t("Annuel", "Annual"),
  };

  const reportingPeriod = cadence?.reportingPeriod ?? "month";
  const periodLabel = PERIOD_LABELS[reportingPeriod];
  const proj = benchmark.audienceCaptureProjection;

  return (
    <div className="card overflow-hidden">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hair px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-success-50 border border-success-200">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-success-700">
            <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-ink">{t("Benchmark sectoriel ciblé", "Targeted sector benchmark")}</span>
        <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700 ring-1 ring-success-500/20">
          {periodLabel}
        </span>
        <span className="ml-auto max-w-[200px] truncate text-2xs text-muted" title={benchmark.benchmarkTarget}>
          {benchmark.benchmarkTarget}
        </span>
      </div>

      <div className="divide-y divide-hair">
        {/* Tableau KPIs */}
        {benchmark.kpiRows.length > 0 && (
          <div className="px-4 py-3">
            <div className="section-label mb-2">{t("KPIs — Cible vs Référence sectorielle", "KPIs — Campaign target vs sector reference")}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-hair">
                    <th className="pb-1.5 text-left font-semibold text-muted">{t("Indicateur", "Indicator")}</th>
                    <th className="pb-1.5 text-right font-semibold text-muted">{t("Cible campagne", "Campaign target")}</th>
                    <th className="pb-1.5 text-right font-semibold text-muted">{t("Secteur", "Sector")}</th>
                    <th className="pb-1.5 text-right font-semibold text-muted">{t("Évaluation", "Assessment")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair">
                  {benchmark.kpiRows.map((row, i) => (
                    <tr key={i} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-1.5 font-medium text-ink">{row.kpi}</td>
                      <td className="py-1.5 text-right font-semibold text-primary-700">
                        {row.targetValue}
                      </td>
                      <td className="py-1.5 text-right text-muted">{row.sectorReference}</td>
                      <td className="py-1.5 text-right">
                        <AssessmentBadge assessment={row.assessment} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Projection de captation d'audience */}
        <div className="px-4 py-3">
          <div className="section-label mb-2">{t("Projection de captation d'audience", "Audience capture projection")}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile
              label={t("Audience cible", "Target audience")}
              value={proj.targetAudienceSize.toLocaleString("fr-FR")}
              unit={t("personnes", "people")}
              color="text-ink"
            />
            <MetricTile
              label={t("Portée projetée", "Projected reach")}
              value={proj.estimatedReach.toLocaleString("fr-FR")}
              unit={t("contacts uniques", "unique contacts")}
              color="text-primary-700"
            />
            <MetricTile
              label={t("Taux de captation", "Capture rate")}
              value={`${proj.captureRate}%`}
              unit={t("de l'audience cible", "of target audience")}
              color="text-success-700"
            />
            <MetricTile
              label={t("Horizon", "Timeframe")}
              value={proj.timeframe}
              unit=""
              color="text-ai-text"
            />
          </div>

          {/* Barre de progression du taux de captation */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-2xs text-muted">{t("Captation de l'audience cible", "Target audience capture")}</span>
              <span className="text-2xs font-semibold text-success-700">{proj.captureRate}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas border border-hair">
              <div
                className="h-full rounded-full bg-success-500 transition-all"
                style={{ width: `${Math.min(proj.captureRate, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recommandations d'optimisation */}
        {benchmark.optimizationRecommendations.length > 0 && (
          <div className="px-4 py-3">
            <div className="section-label mb-2">{t("Recommandations d'optimisation", "Optimization recommendations")}</div>
            <ul className="space-y-1.5">
              {benchmark.optimizationRecommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-50 text-2xs font-bold text-success-700 ring-1 ring-success-200">
                    {i + 1}
                  </span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Synthèse */}
        {benchmark.summary && (
          <div className="bg-canvas px-4 py-3">
            <div className="section-label mb-1">{t("Synthèse", "Summary")}</div>
            <p className="text-xs leading-relaxed text-ink">{benchmark.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tuile de métrique ─────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-hair bg-card p-2.5">
      <div className="text-2xs text-muted">{label}</div>
      <div className={`mt-0.5 text-base font-bold leading-tight ${color}`}>{value}</div>
      {unit && <div className="text-2xs text-muted/70">{unit}</div>}
    </div>
  );
}
