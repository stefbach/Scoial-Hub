"use client";

/**
 * Page "Centre de pilotage IA" — /agents
 *
 * Affiche :
 *  - En-tête avec sélecteur de marque
 *  - Grille des 8 agents (statut temps réel)
 *  - Panneau de lancement (objectif + autonomie)
 *  - Timeline d'exécution (résultat du run)
 */

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { AGENTS } from "@/lib/agents/roster";
import { AgentCard } from "@/components/agents/AgentCard";
import { RunPanel } from "@/components/agents/RunPanel";
import { RunTimeline } from "@/components/agents/RunTimeline";
import type { AgentId, AgentRunResult, AgentStepStatus } from "@/lib/agents/types";
import type { RunPayload } from "@/components/agents/RunPanel";
import { useT } from "@/lib/i18n";

// ── Sélecteur de marque interne (réutilise useCompany) ───────────────────────

function BrandSelector() {
  const { companies, company, setCompanyId } = useCompany();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full max-w-full items-center gap-2 rounded-lg border border-hair bg-card px-3 py-1.5 text-sm shadow-xs hover:bg-canvas"
      >
        {/* Pastille couleur de la marque */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: company.accent }}
        />
        <span className="min-w-0 truncate font-medium text-ink">{company.name}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0 text-muted">
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-hair bg-card shadow-lg overflow-hidden">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCompanyId(c.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-canvas ${
                  c.id === company.id ? "bg-primary-50 text-primary-700 font-medium" : "text-ink"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: c.accent }}
                />
                <span className="min-w-0 truncate">{c.name}</span>
                {c.id === company.id && (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="ml-auto h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Calcul du statut des agents à partir d'un résultat ────────────────────────

function getAgentStatuses(result: AgentRunResult | null): Map<AgentId, AgentStepStatus> {
  const map = new Map<AgentId, AgentStepStatus>();
  if (!result) return map;
  for (const step of result.steps) {
    // On prend le dernier statut si un agent apparaît plusieurs fois
    map.set(step.agent, step.status);
  }
  return map;
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const t = useT();
  const { company } = useCompany();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agentStatuses = getAgentStatuses(result);

  async function handleRun(payload: RunPayload) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: payload.objective,
          companyId: company.id,
          brandVoice: company.brandVoice,
          autonomy: payload.autonomy,
          profileId: payload.profileId,
          cadence: payload.cadence,
          benchmarkTarget: payload.benchmarkTarget,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ??
            t(`Erreur serveur (${res.status})`, `Server error (${res.status})`)
        );
      }

      const data: AgentRunResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Une erreur inattendue s'est produite.", "An unexpected error occurred.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-ink">{t("Centre de pilotage IA", "AI Control Center")}</h1>
          <p className="text-xs text-muted">
            {t(
              "Système multi-agent pour piloter les campagnes sociales DDS Group de bout en bout.",
              "Multi-agent system to manage DDS Group social campaigns end-to-end."
            )}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
          <span className="shrink-0 text-xs text-muted">{t("Marque active :", "Active brand:")}</span>
          <div className="min-w-0 flex-1 sm:w-56 sm:flex-initial">
            <BrandSelector />
          </div>
        </div>
      </div>

      {/* ── Grille des 8 agents ──────────────────────────────────────── */}
      <div>
        <div className="section-label mb-2">{t("Agents disponibles", "Available agents")}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {AGENTS.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              stepStatus={agentStatuses.get(agent.id)}
              active={
                loading
                  ? !agentStatuses.has(agent.id) // agents pas encore traités = en attente
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* ── Panneau de lancement ─────────────────────────────────────── */}
      <RunPanel loading={loading} onRun={(payload) => handleRun(payload)} />

      {/* ── État de chargement ───────────────────────────────────────── */}
      {loading && (
        <div className="card animate-pulse p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-50">
            <svg
              className="h-5 w-5 animate-spin text-primary-600"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink">{t("Orchestration en cours…", "Orchestration in progress…")}</p>
          <p className="mt-1 text-xs text-muted">
            {t(
              "Les 8 agents travaillent en séquence. Cette opération peut prendre quelques secondes.",
              "All 8 agents are working in sequence. This may take a few seconds."
            )}
          </p>
        </div>
      )}

      {/* ── Erreur ───────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-danger-700">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            {t("Erreur d'orchestration", "Orchestration error")}
          </div>
          <p className="mt-1 text-xs text-muted">{error}</p>
        </div>
      )}

      {/* ── Timeline d'exécution ─────────────────────────────────────── */}
      {result && !loading && <RunTimeline result={result} companyId={company.id} />}

      {/* ── État vide initial ────────────────────────────────────────── */}
      {!result && !loading && !error && (
        <div className="panel p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-primary-600">
              <path
                fillRule="evenodd"
                d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-ink">{t("Prêt à piloter", "Ready to run")}</h3>
          <p className="mt-1 max-w-sm mx-auto text-xs text-muted">
            {t(
              "Décrivez votre objectif de campagne, choisissez un niveau d'autonomie et lancez le pilotage pour voir les 8 agents IA travailler en séquence.",
              "Describe your campaign objective, choose an autonomy level, and start the run to see all 8 AI agents work in sequence."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
