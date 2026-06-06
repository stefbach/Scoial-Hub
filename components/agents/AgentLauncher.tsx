"use client";

// Lanceur d'agent réutilisable : un bouton (+ panneau) qui lance le cycle
// multi-agents (/api/agents/run) depuis N'IMPORTE QUELLE page (campagnes,
// compose, performance, studios…). Affiche un récap et un lien vers /agents.

import { useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

export function AgentLauncher({
  defaultObjective = "",
  context,
  label,
  compact = false,
}: {
  /** Objectif pré-rempli (selon la page d'où on lance). */
  defaultObjective?: string;
  /** Contexte court ajouté à l'objectif (ex. "depuis la page Campagnes"). */
  context?: string;
  label?: string;
  compact?: boolean;
}) {
  const t = useT();
  const { company } = useCompany();
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState(defaultObjective);
  const [autonomy, setAutonomy] = useState<1 | 2 | 3>(1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!objective.trim()) { setError(t("Décrivez l'objectif.", "Describe the objective.")); return; }
    setError(null); setRunning(true); setResult(null);
    try {
      const r = await fetch("/api/agents/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          objective: context ? `${objective} (${context})` : objective,
          brandVoice: company.brandVoice ?? "",
          autonomy,
        }),
      });
      const raw = await r.text();
      let d: { finalOutput?: string; error?: string } = {};
      try { d = raw ? JSON.parse(raw) : {}; } catch {
        setError(r.status === 504 ? t("Le cycle a dépassé le temps imparti. Réessayez.", "Cycle timed out. Try again.") : t(`Réponse inattendue (${r.status}).`, `Unexpected response (${r.status}).`));
        return;
      }
      if (!r.ok) { setError(d.error || t("Échec du cycle.", "Cycle failed.")); return; }
      setResult(String(d.finalOutput ?? t("Cycle terminé.", "Cycle complete.")).slice(0, 600));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec du cycle.", "Cycle failed."));
    } finally { setRunning(false); }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={compact ? "inline-flex items-center gap-1.5 text-sm font-medium text-ai-text hover:underline" : "btn-secondary inline-flex items-center gap-1.5 text-sm"}>
        {label ?? t("🤖 Lancer un agent", "🤖 Run an agent")}
      </button>
    );
  }

  return (
    <div className="rounded-xl border-l-4 border-ai-text bg-ai-textbg/30 p-4">
      <div className="flex items-center justify-between">
        <span className="section-label text-ai-text">{t("Agent IA", "AI agent")}</span>
        <button onClick={() => setOpen(false)} className="text-2xs text-muted hover:text-ink">{t("Fermer", "Close")}</button>
      </div>
      <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2}
        placeholder={t("Objectif (ex : générer 5 posts + une campagne prospects)…", "Objective (e.g. generate 5 posts + a leads campaign)…")}
        className="mt-2 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-hair bg-canvas p-0.5">
          {([1, 2, 3] as const).map((a) => (
            <button key={a} onClick={() => setAutonomy(a)}
              className={`rounded-md px-2.5 py-1 text-2xs font-semibold ${autonomy === a ? "bg-primary-600 text-white" : "text-muted hover:text-ink"}`}
              title={a === 1 ? t("Recommandation", "Recommendation") : a === 2 ? t("Semi-auto (validation)", "Semi-auto (review)") : t("Auto (si conforme)", "Auto (if compliant)")}>
              {t("Niveau", "Level")} {a}
            </button>
          ))}
        </div>
        <button onClick={run} disabled={running} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
          {running && <Spinner size={14} className="text-white" />}
          {running ? t("Cycle en cours…", "Running…") : t("Lancer", "Run")}
        </button>
        <Link href="/agents" className="text-2xs text-primary-600 hover:underline">{t("Voir tous les agents →", "All agents →")}</Link>
      </div>
      {running && <BusyHint className="mt-2" label={t("Les agents travaillent (stratégie, texte, conformité…)", "Agents working (strategy, copy, compliance…)")} eta={t("~20–60 s", "~20–60 s")} />}
      {error && <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
      {result && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-xs text-ink ring-1 ring-hair">{result}</p>}
    </div>
  );
}
