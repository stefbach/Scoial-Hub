"use client";

/**
 * RunTimeline — affiche la séquence des étapes d'une orchestration IA.
 * Chaque étape est colorée selon l'agent et son statut.
 * La conformité est mise en évidence (vert/orange/rouge).
 * Le contenu final généré est présenté dans un encart dédié.
 */

import type { AgentRunResult, AgentId, AgentStepStatus } from "@/lib/agents/types";
import { AGENTS } from "@/lib/agents/roster";

// ── Couleurs d'accent par agent ────────────────────────────────────────────

const ICON_BG: Record<AgentId, string> = {
  orchestrator: "bg-primary-50 border-primary-200 text-primary-700",
  strategist:   "bg-primary-50 border-primary-100 text-primary-600",
  copywriter:   "bg-ai-textbg border-blue-200 text-ai-text",
  creative:     "bg-ai-visualbg border-violet-200 text-ai-visual",
  media_buyer:  "bg-warning-50 border-warning-200 text-warning-700",
  analyst:      "bg-success-50 border-success-200 text-success-700",
  compliance:   "bg-danger-50 border-danger-200 text-danger-700",
};

// ── Statuts ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AgentStepStatus, { dot: string; label: string; labelCls: string }> = {
  done:      { dot: "bg-success-500",  label: "Terminé",    labelCls: "text-success-700" },
  running:   { dot: "bg-ai-text animate-pulse", label: "En cours", labelCls: "text-ai-text" },
  blocked:   { dot: "bg-danger-500",   label: "Bloqué",     labelCls: "text-danger-700" },
  simulated: { dot: "bg-warning-500",  label: "Simulé",     labelCls: "text-warning-700" },
};

// ── Verdict conformité ─────────────────────────────────────────────────────

function ComplianceBanner({
  verdict,
}: {
  verdict: "pass" | "warn" | "block";
}) {
  const config = {
    pass: {
      bg: "bg-success-50 border-success-200",
      icon: "✅",
      title: "Contenu conforme",
      text: "Le contenu a passé tous les contrôles ANSM et Meta. Il peut être publié.",
      titleCls: "text-success-700",
    },
    warn: {
      bg: "bg-warning-50 border-warning-200",
      icon: "⚠️",
      title: "Avertissements de conformité",
      text: "Des points d'attention ont été identifiés. Une révision manuelle est recommandée avant publication.",
      titleCls: "text-warning-700",
    },
    block: {
      bg: "bg-danger-50 border-danger-200",
      icon: "🚫",
      title: "Contenu bloqué — Non conforme",
      text: "Le contenu a été bloqué pour non-conformité réglementaire (ANSM / Meta). Aucune publication ni campagne ne sera créée.",
      titleCls: "text-danger-700",
    },
  }[verdict];

  return (
    <div className={`rounded-lg border p-3 ${config.bg}`}>
      <div className={`flex items-center gap-2 font-semibold text-sm ${config.titleCls}`}>
        <span>{config.icon}</span>
        {config.title}
      </div>
      <p className="mt-1 text-xs text-muted">{config.text}</p>
    </div>
  );
}

// ── Icônes SVG par agent ───────────────────────────────────────────────────

const AGENT_ICON: Record<AgentId, React.ReactNode> = {
  orchestrator: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  ),
  strategist: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  ),
  copywriter: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  creative: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  ),
  media_buyer: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 5H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM7 13a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
    </svg>
  ),
  analyst: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
    </svg>
  ),
  compliance: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
};

// ── Composant principal ────────────────────────────────────────────────────

interface RunTimelineProps {
  result: AgentRunResult;
}

export function RunTimeline({ result }: RunTimelineProps) {
  const autonomyLabel =
    result.autonomy === 1
      ? "Recommandation pure"
      : result.autonomy === 2
      ? "Semi-automatique"
      : "Automatique (garde-fous)";

  return (
    <div className="animate-fade-in space-y-4">
      {/* En-tête du run */}
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="section-label mb-1">Objectif piloté</div>
            <p className="text-sm font-medium text-ink">&ldquo;{result.objective}&rdquo;</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {result.mock && (
              <span className="inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-2xs font-semibold text-muted ring-1 ring-hair">
                Mode mock
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-ai-textbg px-2 py-0.5 text-2xs font-semibold text-ai-text ring-1 ring-ai-text/20">
              Autonomie N{result.autonomy} · {autonomyLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Verdict conformité (mis en évidence) */}
      {result.complianceVerdict && (
        <ComplianceBanner verdict={result.complianceVerdict} />
      )}

      {/* Timeline des étapes */}
      <div className="card divide-y divide-hair overflow-hidden">
        <div className="px-4 py-3">
          <span className="section-label">Séquence d'exécution</span>
          <span className="ml-2 text-2xs text-muted">({result.steps.length} étapes)</span>
        </div>
        {result.steps.map((step, idx) => {
          const agentDef = AGENTS.find((a) => a.id === step.agent);
          const statusConf = STATUS_STYLES[step.status];
          const iconBg = ICON_BG[step.agent];

          return (
            <div key={idx} className="group px-4 py-3 hover:bg-canvas/50">
              <div className="flex items-start gap-3">
                {/* Numéro + icône agent */}
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs ${iconBg}`}
                    title={agentDef?.name}
                  >
                    {AGENT_ICON[step.agent]}
                  </div>
                  {idx < result.steps.length - 1 && (
                    <div className="h-full w-px bg-hair" />
                  )}
                </div>

                {/* Contenu de l'étape */}
                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {/* Nom de l'agent */}
                    <span className="text-2xs font-semibold uppercase text-muted tracking-wide">
                      {agentDef?.name ?? step.agent}
                    </span>
                    {/* Titre de l'étape */}
                    <span className="text-sm font-medium text-ink">{step.title}</span>
                    {/* Badge statut */}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ${
                      step.status === "done"      ? "bg-success-50 text-success-700 ring-1 ring-success-500/20"
                      : step.status === "running"  ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/20"
                      : step.status === "blocked"  ? "bg-danger-50 text-danger-700 ring-1 ring-danger-500/20"
                      : /* simulated */              "bg-warning-50 text-warning-700 ring-1 ring-warning-500/20"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusConf.dot}`} />
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Sortie de l'étape */}
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-md bg-canvas px-3 py-2 text-xs text-ink leading-relaxed border border-hair">
                    {step.output}
                  </pre>

                  {/* Détail optionnel (connecteur requis, raison de blocage…) */}
                  {step.detail && (
                    <p className="mt-1.5 text-2xs text-muted italic border-l-2 border-hair pl-2">
                      {step.detail}
                    </p>
                  )}

                  {/* Horodatage */}
                  {step.finishedAt && (
                    <p className="mt-1 text-2xs text-muted/60">
                      {new Date(step.finishedAt).toLocaleTimeString("fr-FR")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Contenu final généré */}
      {result.finalOutput ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-hair px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ai-textbg">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-ai-text">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-ink">Contenu final généré</span>
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${
              result.autonomy === 1
                ? "bg-canvas text-muted ring-1 ring-hair"
                : result.autonomy === 2
                ? "bg-warning-50 text-warning-700 ring-1 ring-warning-500/20"
                : "bg-success-50 text-success-700 ring-1 ring-success-500/20"
            }`}>
              {result.autonomy === 1
                ? "Recommandation non publiée"
                : result.autonomy === 2
                ? "En attente de validation"
                : "Prêt à publier"}
            </span>
          </div>
          <div className="p-4">
            <pre className="whitespace-pre-wrap rounded-lg border border-hair bg-canvas p-4 text-sm text-ink leading-relaxed">
              {result.finalOutput}
            </pre>
            <div className="mt-3 text-2xs text-muted">
              {result.autonomy === 1 &&
                "Autonomie N1 — Aucune publication ni campagne initiée. Copiez ce contenu pour le publier manuellement."}
              {result.autonomy === 2 &&
                "Autonomie N2 — Validez ce contenu puis activez la campagne manuellement dans Meta Business Manager."}
              {result.autonomy === 3 &&
                "Autonomie N3 — Contenu conforme et budget validé. Connectez Meta Ads API pour activer la publication automatique."}
            </div>
          </div>
        </div>
      ) : (
        result.complianceVerdict === "block" && (
          <div className="card border-danger-200 bg-danger-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-danger-700">
              <span>🚫</span>
              <span>Publication bloquée</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Le contenu n'a pas passé la vérification de conformité. Aucune publication ni campagne n'a été générée.
              Révisez l'objectif ou le contenu et relancez un pilotage.
            </p>
          </div>
        )
      )}
    </div>
  );
}
