"use client";

// « Pilote Contenu » : équivalent organique du Pilote Pub. Lit les
// indicateurs organiques réels + les posts programmés, et propose des
// actions concrètes : reprogrammer un post sur son créneau prouvé (appliqué
// en un clic), ou ouvrir Composer face à une alerte (silence, engagement
// faible). Aucune action n'engage de dépense — pas de confirmation requise.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { useLang, useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

interface PilotContentAction {
  type: "reschedule" | "compose";
  postId?: string;
  postTitle?: string;
  platform?: string;
  currentTime?: string;
  newTime?: string;
  reason: string;
  impact: "safe";
}

export function ContentPilot() {
  const t = useT();
  const { lang } = useLang();
  const { company } = useCompany();
  const router = useRouter();
  const companyId = company.id;

  const [actions, setActions] = useState<PilotContentAction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});

  async function analyze() {
    setLoading(true); setError(null); setActions(null); setDone({});
    try {
      const r = await fetch(`/api/content/pilot?companyId=${encodeURIComponent(companyId)}&language=${lang}`);
      const raw = await r.text();
      let d: { actions?: PilotContentAction[]; error?: string } = {};
      try { d = raw ? JSON.parse(raw) : {}; } catch { setError(t("Réponse inattendue.", "Unexpected response.")); return; }
      if (!r.ok) { setError(d.error || t("Échec de l'analyse.", "Analysis failed.")); return; }
      setActions(d.actions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de l'analyse.", "Analysis failed."));
    } finally { setLoading(false); }
  }

  async function apply(a: PilotContentAction, i: number) {
    if (a.type === "compose") {
      router.push("/compose");
      setDone((prev) => ({ ...prev, [i]: t("Ouvert ✓", "Opened ✓") }));
      return;
    }
    setApplying(i); setError(null);
    try {
      const r = await fetch("/api/content/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: { type: "reschedule", postId: a.postId, newTime: a.newTime } }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || t("Échec de l'application.", "Apply failed.")); return; }
      setDone((prev) => ({ ...prev, [i]: t("Appliqué ✓", "Applied ✓") }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de l'application.", "Apply failed."));
    } finally { setApplying(null); }
  }

  const badge = (a: PilotContentAction) =>
    a.type === "reschedule" ? t(`Reprogrammer → ${a.newTime}`, `Reschedule → ${a.newTime}`) : t("Composer", "Compose");

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair bg-canvas px-5 py-3">
        <div className="min-w-0">
          <span className="section-label text-ai-text">{t("Pilote Contenu — optimisation automatique", "Content Pilot — auto-optimization")}</span>
          <p className="mt-0.5 text-2xs text-muted">{t("Lit vos indicateurs organiques réels et propose des actions à appliquer — jamais de dépense.", "Reads your real organic indicators and proposes actions to apply — never any spend.")}</p>
        </div>
        <button onClick={analyze} disabled={loading} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
          {loading && <Spinner size={14} className="text-white" />}
          {loading ? t("Analyse…", "Analyzing…") : actions ? t("Ré-analyser", "Re-analyze") : t("Proposer des actions", "Propose actions")}
        </button>
      </div>

      <div className="space-y-3 p-5">
        {loading && <BusyHint label={t("Analyse des indicateurs et des posts programmés…", "Analyzing indicators and scheduled posts…")} eta={t("~5–15 s", "~5–15 s")} />}
        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
        {actions && actions.length === 0 && !loading && (
          <p className="text-sm text-muted">
            {t("Aucune action proposée (comptes sains, ou pas assez de données).", "No action proposed (healthy accounts, or not enough data).")}
          </p>
        )}

        {actions && actions.map((a, i) => (
          <div key={i} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-hair p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700">{badge(a)}</span>
                {a.postTitle && <span className="text-sm font-semibold text-ink">{a.postTitle}</span>}
              </div>
              <p className="mt-1 text-xs text-muted">{a.reason}</p>
            </div>
            <button
              onClick={() => apply(a, i)}
              disabled={applying === i || !!done[i]}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary-400 px-3 py-1.5 text-xs font-semibold text-[#1c152e] ring-1 ring-primary-300/50 disabled:opacity-50"
            >
              {applying === i && <Spinner size={12} className="text-[#1c152e]" />}
              {done[i] ?? (applying === i ? t("Application…", "Applying…") : t("Appliquer", "Apply"))}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
