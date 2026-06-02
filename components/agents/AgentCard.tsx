"use client";

/**
 * AgentCard — carte de présentation d'un agent IA.
 * Affiche : nom, rôle, niveau d'autonomie par défaut, état courant et connecteurs requis.
 */

import type { AgentDef, AgentId, AgentStepStatus } from "@/lib/agents/types";

// ── Couleurs d'accent par agent (texte + fond) ─────────────────────────────
const ACCENT_TEXT: Record<AgentId, string> = {
  orchestrator: "text-primary-700",
  strategist:   "text-primary-600",
  copywriter:   "text-ai-text",
  creative:     "text-ai-visual",
  media_buyer:  "text-warning-700",
  analyst:      "text-success-700",
  compliance:   "text-danger-700",
  publisher:    "text-indigo-700",
};

const ACCENT_BG: Record<AgentId, string> = {
  orchestrator: "bg-primary-50 border-primary-200",
  strategist:   "bg-primary-50 border-primary-200",
  copywriter:   "bg-ai-textbg border-blue-200",
  creative:     "bg-ai-visualbg border-violet-200",
  media_buyer:  "bg-warning-50 border-warning-200",
  analyst:      "bg-success-50 border-success-200",
  compliance:   "bg-danger-50 border-danger-200",
  publisher:    "bg-indigo-50 border-indigo-200",
};

const AUTONOMY_LABEL: Record<number, string> = {
  1: "Recommandation",
  2: "Semi-auto",
  3: "Auto",
};

const AUTONOMY_TONE: Record<number, string> = {
  1: "bg-canvas text-muted ring-1 ring-hair",
  2: "bg-ai-textbg text-ai-text ring-1 ring-ai-text/20",
  3: "bg-success-50 text-success-700 ring-1 ring-success-500/20",
};

// Icônes SVG simples par agent
const AGENT_ICON: Record<AgentId, React.ReactNode> = {
  orchestrator: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  ),
  strategist: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  ),
  copywriter: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  creative: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  ),
  media_buyer: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 5H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM7 13a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
    </svg>
  ),
  analyst: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
    </svg>
  ),
  compliance: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  publisher: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
  ),
};

// Mapping statut → badge
function StatusChip({ status }: { status: AgentStepStatus | "idle" }) {
  const map: Record<AgentStepStatus | "idle", { label: string; cls: string }> = {
    idle:      { label: "En veille",    cls: "bg-canvas text-muted ring-1 ring-hair" },
    done:      { label: "Terminé",      cls: "bg-success-50 text-success-700 ring-1 ring-success-500/20" },
    running:   { label: "En cours…",   cls: "bg-ai-textbg text-ai-text ring-1 ring-ai-text/20" },
    blocked:   { label: "Bloqué",      cls: "bg-danger-50 text-danger-700 ring-1 ring-danger-500/20" },
    simulated: { label: "Simulé",      cls: "bg-warning-50 text-warning-700 ring-1 ring-warning-500/20" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${cls}`}>
      {status === "running" && (
        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-ai-text animate-pulse" />
      )}
      {label}
    </span>
  );
}

interface AgentCardProps {
  agent: AgentDef;
  /** Statut issu de la dernière exécution (undefined = idle) */
  stepStatus?: AgentStepStatus;
  /** Si true, indique que cet agent est "actif" dans le run en cours */
  active?: boolean;
}

export function AgentCard({ agent, stepStatus, active }: AgentCardProps) {
  const accentText = ACCENT_TEXT[agent.id];
  const accentBg = ACCENT_BG[agent.id];
  const status = stepStatus ?? "idle";

  return (
    <div
      className={`card flex flex-col gap-3 p-4 transition-shadow ${
        active ? "shadow-md ring-2 ring-primary-200" : ""
      }`}
    >
      {/* En-tête agent */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Icône accentuée */}
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accentBg} ${accentText}`}
          >
            {AGENT_ICON[agent.id]}
          </div>
          <div>
            <div className={`text-sm font-semibold ${accentText}`}>{agent.name}</div>
            <div className="text-2xs text-muted">Autonomie par défaut : {AUTONOMY_LABEL[agent.defaultAutonomy]}</div>
          </div>
        </div>
        <StatusChip status={status} />
      </div>

      {/* Rôle */}
      <p className="text-xs leading-relaxed text-muted">{agent.role}</p>

      {/* Badges autonomie + connecteurs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${AUTONOMY_TONE[agent.defaultAutonomy]}`}>
          N{agent.defaultAutonomy} · {AUTONOMY_LABEL[agent.defaultAutonomy]}
        </span>
        {agent.requiredConnectors.map((c) => (
          <span
            key={c}
            className="chip text-2xs"
            title={`Connecteur requis : ${c}`}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
