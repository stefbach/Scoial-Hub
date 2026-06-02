"use client";

/**
 * RunPanel — panneau de lancement d'une orchestration.
 * Permet de saisir l'objectif, choisir le niveau d'autonomie et déclencher le run.
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AutonomyLevel } from "@/lib/agents/types";

const AUTONOMY_OPTIONS: {
  level: AutonomyLevel;
  label: string;
  description: string;
  badge: string;
}[] = [
  {
    level: 1,
    label: "Recommandation",
    description:
      "Les agents produisent uniquement des suggestions. Aucune action n'est exécutée, aucune publication n'est initiée.",
    badge: "bg-canvas text-muted ring-1 ring-hair",
  },
  {
    level: 2,
    label: "Semi-auto",
    description:
      "Les agents simulent l'exécution complète. Vous validez manuellement avant publication ou activation de la campagne.",
    badge: "bg-ai-textbg text-ai-text ring-1 ring-ai-text/20",
  },
  {
    level: 3,
    label: "Auto (garde-fous)",
    description:
      "Exécution automatique si la conformité est validée et si le budget reste dans les limites autorisées (≤ 500€/j). Bloqué sinon.",
    badge: "bg-success-50 text-success-700 ring-1 ring-success-500/20",
  },
];

const EXAMPLE_OBJECTIVES = [
  "Lance une campagne d'acquisition pour Tibok à 50€/j",
  "Crée un post de notoriété pour Obesity Care Clinic",
  "Génère une annonce Meta pour Cabo Verde Medical à 100€/j",
];

interface RunPanelProps {
  loading: boolean;
  onRun: (objective: string, autonomy: AutonomyLevel) => void;
}

export function RunPanel({ loading, onRun }: RunPanelProps) {
  const [objective, setObjective] = useState("");
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(2);

  const canSubmit = objective.trim().length > 0 && !loading;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onRun(objective.trim(), autonomy);
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        {/* Icône IA */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 border border-primary-200">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-primary-700">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm-1-5a1 1 0 011-1h.01a1 1 0 010 2H10a1 1 0 01-1-1zm0-4a1 1 0 012 0v2a1 1 0 01-2 0V7z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Lancer un pilotage IA</h2>
          <p className="text-2xs text-muted">Décrivez votre objectif en langage naturel</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Champ objectif */}
        <div>
          <label className="section-label mb-1.5 block">Objectif de campagne</label>
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder="Ex : Lance une campagne d'acquisition pour Tibok à 50€/j sur Facebook et Instagram"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            disabled={loading}
            maxLength={1000}
          />
          {/* Exemples rapides */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EXAMPLE_OBJECTIVES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setObjective(ex)}
                disabled={loading}
                className="chip cursor-pointer text-2xs"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Sélecteur de niveau d'autonomie */}
        <div>
          <label className="section-label mb-1.5 block">Niveau d'autonomie</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {AUTONOMY_OPTIONS.map((opt) => {
              const selected = autonomy === opt.level;
              return (
                <button
                  key={opt.level}
                  type="button"
                  onClick={() => setAutonomy(opt.level)}
                  disabled={loading}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    selected
                      ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200"
                      : "border-hair bg-card hover:border-primary-200 hover:bg-canvas"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold ${opt.badge}`}
                    >
                      N{opt.level}
                    </span>
                    <span className="text-xs font-semibold text-ink">{opt.label}</span>
                  </div>
                  <p className="text-2xs leading-relaxed text-muted">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bouton de lancement */}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            className="min-w-[160px]"
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Pilotage en cours…
              </>
            ) : (
              <>
                <SparklesIcon />
                Lancer le pilotage
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}
