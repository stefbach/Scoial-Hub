"use client";

// ── Étape 5 : Lancer les agents IA ────────────────────────────────────────────
// Récapitulatif de ce que les agents vont utiliser, lancement de l'orchestration
// POST /api/agents/run, affichage riche du résultat par étapes (cards agents),
// contenu final, briefs créatifs. Transition vers l'étape 6 (Diffusion).

import { useState } from "react";
import { useOnboardingCtx } from "@/components/onboarding/context";
import { useT } from "@/lib/i18n";
import type { AgentRunResult } from "@/lib/agents/types";

// ── Icônes SVG inline ────────────────────────────────────────────────────────

/** Robot / CPU — CTA principal */
function RobotIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M9 9V7a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1.2" fill="currentColor" />
      <circle cx="15" cy="14" r="1.2" fill="currentColor" />
      <path d="M9 17h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 9v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Spinner de chargement */
function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Chevron pour show-more */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Flèche vers la droite — bouton suivant */
function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Icône "image" — brief créatif */
function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  );
}

/** Icône "vidéo" — brief créatif */
function VideoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553.106A1 1 0 0014 7v6a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" />
    </svg>
  );
}

// ── Couleurs / icônes par agent (cohérent avec RunTimeline) ────────────────────

const AGENT_META: Record<string, { labelFr: string; labelEn: string; bg: string; dot: string }> = {
  orchestrator: { labelFr: "Orchestrateur",  labelEn: "Orchestrator",  bg: "bg-primary-50 border-primary-200 text-primary-700",  dot: "bg-primary-500" },
  strategist:   { labelFr: "Stratège",        labelEn: "Strategist",    bg: "bg-primary-50 border-primary-100 text-primary-600",  dot: "bg-primary-400" },
  copywriter:   { labelFr: "Copywriter",      labelEn: "Copywriter",    bg: "bg-ai-textbg border-blue-200 text-ai-text",          dot: "bg-ai-text" },
  creative:     { labelFr: "Créatif",         labelEn: "Creative",      bg: "bg-ai-visualbg border-violet-200 text-ai-visual",    dot: "bg-violet-500" },
  media_buyer:  { labelFr: "Média",           labelEn: "Media",         bg: "bg-warning-50 border-warning-200 text-warning-700",  dot: "bg-warning-500" },
  analyst:      { labelFr: "Analyste",        labelEn: "Analyst",       bg: "bg-success-50 border-success-200 text-success-700",  dot: "bg-success-500" },
  compliance:   { labelFr: "Conformité",      labelEn: "Compliance",    bg: "bg-danger-50 border-danger-200 text-danger-700",     dot: "bg-danger-500" },
  publisher:    { labelFr: "Diffuseur",       labelEn: "Publisher",     bg: "bg-indigo-50 border-indigo-200 text-indigo-700",     dot: "bg-indigo-500" },
};

// Agents affichés pendant le chargement (dans l'ordre)
const LOADING_AGENTS = [
  "orchestrator",
  "strategist",
  "copywriter",
  "creative",
  "compliance",
  "media_buyer",
  "analyst",
  "publisher",
] as const;

// ── Couleurs de plateforme ─────────────────────────────────────────────────────

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "text-platform-instagram",
  facebook:  "text-platform-facebook",
  linkedin:  "text-platform-linkedin",
  tiktok:    "text-ink",
};

// ── Récapitulatif de la configuration en bande ────────────────────────────────

function RecapStrip() {
  const t = useT();
  const { state, profile, companyName } = useOnboardingCtx();

  // Résolution des labels d'objectifs depuis le profil ou fallback sur l'id
  const objectiveLabels = state.objectives.map((id) => {
    const found = profile.suggestedObjectives?.find((o) => o.id === id);
    return found ? found.label : id;
  });

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-hair bg-canvas px-5 py-3">
        <span className="section-label">{t("Ce que les agents vont utiliser", "What the agents will use")}</span>
      </div>
      <div className="divide-y divide-hair">

        {/* Marque */}
        <div className="flex items-start gap-3 px-5 py-3">
          <span className="w-28 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted pt-0.5">
            {t("Marque", "Brand")}
          </span>
          <span className="text-sm font-medium text-ink">{companyName}</span>
        </div>

        {/* Objectifs */}
        {objectiveLabels.length > 0 && (
          <div className="flex items-start gap-3 px-5 py-3">
            <span className="w-28 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted pt-0.5">
              {t("Objectifs", "Objectives")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {objectiveLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-200"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Réseaux */}
        {state.networks.length > 0 && (
          <div className="flex items-start gap-3 px-5 py-3">
            <span className="w-28 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted pt-0.5">
              {t("Réseaux", "Networks")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {state.networks.map((n) => (
                <span
                  key={n}
                  className={`inline-flex items-center rounded-full bg-canvas px-2.5 py-0.5 text-2xs font-semibold ring-1 ring-hair capitalize ${PLATFORM_COLOR[n] ?? "text-ink"}`}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Zone géographique */}
        {state.geo.countries.length > 0 && (
          <div className="flex items-start gap-3 px-5 py-3">
            <span className="w-28 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted pt-0.5">
              {t("Zone", "Zone")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {state.geo.countries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center rounded-full bg-canvas px-2.5 py-0.5 text-2xs font-semibold text-ink ring-1 ring-hair"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Nombre de campagnes */}
        <div className="flex items-start gap-3 px-5 py-3">
          <span className="w-28 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted pt-0.5">
            {t("Campagnes", "Campaigns")}
          </span>
          <span className="text-sm font-medium text-ink">
            {state.campaignCount} {state.campaignCount > 1 ? t("campagnes", "campaigns") : t("campagne", "campaign")}
          </span>
        </div>

      </div>
    </div>
  );
}

// ── État de chargement riche ──────────────────────────────────────────────────

function LoadingAgents() {
  const t = useT();

  return (
    <div className="card space-y-5 p-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ai-textbg">
          <Spinner className="h-5 w-5 text-ai-text" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">
            {t("Les agents travaillent…", "Agents are working…")}
          </p>
          <p className="text-xs text-muted">
            {t("Orchestration en cours — environ 45 secondes", "Orchestration in progress — about 45 seconds")}
          </p>
        </div>
      </div>

      {/* Grille d'agents en cours */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LOADING_AGENTS.map((agentId, i) => {
          const meta = AGENT_META[agentId];
          return (
            <div
              key={agentId}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${meta.bg}`}
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {/* Dot pulsant */}
              <span className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${meta.dot}`} />
              <span className="text-2xs font-semibold truncate">
                {t(meta.labelFr, meta.labelEn)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Barre de progression simulée */}
      <div className="space-y-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
          <div
            className="h-full animate-pulse rounded-full bg-gradient-to-r from-primary-400 to-ai-text"
            style={{ width: "60%" }}
          />
        </div>
        <p className="text-2xs text-muted">
          {t(
            "Stratégie → Copywriting → Créatifs → Conformité → Média → Analyse…",
            "Strategy → Copywriting → Creatives → Compliance → Media → Analysis…"
          )}
        </p>
      </div>
    </div>
  );
}

// ── Card de résultat d'une étape agent ────────────────────────────────────────

function StepCard({ step, isLast }: { step: AgentRunResult["steps"][number]; isLast: boolean }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const meta = AGENT_META[step.agent] ?? {
    labelFr: step.agent,
    labelEn: step.agent,
    bg: "bg-canvas border-hair text-muted",
    dot: "bg-muted",
  };

  // Tronquer les sorties longues (> 300 chars)
  const OUTPUT_LIMIT = 300;
  const rawOutput = step.output ?? step.detail ?? "";
  const needsTruncate = rawOutput.length > OUTPUT_LIMIT;
  const displayOutput = needsTruncate && !expanded
    ? rawOutput.slice(0, OUTPUT_LIMIT) + "…"
    : rawOutput;

  const statusConfig = {
    done:      { labelFr: "Terminé",   labelEn: "Done",      cls: "bg-success-50 text-success-700 ring-success-500/20" },
    running:   { labelFr: "En cours",  labelEn: "Running",   cls: "bg-ai-textbg text-ai-text ring-ai-text/20" },
    blocked:   { labelFr: "Bloqué",    labelEn: "Blocked",   cls: "bg-danger-50 text-danger-700 ring-danger-500/20" },
    simulated: { labelFr: "Simulé",    labelEn: "Simulated", cls: "bg-warning-50 text-warning-700 ring-warning-500/20" },
  }[step.status] ?? { labelFr: step.status, labelEn: step.status, cls: "bg-canvas text-muted ring-hair" };

  return (
    <div className="group px-4 py-3 hover:bg-canvas/50">
      <div className="flex items-start gap-3">
        {/* Indicateur de ligne verticale */}
        <div className="flex shrink-0 flex-col items-center">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold ${meta.bg}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          </span>
          {!isLast && <span className="mt-1 h-full min-h-[1.5rem] w-px bg-hair" />}
        </div>

        {/* Contenu */}
        <div className="min-w-0 flex-1 pb-1">
          {/* En-tête : nom agent + titre + statut */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-2xs font-semibold ${meta.bg}`}>
              {t(meta.labelFr, meta.labelEn)}
            </span>
            {step.title && (
              <span className="text-sm font-medium text-ink">{step.title}</span>
            )}
            <span className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ${statusConfig.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {t(statusConfig.labelFr, statusConfig.labelEn)}
            </span>
          </div>

          {/* Sortie de l'étape */}
          {displayOutput && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-hair bg-canvas px-3 py-2 text-xs leading-relaxed text-ink">
              {displayOutput}
            </pre>
          )}

          {/* Bouton show-more */}
          {needsTruncate && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1 text-2xs font-medium text-primary-600 hover:text-primary-700"
              aria-expanded={expanded}
            >
              {expanded ? t("Réduire", "Collapse") : t("Voir plus", "Show more")}
              <ChevronIcon open={expanded} />
            </button>
          )}

          {/* Détail optionnel */}
          {step.detail && (
            <p className="mt-1.5 border-l-2 border-hair pl-2 text-2xs italic text-muted">
              {step.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Résultat final mis en avant ───────────────────────────────────────────────

function FinalOutputCard({ finalOutput }: { finalOutput: string }) {
  const t = useT();
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-hair px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai-textbg">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-ai-text" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-ink">{t("Contenu final généré", "Final generated content")}</span>
        <span className="ml-auto rounded-full bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700 ring-1 ring-success-500/20">
          {t("Prêt", "Ready")}
        </span>
      </div>
      <div className="p-4">
        <pre className="whitespace-pre-wrap rounded-xl border border-hair bg-canvas px-4 py-3 text-sm leading-relaxed text-ink">
          {finalOutput}
        </pre>
      </div>
    </div>
  );
}

// ── Brief créatif (imagePrompt / videoPrompt) ─────────────────────────────────

function CreativeBriefCard({ imagePrompt, videoPrompt }: { imagePrompt?: string; videoPrompt?: string }) {
  const t = useT();
  if (!imagePrompt && !videoPrompt) return null;
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-hair px-4 py-3">
        <span className="section-label">{t("Briefs créatifs générés", "Generated creative briefs")}</span>
      </div>
      <div className="divide-y divide-hair">
        {imagePrompt && (
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-visualbg text-ai-visual">
              <ImageIcon />
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted mb-1">
                {t("Prompt image", "Image prompt")}
              </p>
              <p className="text-sm leading-relaxed text-ink">{imagePrompt}</p>
            </div>
          </div>
        )}
        {videoPrompt && (
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
              <VideoIcon />
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted mb-1">
                {t("Prompt vidéo", "Video prompt")}
              </p>
              <p className="text-sm leading-relaxed text-ink">{videoPrompt}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function Step5Agents() {
  const t = useT();
  const { state, profile, companyId, companyName, next } = useOnboardingCtx();

  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState<AgentRunResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // ── Construction de l'objectif textuel envoyé aux agents ──────────────────
  function buildObjective(): string {
    const objectiveLabels = state.objectives.map((id) => {
      const found = profile.suggestedObjectives?.find((o) => o.id === id);
      return found ? found.label : id;
    });

    const parts: string[] = [];
    parts.push(
      `Construis ${state.campaignCount} campagne(s) social media pour ${companyName}.`
    );
    if (objectiveLabels.length > 0) {
      parts.push(`Objectifs: ${objectiveLabels.join(", ")}.`);
    }
    if (state.networks.length > 0) {
      parts.push(`Réseaux: ${state.networks.join(", ")}.`);
    }
    if (state.geo.countries.length > 0) {
      parts.push(`Zone: ${state.geo.countries.join(", ")}.`);
    }
    if (profile.positioning) {
      parts.push(`Positionnement: ${profile.positioning}.`);
    }
    if (profile.tone) {
      parts.push(`Ton: ${profile.tone}.`);
    }
    if (profile.audience) {
      parts.push(`Audience: ${profile.audience}.`);
    }
    if (profile.competitorAngles && profile.competitorAngles.length > 0) {
      parts.push(`Angles: ${profile.competitorAngles.join(", ")}.`);
    }
    return parts.join(" ");
  }

  // ── Lancement de l'orchestration ─────────────────────────────────────────
  async function handleRun() {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const objective = buildObjective();
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          companyId,
          brandVoice: profile.tone || companyName,
          autonomy: 2,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? t(`Erreur serveur (${res.status})`, `Server error (${res.status})`));
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
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Récapitulatif bande de configuration ── */}
      <RecapStrip />

      {/* ── CTA principal — lancer les agents ── */}
      {!result && !running && (
        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ai-textbg text-ai-text">
              <RobotIcon />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                {state.campaignCount > 1
                  ? t(`Construire mes ${state.campaignCount} campagnes avec les agents IA`, `Build my ${state.campaignCount} campaigns with AI agents`)
                  : t("Construire ma campagne avec les agents IA", "Build my campaign with AI agents")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {t(
                  "8 agents spécialisés vont travailler en séquence : stratégie, copywriting, créatifs, conformité, ciblage média et analyse. Durée estimée : 40–55 s.",
                  "8 specialist agents will work in sequence: strategy, copywriting, creatives, compliance, media targeting and analysis. Estimated time: 40–55 s."
                )}
              </p>
              <button
                type="button"
                onClick={handleRun}
                className="btn-primary mt-4 inline-flex items-center gap-2"
                aria-label={t("Lancer les agents IA", "Launch AI agents")}
              >
                <RobotIcon />
                {state.campaignCount > 1
                  ? t(`Construire mes ${state.campaignCount} campagnes avec les agents IA`, `Build my ${state.campaignCount} campaigns with AI agents`)
                  : t("Construire ma campagne avec les agents IA", "Build my campaign with AI agents")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── État de chargement riche ── */}
      {running && <LoadingAgents />}

      {/* ── Erreur ── */}
      {error && !running && (
        <div
          className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3"
          role="alert"
          aria-live="polite"
        >
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-danger-700">
              {t("Erreur d'orchestration", "Orchestration error")}
            </p>
            <p className="mt-0.5 text-xs text-danger-600">{error}</p>
            <button
              type="button"
              onClick={handleRun}
              className="btn-secondary mt-2 text-xs"
            >
              {t("Réessayer", "Retry")}
            </button>
          </div>
        </div>
      )}

      {/* ── Résultats de l'orchestration ── */}
      {result && !running && (
        <div className="space-y-4 animate-fade-in">

          {/* Note mode démo */}
          {result.mock && (
            <div className="flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 px-4 py-2.5">
              <svg className="h-4 w-4 shrink-0 text-warning-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zm1.515.5l-6.28 10.875h12.56L10 2.995z" clipRule="evenodd" />
                <path d="M10 8.25a.75.75 0 01.75.75v2a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 5a.75.75 0 100 1.5.75.75 0 000-1.5z" />
              </svg>
              <p className="text-xs font-medium text-warning-700">
                {t("Mode démo — les agents ont simulé l'orchestration.", "Demo mode — agents simulated the orchestration.")}
              </p>
            </div>
          )}

          {/* Verdict conformité */}
          {result.complianceVerdict && (
            <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
              result.complianceVerdict === "pass"  ? "border-success-200 bg-success-50" :
              result.complianceVerdict === "warn"  ? "border-warning-200 bg-warning-50" :
              "border-danger-200 bg-danger-50"
            }`}>
              <span className="text-base" aria-hidden="true">
                {result.complianceVerdict === "pass" ? "✅" : result.complianceVerdict === "warn" ? "⚠️" : "🚫"}
              </span>
              <div>
                <p className={`text-sm font-semibold ${
                  result.complianceVerdict === "pass" ? "text-success-700" :
                  result.complianceVerdict === "warn" ? "text-warning-700" : "text-danger-700"
                }`}>
                  {result.complianceVerdict === "pass"
                    ? t("Contenu conforme", "Content compliant")
                    : result.complianceVerdict === "warn"
                    ? t("Avertissements de conformité", "Compliance warnings")
                    : t("Contenu bloqué — Non conforme", "Content blocked — Non-compliant")}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {result.complianceVerdict === "pass"
                    ? t("Le contenu a passé tous les contrôles. Il peut être publié.", "Content passed all checks. It is ready to publish.")
                    : result.complianceVerdict === "warn"
                    ? t("Des points d'attention ont été identifiés. Une révision est recommandée.", "Some issues were flagged. Review is recommended.")
                    : t("Le contenu a été bloqué pour non-conformité. Révisez l'objectif.", "Content was blocked due to non-compliance. Revise the objective.")}
                </p>
              </div>
            </div>
          )}

          {/* Timeline des étapes agents */}
          {result.steps.length > 0 && (
            <div className="card divide-y divide-hair overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="section-label">{t("Séquence d'exécution", "Execution sequence")}</span>
                <span className="ml-1 text-2xs text-muted">
                  ({result.steps.length} {t("étapes", "steps")})
                </span>
              </div>
              {result.steps.map((step, idx) => (
                <StepCard
                  key={idx}
                  step={step}
                  isLast={idx === result.steps.length - 1}
                />
              ))}
            </div>
          )}

          {/* Contenu final */}
          {result.finalOutput && <FinalOutputCard finalOutput={result.finalOutput} />}

          {/* Briefs créatifs */}
          <CreativeBriefCard imagePrompt={result.imagePrompt} videoPrompt={result.videoPrompt} />

          {/* CTA — passer à la diffusion */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={next}
              className="btn-primary inline-flex items-center gap-2"
            >
              {t("Passer à la diffusion", "Move to distribution")}
              <ArrowRightIcon />
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
