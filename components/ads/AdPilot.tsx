"use client";

// « Pilote Pub » : lit la performance réelle, propose des actions concrètes
// (pause / budget / activation) et les applique avec garde-fous. Les actions
// « dépense » (activation, hausse de budget) demandent une confirmation.

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
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
  const { company } = useCompany();
  const companyId = company.id;

  const [actions, setActions] = useState<PilotAction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});

  async function analyze() {
    setLoading(true); setError(null); setActions(null); setDone({});
    try {
      const r = await fetch(`/api/meta/ads/pilot?companyId=${encodeURIComponent(companyId)}`);
      const raw = await r.text();
      let d: { actions?: PilotAction[]; error?: string; connected?: boolean } = {};
      try { d = raw ? JSON.parse(raw) : {}; } catch { setError(t("Réponse inattendue.", "Unexpected response.")); return; }
      if (!r.ok) { setError(d.error || t("Échec de l'analyse.", "Analysis failed.")); return; }
      setActions(d.actions ?? []);
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

  const badge = (a: PilotAction) => {
    if (a.type === "pause") return { fr: "Pause", cls: "bg-canvas text-muted ring-1 ring-hair" };
    if (a.type === "activate") return { fr: "Activer", cls: "bg-success-50 text-success-700" };
    return { fr: (a.factor ?? 1) > 1 ? `Budget ×${a.factor}` : `Budget ×${a.factor}`, cls: (a.factor ?? 1) > 1 ? "bg-warning-50 text-warning-700" : "bg-canvas text-muted ring-1 ring-hair" };
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
        {actions && actions.map((a, i) => {
          const b = badge(a);
          return (
            <div key={i} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-hair p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${b.cls}`}>{b.fr}</span>
                  <span className="text-sm font-semibold text-ink">{a.campaignName}</span>
                  {a.impact === "spend" && <span className="rounded-full bg-warning-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning-700">{t("dépense", "spend")}</span>}
                </div>
                <p className="mt-1 text-xs text-muted">{a.reason}</p>
              </div>
              <button
                onClick={() => apply(a, i)}
                disabled={applying === i || !!done[i]}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${a.impact === "spend" ? "bg-warning-500 text-white" : "bg-page text-white"}`}
              >
                {applying === i && <Spinner size={12} className="text-white" />}
                {done[i] ?? (applying === i ? t("Application…", "Applying…") : t("Appliquer", "Apply"))}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
