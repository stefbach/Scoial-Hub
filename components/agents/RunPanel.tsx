"use client";

/**
 * RunPanel — panneau de lancement d'une orchestration.
 * Permet de saisir l'objectif, choisir le profil professionnel, configurer
 * la cadence, définir une cible de benchmark et sélectionner le niveau d'autonomie.
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AutonomyLevel, Cadence } from "@/lib/agents/types";
import { PRO_PROFILES } from "@/lib/agents/profiles";

// ── Données statiques ─────────────────────────────────────────────────────────

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

const DAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

const REPORTING_OPTIONS: { value: Cadence["reportingPeriod"]; label: string }[] = [
  { value: "day", label: "Journalier" },
  { value: "week", label: "Hebdomadaire" },
  { value: "month", label: "Mensuel" },
  { value: "quarter", label: "Trimestriel" },
  { value: "year", label: "Annuel" },
];

const EXAMPLE_OBJECTIVES = [
  "Lance une campagne d'acquisition pour Tibok à 50€/j",
  "Crée un post de notoriété pour Obesity Care Clinic",
  "Génère une annonce Meta pour Cabo Verde Medical à 100€/j",
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunPayload {
  objective: string;
  autonomy: AutonomyLevel;
  profileId: string;
  cadence: Cadence;
  benchmarkTarget?: string;
}

interface RunPanelProps {
  loading: boolean;
  onRun: (payload: RunPayload) => void;
}

// ── Composant principal ────────────────────────────────────────────────────────

export function RunPanel({ loading, onRun }: RunPanelProps) {
  const [objective, setObjective] = useState("");
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(2);
  const [profileId, setProfileId] = useState(PRO_PROFILES[0].id);
  const [postingPerDay, setPostingPerDay] = useState(1);
  const [postingDays, setPostingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [postingHour1, setPostingHour1] = useState("08:00");
  const [postingHour2, setPostingHour2] = useState("19:00");
  const [reportingPeriod, setReportingPeriod] = useState<Cadence["reportingPeriod"]>("month");
  const [benchmarkTarget, setBenchmarkTarget] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canSubmit = objective.trim().length > 0 && !loading;

  function toggleDay(day: number) {
    setPostingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const hours: string[] = [];
    if (postingHour1) hours.push(postingHour1);
    if (postingHour2 && postingHour2 !== postingHour1) hours.push(postingHour2);

    onRun({
      objective: objective.trim(),
      autonomy,
      profileId,
      cadence: {
        postingPerDay: Math.max(1, Math.min(10, postingPerDay)),
        postingDays: postingDays.length > 0 ? postingDays : [1, 2, 3, 4, 5],
        postingHours: hours.length > 0 ? hours : ["08:00", "19:00"],
        reportingPeriod,
      },
      benchmarkTarget: benchmarkTarget.trim() || undefined,
    });
  }

  const selectedProfile = PRO_PROFILES.find((p) => p.id === profileId) ?? PRO_PROFILES[0];

  return (
    <div className="card p-5">
      {/* En-tête */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 border border-primary-200">
          <SparklesIcon className="h-4 w-4 text-primary-700" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Lancer un pilotage IA</h2>
          <p className="text-2xs text-muted">Décrivez votre objectif en langage naturel</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Objectif ─────────────────────────────────────────────── */}
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

        {/* ── Profil professionnel ──────────────────────────────────── */}
        <div>
          <label className="section-label mb-1.5 block">Profil professionnel</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PRO_PROFILES.map((profile) => {
              const selected = profileId === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setProfileId(profile.id)}
                  disabled={loading}
                  className={`rounded-lg border p-2.5 text-left transition-all ${
                    selected
                      ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200"
                      : "border-hair bg-card hover:border-primary-200 hover:bg-canvas"
                  }`}
                >
                  <div className="text-xs font-semibold text-ink leading-tight">{profile.label}</div>
                  <div className="mt-0.5 text-2xs text-muted leading-snug line-clamp-2">
                    {profile.description}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Détail du profil sélectionné */}
          <div className="mt-2 rounded-lg border border-hair bg-canvas px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="section-label">Plateformes :</span>
              {selectedProfile.priorityPlatforms.slice(0, 3).map((p) => (
                <span key={p} className="chip text-2xs">{p}</span>
              ))}
              <span className="section-label ml-2">KPI cible :</span>
              <span className="chip text-2xs">
                CTR {selectedProfile.sectorKPIs.ctr.min}–{selectedProfile.sectorKPIs.ctr.max}%
              </span>
              <span className="chip text-2xs">
                CPA {selectedProfile.sectorKPIs.cpa.min}–{selectedProfile.sectorKPIs.cpa.max}€
              </span>
            </div>
          </div>
        </div>

        {/* ── Cadence & Benchmark (section repliable) ───────────────── */}
        <div className="rounded-lg border border-hair overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            disabled={loading}
            className="flex w-full items-center justify-between px-4 py-2.5 bg-canvas hover:bg-card transition-colors"
          >
            <span className="section-label">Cadence & benchmark</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 text-muted transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {showAdvanced && (
            <div className="border-t border-hair px-4 py-3 space-y-4">
              {/* Publications par jour */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="section-label mb-1 block">Publications/jour</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={postingPerDay}
                    onChange={(e) => setPostingPerDay(parseInt(e.target.value, 10) || 1)}
                    disabled={loading}
                    className="input w-full"
                  />
                </div>

                {/* Période de reporting */}
                <div className="sm:col-span-1">
                  <label className="section-label mb-1 block">Période de reporting</label>
                  <select
                    value={reportingPeriod}
                    onChange={(e) => setReportingPeriod(e.target.value as Cadence["reportingPeriod"])}
                    disabled={loading}
                    className="input w-full"
                  >
                    {REPORTING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Heure 1 */}
                <div>
                  <label className="section-label mb-1 block">Heure 1</label>
                  <input
                    type="time"
                    value={postingHour1}
                    onChange={(e) => setPostingHour1(e.target.value)}
                    disabled={loading}
                    className="input w-full"
                  />
                </div>

                {/* Heure 2 */}
                <div>
                  <label className="section-label mb-1 block">Heure 2 (optionnel)</label>
                  <input
                    type="time"
                    value={postingHour2}
                    onChange={(e) => setPostingHour2(e.target.value)}
                    disabled={loading}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Jours de publication */}
              <div>
                <label className="section-label mb-1.5 block">Jours de publication</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_OPTIONS.map((day) => {
                    const active = postingDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        disabled={loading}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                          active
                            ? "bg-primary-600 text-white ring-2 ring-primary-300"
                            : "border border-hair bg-card text-muted hover:border-primary-200 hover:text-ink"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cible de benchmark */}
              <div>
                <label className="section-label mb-1.5 block">Cible de benchmark</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Ex : concurrents téléconsultation France, Doctolib, Qare…"
                  value={benchmarkTarget}
                  onChange={(e) => setBenchmarkTarget(e.target.value)}
                  disabled={loading}
                  maxLength={200}
                />
                <p className="mt-1 text-2xs text-muted">
                  Décrivez les concurrents ou références sectorielles à utiliser pour le benchmark. Laissez vide pour utiliser les benchmarks sectoriels du profil.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Niveau d'autonomie ────────────────────────────────────── */}
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

        {/* ── Bouton de lancement ───────────────────────────────────── */}
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
                <SparklesIcon className="h-3.5 w-3.5" />
                Lancer le pilotage
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Icônes ─────────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}
