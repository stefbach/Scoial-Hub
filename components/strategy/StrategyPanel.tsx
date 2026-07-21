"use client";

// Panneau « Mémoire stratégique & brief » — réutilisé par Veille et Pubs.
// Affiche le brief stratégique synthétisé par l'IA à partir de toute la mémoire
// (veille + pubs + Page), la mémoire récente, et un CTA pour lancer une campagne.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

interface Brief {
  resume: string;
  opportunites: string[];
  anglesPrioritaires: string[];
  formatsGagnants: string[];
  concurrentsCles: string[];
  recommandations: string[];
  aiGenerated: boolean;
  generatedAt: string;
}
interface MemEntry {
  id: string;
  source: string;
  kind: string;
  title?: string;
  content: string;
  createdAt?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  veille: "Veille", ads: "Pubs", page: "Ma Page", agent: "Agents", manual: "Manuel",
};

/**
 * @param refreshSignal  Optionnel : change ce nombre (ex. après une analyse
 *   veille/pubs déclenchée ailleurs) pour forcer un re-fetch du brief/mémoire.
 */
export function StrategyPanel({ companyId, refreshSignal }: { companyId: string; refreshSignal?: number }) {
  const t = useT();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [memory, setMemory] = useState<MemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [synth, setSynth] = useState(false);

  // `silent` : re-fetch en arrière-plan (focus/poll) sans flash de "Chargement…".
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`/api/memory?companyId=${encodeURIComponent(companyId)}`);
      const d = await r.json();
      setBrief(d.brief ?? null);
      setMemory(Array.isArray(d.memory) ? d.memory : []);
    } catch {
      /* ignore */
    } finally {
      if (!silent) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Le brief est régénéré en tâche de fond (fire-and-forget) par la Veille et les
  // Pubs après une analyse. Le panneau doit donc se rafraîchir sans clic manuel :
  // (1) quand on revient sur l'onglet/la page (focus + visibilité),
  // (2) via un court polling après le montage, le temps que la synthèse aboutisse.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") load(true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    // Polling court (4 × 4 s) : capte une synthèse déclenchée juste avant/à l'arrivée.
    let ticks = 0;
    const id = setInterval(() => {
      ticks += 1;
      load(true);
      if (ticks >= 4) clearInterval(id);
    }, 4000);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(id);
    };
  }, [load]);

  // Re-fetch explicite quand le parent signale une nouvelle analyse.
  useEffect(() => {
    if (refreshSignal !== undefined) load(true);
  }, [refreshSignal, load]);

  async function regenerate() {
    setSynth(true);
    try {
      const r = await fetch("/api/memory/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const d = await r.json();
      if (d.brief) setBrief(d.brief);
      await load();
    } catch {
      /* ignore */
    } finally {
      setSynth(false);
    }
  }

  const hasMemory = memory.length > 0;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair bg-canvas px-5 py-3">
        <div>
          <span className="section-label text-ai-text">{t("Mémoire stratégique", "Strategic memory")}</span>
          <p className="mt-0.5 text-2xs text-muted">
            {t("L'IA accumule et synthétise vos analyses pour piloter les campagnes.", "The AI accumulates and synthesizes your analyses to drive campaigns.")}
          </p>
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={synth}
          className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-50"
        >
          {synth ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-hair border-t-primary" />
          ) : null}
          {synth ? t("Synthèse…", "Synthesizing…") : t("Régénérer le brief", "Regenerate brief")}
        </button>
      </div>

      <div className="space-y-4 p-5">
        {loading ? (
          <p className="text-sm text-muted">{t("Chargement…", "Loading…")}</p>
        ) : !brief && !hasMemory ? (
          <div className="rounded-xl border border-dashed border-hair bg-canvas p-5 text-center">
            <p className="text-sm font-medium text-ink">{t("Mémoire vide", "Memory empty")}</p>
            <p className="mt-1 text-xs text-muted">
              {t("Lancez une analyse de veille, de pubs ou de votre Page : les insights seront conservés ici.", "Run a market-watch, ads or Page analysis: insights will be stored here.")}
            </p>
          </div>
        ) : (
          <>
            {brief?.resume && (
              // Fond clair : `bg-ai-textbg` (sans /40) est remappé en tuile lavande
              // pâle par le thème clair — la variante /40 échappait au remap et
              // retombait sur le violet sombre du thème nuit (bug #26).
              <div className="rounded-xl border-l-4 border-ai-text bg-ai-textbg p-4">
                <div className="flex items-center gap-2">
                  <span className="section-label text-ai-text">{t("Brief", "Brief")}</span>
                  {brief.aiGenerated && <span className="rounded-full bg-ai-textbg px-2 py-0.5 text-2xs font-semibold text-ai-text">IA</span>}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink">{brief.resume}</p>
              </div>
            )}

            {brief && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BriefList title={t("Opportunités", "Opportunities")} items={brief.opportunites} />
                <BriefList title={t("Angles prioritaires", "Priority angles")} items={brief.anglesPrioritaires} />
                <BriefList title={t("Formats gagnants", "Winning formats")} items={brief.formatsGagnants} />
                <BriefList title={t("Concurrents clés", "Key competitors")} items={brief.concurrentsCles} />
                <BriefList title={t("Recommandations", "Recommendations")} items={brief.recommandations} className="sm:col-span-2" />
              </div>
            )}

            {hasMemory && (
              <details className="rounded-xl border border-hair">
                <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-ink">
                  {t("Mémoire détaillée", "Detailed memory")} ({memory.length})
                </summary>
                <ul className="max-h-64 divide-y divide-hair overflow-y-auto px-4 pb-2">
                  {memory.map((m) => (
                    <li key={m.id} className="flex items-start gap-2 py-2">
                      <span className="mt-0.5 shrink-0 rounded-full bg-canvas px-2 py-0.5 text-2xs font-semibold text-muted ring-1 ring-hair">
                        {SOURCE_LABEL[m.source] ?? m.source}
                      </span>
                      <div className="min-w-0">
                        {m.title && <p className="truncate text-xs font-semibold text-ink">{m.title}</p>}
                        <p className="text-2xs text-muted">{m.content}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <Link href="/demarrage?new=1" className="btn-primary inline-flex text-sm">
              {t("Lancer une campagne à partir de ces insights", "Launch a campaign from these insights")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function BriefList({ title, items, className = "" }: { title: string; items: string[]; className?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`rounded-xl bg-canvas p-3 ${className}`}>
      <p className="section-label">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-ink">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-400" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
