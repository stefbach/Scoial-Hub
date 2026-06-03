"use client";

import type { AnalysisResult } from "@/lib/scraping/analyze";
import { useT } from "@/lib/i18n";

const PRIORITE_STYLE: Record<string, string> = {
  haute:   "bg-danger-50 border-danger-200 text-danger-700",
  moyenne: "bg-warning-50 border-warning-200 text-warning-700",
  basse:   "bg-success-50 border-success-200 text-success-700",
};

const POTENTIEL_DOT: Record<string, string> = {
  fort:   "bg-success-500",
  moyen:  "bg-warning-500",
  faible: "bg-muted",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(Math.round(n));
}

interface Props {
  analysis: AnalysisResult;
}

export function AnalysisPanel({ analysis }: Props) {
  const t = useT();

  function priorityLabel(priorite: string): string {
    if (priorite === "haute") return t("Priorité haute", "High priority");
    if (priorite === "moyenne") return t("Priorité moyenne", "Medium priority");
    return t("Priorité basse", "Low priority");
  }

  return (
    <div className="space-y-5">
      {/* Badge IA / Mock */}
      <div className="flex items-center gap-2">
        {analysis.aiGenerated ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ai-text/20 bg-ai-textbg px-2.5 py-0.5 text-2xs font-semibold text-ai-text">
            <span aria-hidden="true">✦</span> {t("Analyse Claude", "Claude analysis")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-0.5 text-2xs font-medium text-warning-700">
            {t("Analyse simulée (clé Claude non configurée)", "Simulated analysis (Claude key not configured)")}
          </span>
        )}
      </div>

      {/* Résumé exécutif */}
      <div className="card p-4 bg-ai-textbg border-ai-text/15">
        <p className="section-label mb-2">{t("Résumé exécutif", "Executive summary")}</p>
        <p className="text-sm text-ink leading-relaxed">{analysis.resume}</p>
      </div>

      {/* Formats gagnants */}
      <section>
        <p className="section-label mb-3">{t("Formats gagnants", "Winning formats")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {analysis.formatsGagnants.map((f, i) => (
            <div key={i} className="card p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{f.type}</span>
                <span className="chip">{f.network}</span>
              </div>
              <p className="text-xs text-muted leading-snug">{f.description}</p>
              <div className="flex items-center gap-1 pt-0.5">
                <span className="text-2xs text-muted">{t("ER moyen", "Avg. ER")}</span>
                <span className="text-xs font-bold text-primary-600">{(f.engagementMoyen * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Angles thématiques */}
      <section>
        <p className="section-label mb-3">{t("Angles & thématiques performants", "High-performing angles & themes")}</p>
        <div className="space-y-2">
          {analysis.anglesThematiques.map((a, i) => (
            <div key={i} className="card p-3 flex items-start gap-3">
              <span className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${POTENTIEL_DOT[a.potentiel] ?? "bg-muted"}`} />
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink">{a.angle}</p>
                <div className="flex flex-wrap gap-1">
                  {a.exemples.map((ex, j) => (
                    <span key={j} className="chip text-2xs">{ex}</span>
                  ))}
                </div>
              </div>
              <span className="ml-auto shrink-0 text-2xs font-semibold capitalize text-muted">{a.potentiel}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Fréquence */}
      <div className="card p-4 flex items-start gap-3">
        <CalendarIcon />
        <div>
          <p className="section-label mb-1">{t("Fréquence recommandée", "Recommended frequency")}</p>
          <p className="text-sm text-ink">{analysis.frequenceRecommandee}</p>
        </div>
      </div>

      {/* Benchmark par réseau */}
      {analysis.benchmarkParReseau.length > 0 && (
        <section>
          <p className="section-label mb-3">{t("Benchmark par réseau", "Benchmark by network")}</p>
          <div className="overflow-x-auto rounded-xl border border-hair">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hair bg-canvas">
                  <th className="text-left px-4 py-2.5 text-2xs section-label">{t("Réseau", "Network")}</th>
                  <th className="text-right px-4 py-2.5 text-2xs section-label">{t("Likes moy.", "Avg. likes")}</th>
                  <th className="text-right px-4 py-2.5 text-2xs section-label">{t("Vues moy.", "Avg. views")}</th>
                  <th className="text-right px-4 py-2.5 text-2xs section-label">{t("Taux ER", "ER rate")}</th>
                  <th className="text-right px-4 py-2.5 text-2xs section-label">{t("Posts/sem.", "Posts/wk.")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair bg-card">
                {analysis.benchmarkParReseau.map((b, i) => (
                  <tr key={i} className="hover:bg-canvas transition-colors">
                    <td className="px-4 py-2.5 font-medium text-ink capitalize">{b.network}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{fmt(b.medianeLikes)}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{fmt(b.medianeVues)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-primary-600">
                      {(b.tauxEngagementMoyen * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted">{b.fréquencePostsSemaine}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recommandations */}
      <section>
        <p className="section-label mb-3">{t("Recommandations stratégiques", "Strategic recommendations")}</p>
        <div className="space-y-2.5">
          {analysis.recommandations.map((r, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-semibold ${PRIORITE_STYLE[r.priorite] ?? "bg-canvas border-hair text-muted"}`}>
                  {priorityLabel(r.priorite)}
                </span>
                <h4 className="text-sm font-semibold text-ink">{r.titre}</h4>
              </div>
              <p className="text-xs text-muted leading-snug">{r.detail}</p>
              <div className="flex items-start gap-2 rounded-lg bg-canvas px-3 py-2 border border-hair">
                <ArrowIcon />
                <p className="text-xs text-ink">{r.action}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="shrink-0 mt-0.5 text-primary-500" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <path d="M5 1v3M11 1v3M2 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="shrink-0 mt-0.5 text-primary-500" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
