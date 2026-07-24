"use client";

// « Cerveau Pub » : analyse la performance réelle du compte Meta + la mémoire
// stratégique (RAG : concurrents/veille) via LLM, et affiche des recommandations
// actionnables pour affiner la stratégie publicitaire.

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useLang, useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

interface Analysis {
  diagnostic: string;
  winners: { name: string; why: string }[];
  toFix: { name: string; issue: string; action: string }[];
  budgetMoves: string[];
  audienceIdeas: string[];
  creativeAngles: string[];
  competitorInsights: string[];
  nextActions: { priority: "haute" | "moyenne" | "basse"; action: string }[];
  kpiWatch: string[];
  aiGenerated: boolean;
}

// BUG #8/#9 : la pastille « basse » utilisait bg-canvas (#0a0710, quasi-noir)
// + text-muted (gris-violet) → fond trop sombre et texte faiblement contrasté.
// On bascule sur la surface carte + encre lisible (même langage que le badge
// « Pause » du Pilote Pub), lisible dans LES DEUX thèmes.
const prio: Record<string, string> = {
  haute: "bg-danger-50 text-danger-700 ring-danger-200",
  moyenne: "bg-warning-50 text-warning-700 ring-warning-200",
  basse: "bg-card text-ink ring-hair",
};

function Chips({ title, items, accent = "primary" }: { title: string; items: string[]; accent?: "primary" | "ai" }) {
  if (!items?.length) return null;
  const cls = accent === "ai" ? "border-blue-200 bg-ai-textbg text-ai-text" : "border-primary-200 bg-primary-50 text-primary-700";
  return (
    <div className="card p-4">
      <div className="section-label">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((it, i) => <span key={i} className={`rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>{it}</span>)}
      </div>
    </div>
  );
}

export function AdStrategyBrain() {
  const t = useT();
  const { lang } = useLang();
  const { company } = useCompany();
  const companyId = company.id;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [fallback, setFallback] = useState(false);
  const [meta, setMeta] = useState<{ campaignsCount: number; account?: { name: string } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null); setFallback(false);
    try {
      // BUG #7 : on transmet la langue de l'UI pour une analyse traduite.
      const r = await fetch("/api/meta/ads-strategy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, language: lang }),
      });
      // Lecture tolérante : en cas de 504/erreur, la réponse n'est pas du JSON.
      const raw = await r.text();
      let d: { error?: string; analysis?: Analysis; campaignsCount?: number; account?: { name: string }; fallback?: boolean } = {};
      try { d = raw ? JSON.parse(raw) : {}; }
      catch {
        setError(
          r.status === 504 || r.status === 502
            ? t("L'analyse a dépassé le temps imparti. Réessayez.", "Analysis timed out. Please try again.")
            : t(`Réponse serveur inattendue (${r.status}). Réessayez.`, `Unexpected server response (${r.status}). Please try again.`)
        );
        return;
      }
      if (!r.ok) { setError(d.error || t("Échec de l'analyse.", "Analysis failed.")); return; }
      setAnalysis(d.analysis ?? null);
      setFallback(!!d.fallback);
      setMeta({ campaignsCount: d.campaignsCount ?? 0, account: d.account });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de l'analyse.", "Analysis failed."));
    } finally { setLoading(false); }
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair bg-canvas px-5 py-3">
        <div className="min-w-0">
          <span className="section-label text-ai-text">{t("Cerveau Pub — analyse & stratégie IA", "Ad Brain — AI analysis & strategy")}</span>
          <p className="mt-0.5 text-2xs text-muted">
            {t("Fusionne la performance réelle, la veille concurrents et la mémoire stratégique.", "Fuses real performance, competitor watch and strategic memory.")}
          </p>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
          {loading ? <><Spinner size={14} className="text-white" /> {t("Analyse…", "Analyzing…")}</> : analysis ? t("Ré-analyser", "Re-analyze") : t("Analyser la performance", "Analyze performance")}
        </button>
      </div>

      <div className="space-y-4 p-5">
        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

        {loading && (
          <BusyHint label={t("L'IA analyse vos campagnes + la veille…", "The AI is analyzing your campaigns + watch…")} eta={t("~20–40 s", "~20–40 s")} />
        )}

        {!analysis && !loading && !error && (
          <p className="text-sm text-muted">
            {t("Lancez l'analyse : l'IA lit vos campagnes réelles + la veille et propose des optimisations chiffrées.", "Run the analysis: the AI reads your real campaigns + watch and proposes quantified optimizations.")}
          </p>
        )}

        {analysis && (
          <>
            {/* Tuile claire : bg-ai-textbg/40 échappait au remap du thème clair
                (variante d'opacité non remappée → fond sombre opaque). */}
            <div className="rounded-xl border-l-4 border-ai-text bg-ai-textbg p-4">
              <div className="flex items-center gap-2">
                <span className="section-label text-ai-text">{t("Diagnostic", "Diagnostic")}</span>
                {analysis.aiGenerated && <span className="rounded-full bg-ai-textbg px-2 py-0.5 text-2xs font-semibold text-ai-text">IA</span>}
                {meta && <span className="text-2xs text-muted">· {meta.campaignsCount} {t("campagnes", "campaigns")}{meta.account ? ` · ${meta.account.name}` : ""}</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink">{analysis.diagnostic}</p>
            </div>

            {/* BUG #7 : si l'analyse IA détaillée n'aboutit pas (IA non
                configurée ou réponse inexploitable), on bascule sur une synthèse
                déterministe bâtie sur les chiffres réels — note calme et utile,
                jamais une impasse « réponse non exploitable ». */}
            {fallback && (
              <p className="rounded-lg bg-primary-50 px-3 py-2 text-2xs leading-relaxed text-primary-700">
                {t(
                  "Voici une synthèse calculée directement à partir de vos chiffres réels. Vous pouvez l'exploiter telle quelle, ou relancer « Ré-analyser » pour une analyse IA plus détaillée.",
                  "Here is a summary computed directly from your real figures. You can use it as-is, or use “Re-analyze” for a more detailed AI analysis."
                )}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {analysis.winners.length > 0 && (
                <div className="card p-4">
                  <div className="section-label text-success-700">{t("Ce qui marche", "What works")}</div>
                  <ul className="mt-2 space-y-2">
                    {analysis.winners.map((w, i) => (
                      <li key={i} className="text-sm"><span className="font-semibold text-ink">{w.name}</span> <span className="text-muted">— {w.why}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.toFix.length > 0 && (
                <div className="card p-4">
                  <div className="section-label text-warning-700">{t("À corriger", "To fix")}</div>
                  <ul className="mt-2 space-y-2">
                    {analysis.toFix.map((f, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-semibold text-ink">{f.name}</span> <span className="text-muted">— {f.issue}</span>
                        <span className="mt-0.5 block text-xs text-primary-700">→ {f.action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Chips title={t("Réallocations de budget", "Budget moves")} items={analysis.budgetMoves} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Chips title={t("Audiences à tester", "Audiences to test")} items={analysis.audienceIdeas} />
              <Chips title={t("Angles créatifs", "Creative angles")} items={analysis.creativeAngles} accent="ai" />
            </div>
            <Chips title={t("Enseignements concurrents (veille)", "Competitor insights (watch)")} items={analysis.competitorInsights} accent="ai" />

            {analysis.nextActions.length > 0 && (
              <div className="card p-4">
                <div className="section-label">{t("Prochaines actions", "Next actions")}</div>
                <ul className="mt-2 space-y-2">
                  {analysis.nextActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase ring-1 ${prio[a.priority] ?? prio.basse}`}>{a.priority}</span>
                      <span className="min-w-0 break-words text-sm text-ink">{a.action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Chips title={t("KPIs à surveiller", "KPIs to watch")} items={analysis.kpiWatch} />
          </>
        )}
      </div>
    </section>
  );
}
