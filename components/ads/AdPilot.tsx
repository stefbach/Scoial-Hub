"use client";

// « Pilote Pub » : lit la performance réelle, propose des actions concrètes
// (pause / budget / activation) et les applique avec garde-fous. Les actions
// « dépense » (activation, hausse de budget) demandent une confirmation.

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useLang, useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

interface PilotAction {
  type: "pause" | "activate" | "budget";
  campaignId: string;
  campaignName: string;
  reason: string;
  factor?: number;
  impact: "safe" | "spend";
}

export function AdPilot() {
  const t = useT();
  const { lang } = useLang();
  const { company } = useCompany();
  const companyId = company.id;

  const [actions, setActions] = useState<PilotAction[] | null>(null);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});

  async function analyze() {
    setLoading(true); setError(null); setActions(null); setFallback(false); setDone({});
    try {
      // BUG #15 : on transmet la langue de l'UI pour des propositions traduites.
      const r = await fetch(`/api/meta/ads/pilot?companyId=${encodeURIComponent(companyId)}&language=${lang}`);
      const raw = await r.text();
      let d: { actions?: PilotAction[]; error?: string; connected?: boolean; fallback?: boolean } = {};
      try { d = raw ? JSON.parse(raw) : {}; } catch { setError(t("Réponse inattendue.", "Unexpected response.")); return; }
      if (!r.ok) { setError(d.error || t("Échec de l'analyse.", "Analysis failed.")); return; }
      setActions(d.actions ?? []);
      setFallback(!!d.fallback);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de l'analyse.", "Analysis failed."));
    } finally { setLoading(false); }
  }

  async function apply(a: PilotAction, i: number) {
    if (a.impact === "spend") {
      const msg = a.type === "activate"
        ? t(`Activer « ${a.campaignName} » déclenche une dépense réelle. Confirmer ?`, `Activating "${a.campaignName}" triggers real spend. Confirm?`)
        : t(`Augmenter le budget de « ${a.campaignName} » (×${a.factor}). Confirmer ?`, `Increase budget of "${a.campaignName}" (×${a.factor}). Confirm?`);
      if (!window.confirm(msg)) return;
    }
    setApplying(i); setError(null);
    try {
      const r = await fetch("/api/meta/ads/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action: { type: a.type, campaignId: a.campaignId, factor: a.factor } }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || t("Échec de l'application.", "Apply failed.")); return; }
      setDone((prev) => ({ ...prev, [i]: t("Appliqué ✓", "Applied ✓") }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de l'application.", "Apply failed."));
    } finally { setApplying(null); }
  }

  // BUG #21 : badge « Pause »/budget réduit -> fond plus clair + texte clair (ink)
  // au lieu du couple bg-canvas/text-muted illisible sur fond sombre.
  const badge = (a: PilotAction) => {
    const label = a.type === "pause"
      ? t("Pause", "Pause")
      : a.type === "activate"
        ? t("Activer", "Activate")
        : t(`Budget ×${a.factor}`, `Budget ×${a.factor}`);
    if (a.type === "pause") return { label, cls: "bg-card text-ink ring-1 ring-hair" };
    if (a.type === "activate") return { label, cls: "bg-success-50 text-success-700" };
    return {
      label,
      cls: (a.factor ?? 1) > 1 ? "bg-warning-50 text-warning-700" : "bg-card text-ink ring-1 ring-hair",
    };
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair bg-canvas px-5 py-3">
        <div className="min-w-0">
          <span className="section-label text-ai-text">{t("Pilote Pub — optimisation automatique", "Ad Pilot — auto-optimization")}</span>
          <p className="mt-0.5 text-2xs text-muted">{t("Lit la performance réelle et propose des actions à appliquer (pause sûre · budget/activation avec confirmation).", "Reads real performance and proposes actions to apply (safe pause · budget/activation with confirmation).")}</p>
        </div>
        <button onClick={analyze} disabled={loading} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
          {loading && <Spinner size={14} className="text-white" />}
          {loading ? t("Analyse…", "Analyzing…") : actions ? t("Ré-analyser", "Re-analyze") : t("Proposer des actions", "Propose actions")}
        </button>
      </div>

      <div className="space-y-3 p-5">
        {loading && <BusyHint label={t("Analyse de la performance et des optimisations…", "Analyzing performance and optimizations…")} eta={t("~15–40 s", "~15–40 s")} />}
        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
        {actions && actions.length === 0 && !loading && (
          <p className="text-sm text-muted">{t("Aucune action proposée (compte sain, ou pas assez de données).", "No action proposed (account healthy, or not enough data).")}</p>
        )}

        {/* BUG #14 : l'IA n'a pas pu analyser → on bascule sur des suggestions
            génériques, en l'indiquant clairement plutôt qu'une impasse. */}
        {actions && actions.length > 0 && fallback && !loading && (
          <p className="rounded-lg bg-warning-50 px-3 py-2 text-2xs leading-relaxed text-warning-700">
            {t(
              "L'analyse IA détaillée n'a pas abouti — voici des optimisations génériques basées sur vos chiffres. Relancez « Ré-analyser » pour réessayer.",
              "Detailed AI analysis was unavailable — here are generic optimizations based on your figures. Use “Re-analyze” to try again."
            )}
          </p>
        )}

        {/* BUG #17 : légende expliquant les deux couleurs de bouton « Appliquer ». */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-page" />
              {t("Action sûre — sans dépense supplémentaire (pause, baisse de budget)", "Safe action — no extra spend (pause, budget cut)")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-warning-500" />
              {t("Engage une dépense réelle (activation, hausse de budget) — confirmation requise", "Triggers real spend (activate, budget increase) — confirmation required")}
            </span>
          </div>
        )}

        {actions && actions.map((a, i) => {
          const b = badge(a);
          const spend = a.impact === "spend";
          // BUG #17 : info-bulle expliquant la couleur du bouton.
          const applyTitle = spend
            ? t(
                "Bouton orange : cette action engage une dépense réelle (activation ou hausse de budget). Une confirmation vous sera demandée.",
                "Orange button: this action triggers real spend (activate or budget increase). You will be asked to confirm."
              )
            : t(
                "Bouton améthyste : action sûre, sans dépense supplémentaire (mise en pause ou baisse de budget).",
                "Amethyst button: safe action with no extra spend (pause or budget decrease)."
              );
          return (
            <div key={i} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-hair p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${b.cls}`}>{b.label}</span>
                  <span className="text-sm font-semibold text-ink">{a.campaignName}</span>
                  {spend && <span className="rounded-full bg-warning-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning-700">{t("dépense", "spend")}</span>}
                </div>
                <p className="mt-1 text-xs text-muted">{a.reason}</p>
              </div>
              <button
                onClick={() => apply(a, i)}
                disabled={applying === i || !!done[i]}
                title={applyTitle}
                aria-label={applyTitle}
                // BUG #16 : contraste lisible — amber vif (#f59e0b) avec texte
                // quasi-noir (canvas), ou améthyste vif avec texte blanc.
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${spend ? "bg-warning-500 text-canvas ring-1 ring-warning-600" : "bg-page text-white ring-1 ring-primary-300/40"}`}
              >
                {applying === i && <Spinner size={12} className={spend ? "text-canvas" : "text-white"} />}
                {done[i] ?? (applying === i ? t("Application…", "Applying…") : t("Appliquer", "Apply"))}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
