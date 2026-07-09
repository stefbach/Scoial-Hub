"use client";

// ── Étape 6 : Diffusion & pilotage (étape finale) ─────────────────────────────
// • Type de campagne (organique / payant / mixte)
// • Confirmation de la zone géographique (lecture seule + modifier)
// • Programmation (cadence + jours plafonnés + date de démarrage + heure unique)
// • Récapitulatif complet du parcours
// • CTA final : activation → POST /api/campaigns + ctx.complete() + succès

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOnboardingCtx } from "@/components/onboarding/context";
import { useT } from "@/lib/i18n";
import type { CampaignType, CadenceId, OnboardingSchedule } from "@/lib/onboarding/types";

// ── Icônes SVG inline ────────────────────────────────────────────────────────

/** Fusée — CTA principal d'activation */
function RocketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2c0 0 4 2 4 8v2l3 3-1.5 1.5-2.5-1.5S14 18 12 19c-2-1-3-3.5-3-3.5L6.5 17 5 15.5l3-3V11c0-6 4-9 4-9z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"
      />
      <circle cx="12" cy="9" r="1.5" fill="currentColor" />
      <path d="M9 19l-2 3M15 19l2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Check dans un cercle — succès */
function CheckCircleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 12l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Spinner de chargement */
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Icône "+" pour ajouter une heure */
function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Helpers de programmation ──────────────────────────────────────────────────

/** Jours de la semaine (0=Dim … 6=Sam), dans l'ordre d'affichage Lun→Dim. */
const WEEK_DAYS: { d: number; fr: string; en: string }[] = [
  { d: 1, fr: "Lun", en: "Mon" }, { d: 2, fr: "Mar", en: "Tue" },
  { d: 3, fr: "Mer", en: "Wed" }, { d: 4, fr: "Jeu", en: "Thu" },
  { d: 5, fr: "Ven", en: "Fri" }, { d: 6, fr: "Sam", en: "Sat" },
  { d: 0, fr: "Dim", en: "Sun" },
];

/** Nombre maximum de jours sélectionnables selon la cadence. */
function maxDaysForCadence(cadence: CadenceId | undefined): number {
  return cadence === "daily" ? 7 : cadence === "weekly" ? 1 : 3;
}

/** Heure de publication par défaut (HH:mm). */
const DEFAULT_TIME = "09:00";

/** Date du jour au format YYYY-MM-DD, fuseau local. */
function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Jours effectifs de publication (quotidien = tous les jours). */
function effectiveDays(schedule: OnboardingSchedule): number[] {
  return schedule.cadence === "daily" ? [0, 1, 2, 3, 4, 5, 6] : schedule.days ?? [];
}

/**
 * Prochain jour ∈ `days` à partir de `fromISO` (aujourd'hui compris), au format
 * YYYY-MM-DD — calcul en fuseau local, comme todayISO().
 */
function nextSelectedDayISO(days: number[], fromISO: string): string | null {
  if (days.length === 0) return null;
  const [y, m, d] = fromISO.split("-").map(Number);
  for (let i = 0; i < 7; i++) {
    const cand = new Date(y, m - 1, d + i);
    if (days.includes(cand.getDay())) {
      const mm = String(cand.getMonth() + 1).padStart(2, "0");
      const dd = String(cand.getDate()).padStart(2, "0");
      return `${cand.getFullYear()}-${mm}-${dd}`;
    }
  }
  return null;
}

/**
 * Heures dédupliquées dérivées des heures par jour, dans l'ordre d'affichage
 * Lun→Dim (rétro-compat `times` : 1er élément = heure principale).
 */
function deriveTimes(
  days: number[],
  timesByDay: Record<number, string> | undefined,
  fallback: string
): string[] {
  const ordered = WEEK_DAYS.filter((w) => days.includes(w.d)).map(
    (w) => timesByDay?.[w.d] ?? fallback
  );
  const dedup = ordered.filter((t, i) => ordered.indexOf(t) === i);
  return dedup.length > 0 ? dedup : [fallback];
}

// ── Couleurs de plateforme ─────────────────────────────────────────────────────

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "text-platform-instagram",
  facebook:  "text-platform-facebook",
  linkedin:  "text-platform-linkedin",
  tiktok:    "text-ink",
};

// ── Section 1 : Type de campagne ──────────────────────────────────────────────

interface CampaignTypeConfig {
  id: CampaignType;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  badgeFr: string;
  badgeEn: string;
  icon: React.ReactNode;
}

const CAMPAIGN_TYPES: CampaignTypeConfig[] = [
  {
    id: "organic",
    titleFr: "Organique",
    titleEn: "Organic",
    descFr: "Contenus gratuits, croissance communauté, portée naturelle — sans budget publicitaire.",
    descEn: "Free content, community growth, natural reach — no advertising budget.",
    badgeFr: "Gratuit",
    badgeEn: "Free",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21c0 0-8-4-8-12 0 0 4 0 8 4 4-4 8-4 8-4 0 8-8 12-8 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "paid",
    titleFr: "Payant",
    titleEn: "Paid",
    descFr: "Budget publicitaire dédié, ciblage précis, retour sur investissement mesurable.",
    descEn: "Dedicated ad budget, precise targeting, measurable ROI.",
    badgeFr: "Budget pub",
    badgeEn: "Ad budget",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="14" r="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    ),
  },
  {
    id: "mixed",
    titleFr: "Mixte",
    titleEn: "Mixed",
    descFr: "Les deux : publications organiques amplifiées par des investissements publicitaires ciblés.",
    descEn: "Both: organic posts amplified by targeted ad spend.",
    badgeFr: "Recommandé",
    badgeEn: "Recommended",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l2.5 6H20l-4.5 4 1.5 6L12 16l-5 3 1.5-6L4 9h5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
];

function CampaignTypeSection() {
  const t = useT();
  const { state, patchState } = useOnboardingCtx();

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-hair bg-canvas px-5 py-3">
        <span className="section-label">{t("Type de campagne", "Campaign type")}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
        {CAMPAIGN_TYPES.map((ct) => {
          const isActive = state.campaignType === ct.id;
          return (
            <button
              key={ct.id}
              type="button"
              onClick={() => patchState({ campaignType: ct.id })}
              aria-pressed={isActive}
              className={[
                "group relative flex flex-col items-start gap-2.5 rounded-2xl border p-4 text-left transition-all duration-200",
                "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                isActive
                  ? "border-primary-400 bg-primary-50 shadow-sm ring-2 ring-primary-200"
                  : "border-hair bg-card hover:border-primary-200 hover:bg-primary-50/30",
              ].join(" ")}
            >
              {/* Badge */}
              <span className={[
                "absolute right-3 top-3 rounded-full px-2 py-0.5 text-2xs font-semibold",
                isActive ? "bg-primary-100 text-primary-700" : "border border-hair bg-canvas text-muted",
              ].join(" ")}>
                {t(ct.badgeFr, ct.badgeEn)}
              </span>

              {/* Icône */}
              <span className={[
                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                isActive
                  ? "bg-primary-100 text-primary-600"
                  : "bg-canvas text-muted group-hover:bg-primary-50 group-hover:text-primary-500",
              ].join(" ")}>
                {ct.icon}
              </span>

              {/* Titre + check */}
              <div className="flex w-full items-start justify-between gap-2">
                <p className={`text-sm font-semibold ${isActive ? "text-primary-700" : "text-ink"}`}>
                  {t(ct.titleFr, ct.titleEn)}
                </p>
                {isActive && (
                  <span className="shrink-0 text-primary-600">
                    <CheckCircleIcon size={18} />
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-muted">
                {t(ct.descFr, ct.descEn)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Section 2 : Confirmation de la zone ──────────────────────────────────────

function ZoneSection() {
  const t = useT();
  const { state, goTo } = useOnboardingCtx();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-hair bg-canvas px-5 py-3">
        <span className="section-label">{t("Zone de diffusion", "Distribution zone")}</span>
        <button
          type="button"
          onClick={() => goTo(2)}
          className="btn-ghost text-xs text-primary-600 hover:text-primary-700"
          aria-label={t("Modifier la zone géographique", "Edit geographic zone")}
        >
          {t("Modifier", "Edit")}
        </button>
      </div>
      <div className="px-5 py-4">
        {state.geo.countries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {state.geo.countries.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full bg-canvas px-3 py-1 text-sm font-medium text-ink ring-1 ring-hair"
              >
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted italic">
            {t("Aucun pays défini — cliquez sur « Modifier » pour revenir à l'étape 2.", "No countries defined — click 'Edit' to return to step 2.")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Section 3 : Programmation ─────────────────────────────────────────────────

const CADENCES: { id: CadenceId; labelFr: string; labelEn: string }[] = [
  { id: "daily",   labelFr: "Quotidien",  labelEn: "Daily" },
  { id: "3x_week", labelFr: "3×/sem",     labelEn: "3×/week" },
  { id: "weekly",  labelFr: "Hebdo",      labelEn: "Weekly" },
];

function ProgrammationSection() {
  const t = useT();
  const { state, patchState } = useOnboardingCtx();
  const schedule = state.schedule;

  // Erreur de date (tentative de date passée).
  const [dateError, setDateError] = useState<string | null>(null);

  const today = todayISO();

  // Plafond de jours sélectionnables selon la cadence.
  const expectedDays = maxDaysForCadence(schedule.cadence);
  const selectedDays = schedule.days ?? [];
  const limitReached = selectedDays.length >= expectedDays;

  // Heure principale de publication (rétro-compat : 1re heure du tableau).
  const mainTime = schedule.times?.[0] ?? DEFAULT_TIME;
  const timeForDay = (d: number) => schedule.timesByDay?.[d] ?? mainTime;

  // ── Pré-remplissage de la date de démarrage (prochain jour sélectionné) ────
  // On ne touche jamais à une date saisie manuellement : seule une date vide,
  // passée, ou égale au dernier défaut auto-calculé est (re)pré-remplie.
  const autoDateRef = useRef<string | null>(null);
  const daysKey = effectiveDays(schedule).join(",");
  useEffect(() => {
    const def = nextSelectedDayISO(effectiveDays(schedule), today);
    if (!def) return;
    const cur = schedule.startDate;
    if (cur === def) {
      autoDateRef.current = def; // le défaut courant reste re-calculable
      return;
    }
    const isAuto = !cur || cur < today || cur === autoDateRef.current;
    if (!isAuto) return;
    autoDateRef.current = def;
    setDateError(null);
    patchState({ schedule: { ...schedule, startDate: def } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey, schedule.startDate, today]);

  function setCadence(cadence: CadenceId) {
    // Changement de cadence : on tronque proprement les jours au nouveau plafond
    // (les jours les plus tôt dans la semaine sont conservés) et on re-dérive
    // les heures à partir des heures par jour restantes.
    const days = selectedDays.slice(0, maxDaysForCadence(cadence));
    const times =
      cadence === "daily" ? [mainTime] : deriveTimes(days, schedule.timesByDay, mainTime);
    patchState({ schedule: { ...schedule, cadence, days, times } });
  }

  function setStartDate(startDate: string) {
    // Garde : aucune date antérieure à aujourd'hui (fuseau local).
    if (startDate && startDate < today) {
      setDateError(
        t(
          "La date de démarrage ne peut pas être antérieure à aujourd'hui.",
          "The start date cannot be earlier than today."
        )
      );
      return;
    }
    setDateError(null);
    patchState({ schedule: { ...schedule, startDate } });
  }

  function toggleDay(day: number) {
    const cur = schedule.days ?? [];
    let days: number[];
    if (cur.includes(day)) {
      days = cur.filter((d) => d !== day);
    } else {
      // Plafond atteint : on ignore (les boutons sont désactivés par ailleurs).
      if (cur.length >= expectedDays) return;
      days = [...cur, day].sort((a, b) => a - b);
    }
    // `times` reste la liste dédupliquée des heures des jours actifs (l'heure
    // mémorisée d'un jour décoché est conservée dans timesByDay).
    patchState({
      schedule: { ...schedule, days, times: deriveTimes(days, schedule.timesByDay, mainTime) },
    });
  }

  function setSingleTime(time: string) {
    if (!time) return;
    // Heure unique (cadence quotidienne / aucun jour choisi) : on repart d'une
    // base propre — pas d'heures par jour périmées.
    patchState({ schedule: { ...schedule, times: [time], timesByDay: undefined } });
  }

  function setTimeForDay(day: number, time: string) {
    if (!time) return;
    const timesByDay = { ...(schedule.timesByDay ?? {}), [day]: time };
    patchState({
      schedule: {
        ...schedule,
        timesByDay,
        // Rétro-compat : `times` = heures dédupliquées, 1er élément = heure principale.
        times: deriveTimes(selectedDays, timesByDay, mainTime),
      },
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-hair bg-canvas px-5 py-3">
        <span className="section-label">{t("Programmation", "Schedule")}</span>
      </div>
      <div className="space-y-5 p-5">

        {/* Cadence — contrôle segmenté */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">
            {t("Cadence de publication", "Posting cadence")}
          </p>
          <div
            role="group"
            aria-label={t("Cadence de publication", "Posting cadence")}
            className="inline-flex overflow-hidden rounded-xl border border-hair bg-canvas"
          >
            {CADENCES.map((c) => {
              const isActive = schedule.cadence === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCadence(c.id)}
                  aria-pressed={isActive}
                  className={[
                    "px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
                    isActive
                      ? "bg-page text-white"
                      : "text-muted hover:bg-canvas hover:text-ink",
                  ].join(" ")}
                >
                  {t(c.labelFr, c.labelEn)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Jours de publication — affiché pour 3×/sem & hebdo (pas « quotidien ») */}
        {schedule.cadence && schedule.cadence !== "daily" && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">
              {t("Jours de publication", "Posting days")}
              <span className="ml-1 font-normal text-muted">
                {t(
                  `(choisissez ${expectedDays} jour${expectedDays > 1 ? "s" : ""} — ${selectedDays.length}/${expectedDays})`,
                  `(pick ${expectedDays} day${expectedDays > 1 ? "s" : ""} — ${selectedDays.length}/${expectedDays})`
                )}
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_DAYS.map(({ d, fr, en }) => {
                const on = selectedDays.includes(d);
                // Plafond atteint : les jours non cochés deviennent non sélectionnables.
                const blocked = !on && limitReached;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={on}
                    disabled={blocked}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                      on
                        ? "border-primary-400 bg-page text-white shadow-sm"
                        : blocked
                        ? "border-hair bg-card text-muted opacity-40 cursor-not-allowed"
                        : "border-hair bg-card text-muted hover:border-primary-300 hover:text-ink",
                    ].join(" ")}
                  >
                    {t(fr, en)}
                  </button>
                );
              })}
            </div>
            <p className="text-2xs text-muted">
              {t(
                "Les agents publieront ces jours-là, à partir de la date de démarrage.",
                "Agents will post on these days, starting from the start date.",
              )}
            </p>
          </div>
        )}

        {/* Date de démarrage */}
        <div className="space-y-2">
          <label
            htmlFor="step6-start-date"
            className="block text-xs font-semibold text-muted"
          >
            {t("Date de démarrage", "Start date")}
          </label>
          <input
            id="step6-start-date"
            type="date"
            min={today}
            value={schedule.startDate ?? ""}
            onChange={(e) => setStartDate(e.target.value)}
            className="input w-full max-w-xs text-sm"
            aria-label={t("Date de démarrage de la campagne", "Campaign start date")}
            aria-describedby={dateError ? "step6-start-date-error" : undefined}
          />
          {dateError && (
            <p id="step6-start-date-error" className="text-2xs font-medium text-danger-600" role="alert">
              {dateError}
            </p>
          )}
        </div>

        {/* Heure de publication — une heure distincte possible par jour sélectionné ;
            heure unique en cadence quotidienne ou tant qu'aucun jour n'est choisi */}
        {schedule.cadence !== "daily" && selectedDays.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted">
              {t("Heure de publication", "Posting time")}
            </legend>
            <div className="space-y-1.5">
              {WEEK_DAYS.filter((w) => selectedDays.includes(w.d)).map(({ d, fr, en }) => (
                <div key={d} className="flex items-center gap-3">
                  <label
                    htmlFor={`step6-publish-time-${d}`}
                    className="w-10 shrink-0 text-xs font-medium text-ink"
                  >
                    {t(fr, en)}
                  </label>
                  <input
                    id={`step6-publish-time-${d}`}
                    type="time"
                    value={timeForDay(d)}
                    onChange={(e) => setTimeForDay(d, e.target.value)}
                    className="input w-32 text-sm"
                    aria-label={t(`Heure de publication — ${fr}`, `Posting time — ${en}`)}
                  />
                </div>
              ))}
            </div>
            <p className="text-2xs text-muted">
              {t(
                "Chaque jour sélectionné peut avoir sa propre heure de publication.",
                "Each selected day can have its own posting time."
              )}
            </p>
          </fieldset>
        ) : (
          <div className="space-y-2">
            <label htmlFor="step6-publish-time" className="block text-xs font-semibold text-muted">
              {t("Heure de publication", "Posting time")}
            </label>
            <input
              id="step6-publish-time"
              type="time"
              value={mainTime}
              onChange={(e) => setSingleTime(e.target.value)}
              className="input w-32 text-sm"
              aria-label={t("Heure de publication", "Posting time")}
            />
            <p className="text-2xs text-muted">
              {t(
                "Les agents publieront à cette heure les jours sélectionnés.",
                "Agents will post at this time on the selected days."
              )}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Section 4 : Récapitulatif complet ────────────────────────────────────────

function RecapSection() {
  const t = useT();
  const { state, profile, companyName } = useOnboardingCtx();

  // Label de l'objectif principal
  const primaryObj = state.objectives[0];
  const primaryObjLabel = (() => {
    if (!primaryObj) return null;
    const found = profile.suggestedObjectives?.find((o) => o.id === primaryObj);
    return found ? found.label : primaryObj;
  })();

  // Labels de type de campagne
  const campaignTypeLabel = (() => {
    if (!state.campaignType) return null;
    const cfg = { organic: { fr: "Organique", en: "Organic" }, paid: { fr: "Payant", en: "Paid" }, mixed: { fr: "Mixte", en: "Mixed" } };
    const c = cfg[state.campaignType];
    return c ? t(c.fr, c.en) : state.campaignType;
  })();

  // Label de cadence
  const cadenceLabel = (() => {
    if (!state.schedule.cadence) return null;
    const cfg = { daily: { fr: "Quotidien", en: "Daily" }, "3x_week": { fr: "3×/semaine", en: "3×/week" }, weekly: { fr: "Hebdomadaire", en: "Weekly" }, custom: { fr: "Personnalisé", en: "Custom" } };
    const c = cfg[state.schedule.cadence];
    return c ? t(c.fr, c.en) : state.schedule.cadence;
  })();

  // Heure de publication (principale) + jours sélectionnés
  const publishTime = state.schedule.times?.[0] ?? DEFAULT_TIME;
  // Heures par jour : listées « Mer 09:00 · Ven 12:00 » si au moins deux diffèrent,
  // sinon affichage compact heure unique + jours.
  const perDayTimes = (() => {
    const sched = state.schedule;
    if (sched.cadence === "daily") return null;
    const days = sched.days ?? [];
    if (days.length === 0) return null;
    const entries = WEEK_DAYS.filter((w) => days.includes(w.d)).map((w) => ({
      w,
      time: sched.timesByDay?.[w.d] ?? publishTime,
    }));
    return entries.some((e) => e.time !== entries[0].time) ? entries : null;
  })();
  const daysSummary = (() => {
    if (state.schedule.cadence === "daily") return t("tous les jours", "every day");
    const days = state.schedule.days ?? [];
    if (days.length === 0) return null;
    return WEEK_DAYS.filter((w) => days.includes(w.d)).map((w) => t(w.fr, w.en)).join(", ");
  })();

  // Label mode créatif
  const creativeModeLabel = (() => {
    if (!state.creativeMode) return null;
    const cfg = { autonomous: { fr: "Génération autonome", en: "Autonomous generation" }, bank: { fr: "Banque d'images", en: "Image bank" }, product: { fr: "Studio produit", en: "Product studio" } };
    const c = cfg[state.creativeMode];
    return c ? t(c.fr, c.en) : state.creativeMode;
  })();

  const rows: { labelFr: string; labelEn: string; content: React.ReactNode }[] = [
    {
      labelFr: "Marque",
      labelEn: "Brand",
      content: (
        <div>
          <p className="text-sm font-semibold text-ink">{companyName}</p>
          {profile.positioning && (
            <p className="mt-0.5 text-xs text-muted line-clamp-2">{profile.positioning}</p>
          )}
        </div>
      ),
    },
    ...(state.objectives.length > 0 ? [{
      labelFr: "Objectifs",
      labelEn: "Objectives",
      content: (
        <div className="flex flex-wrap gap-1.5">
          {state.objectives.map((id) => {
            const found = profile.suggestedObjectives?.find((o) => o.id === id);
            return (
              <span key={id} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-200">
                {found ? found.label : id}
              </span>
            );
          })}
        </div>
      ),
    }] : []),
    ...(state.networks.length > 0 ? [{
      labelFr: "Réseaux",
      labelEn: "Networks",
      content: (
        <div className="flex flex-wrap gap-1.5">
          {state.networks.map((n) => (
            <span key={n} className={`rounded-full bg-canvas px-2.5 py-0.5 text-2xs font-semibold ring-1 ring-hair capitalize ${PLATFORM_COLOR[n] ?? "text-ink"}`}>
              {n}
            </span>
          ))}
        </div>
      ),
    }] : []),
    ...(state.geo.countries.length > 0 ? [{
      labelFr: "Zone",
      labelEn: "Zone",
      content: (
        <div className="flex flex-wrap gap-1.5">
          {state.geo.countries.map((c) => (
            <span key={c} className="rounded-full bg-canvas px-2.5 py-0.5 text-2xs font-medium text-ink ring-1 ring-hair">
              {c}
            </span>
          ))}
        </div>
      ),
    }] : []),
    ...(creativeModeLabel ? [{
      labelFr: "Visuels",
      labelEn: "Creatives",
      content: <span className="text-sm text-ink">{creativeModeLabel}</span>,
    }] : []),
    ...(campaignTypeLabel ? [{
      labelFr: "Type",
      labelEn: "Type",
      content: <span className="text-sm text-ink">{campaignTypeLabel}</span>,
    }] : []),
    ...(cadenceLabel ? [{
      labelFr: "Cadence",
      labelEn: "Cadence",
      content: (
        <span className="text-sm text-ink">
          {cadenceLabel}
          {state.schedule.startDate && (
            <span className="ml-2 text-xs text-muted">
              {t("dès le", "from")} {state.schedule.startDate}
            </span>
          )}
        </span>
      ),
    }] : []),
    {
      labelFr: "Heure",
      labelEn: "Time",
      content: perDayTimes ? (
        <span className="text-sm text-ink">
          {perDayTimes.map(({ w, time }, i) => (
            <span key={w.d} className="whitespace-nowrap">
              {i > 0 && <span className="text-muted"> · </span>}
              {t(w.fr, w.en)} {time}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-sm text-ink">
          {publishTime}
          {daysSummary && (
            <span className="ml-2 text-xs text-muted">— {daysSummary}</span>
          )}
        </span>
      ),
    },
  ];

  // Suppression de l'avertissement TypeScript sur primaryObjLabel non utilisé directement
  void primaryObjLabel;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-hair bg-canvas px-5 py-3">
        <span className="section-label">{t("Récapitulatif du parcours", "Journey summary")}</span>
      </div>
      <div className="divide-y divide-hair">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-4 px-5 py-3">
            <span className="w-24 shrink-0 pt-0.5 text-2xs font-semibold uppercase tracking-wide text-muted">
              {t(row.labelFr, row.labelEn)}
            </span>
            <div className="min-w-0 flex-1">{row.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function Step6Diffusion() {
  const t = useT();
  const { state, profile, companyId, companyName, complete, startNewCampaign } = useOnboardingCtx();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  // ── Label de l'objectif principal ────────────────────────────────────────
  function getPrimaryObjectiveLabel(): string {
    const id = state.objectives[0];
    if (!id) return t("Campagne sociale", "Social campaign");
    const found = profile.suggestedObjectives?.find((o) => o.id === id);
    return found ? found.label : id;
  }

  // ── Activation — POST /api/campaigns puis ctx.complete() ─────────────────
  async function handleActivate() {
    setSubmitting(true);
    setError(null);

    try {
      const primaryObjLabel = getPrimaryObjectiveLabel();
      const campaignName = `${companyName} — ${primaryObjLabel}`;

      // Garde : une date de démarrage passée (ex. état persisté avant le
      // correctif) est ramenée à aujourd'hui.
      const today = todayISO();
      const startDate =
        state.schedule.startDate && state.schedule.startDate < today
          ? today
          : state.schedule.startDate;

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: campaignName,
          objective: state.objectives[0] ?? "awareness",
          platforms: state.networks,
          status: state.campaignType === "organic" ? "active" : "paused",
          enabled: true,
          startDate,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? t(`Erreur serveur (${res.status})`, `Server error (${res.status})`));
      }

      // Marque le parcours comme terminé et persiste
      await complete();
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Une erreur inattendue s'est produite.", "An unexpected error occurred.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── État de succès ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Carte succès */}
        <div className="card overflow-hidden">
          <div className="flex flex-col items-center gap-5 px-6 py-10 text-center">
            {/* Icône success */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-50 text-success-600">
              <CheckCircleIcon size={48} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">
                {t("Votre dispositif est actif 🎉", "Your setup is live 🎉")}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                {t(
                  "Les agents IA pilotent cette campagne en continu. Vous pouvez en lancer d'autres à tout moment — votre identité de marque est déjà enregistrée.",
                  "AI agents are now running this campaign continuously. You can launch more at any time — your brand identity is already saved."
                )}
              </p>
            </div>

            {/* Récapitulatif succès */}
            <div className="w-full max-w-sm rounded-xl border border-success-200 bg-success-50 px-5 py-4 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-success-700">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t("Campagne créée", "Campaign created")}
              </div>
              <p className="mt-1.5 text-sm font-medium text-ink">
                {companyName} — {getPrimaryObjectiveLabel()}
              </p>
              {state.schedule.startDate && (
                <p className="mt-1 text-xs text-muted">
                  {t("Démarrage le", "Starting on")} {state.schedule.startDate}
                </p>
              )}
              {state.networks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {state.networks.map((n) => (
                    <span key={n} className={`text-2xs font-semibold capitalize ${PLATFORM_COLOR[n] ?? "text-ink"}`}>
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Boutons de navigation */}
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/pilotage"
                className="btn-primary inline-flex items-center gap-2"
              >
                <RocketIcon />
                {t("Voir le pilotage", "View control center")}
              </Link>
              <button
                type="button"
                onClick={() => { setSuccess(false); startNewCampaign(); }}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <PlusIcon />
                {t("Créer une autre campagne", "Create another campaign")}
              </button>
              <Link
                href="/dashboard"
                className="btn-secondary inline-flex items-center gap-2"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                {t("Tableau de bord", "Dashboard")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Vue principale ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* 1. Type de campagne */}
      <CampaignTypeSection />

      {/* 2. Confirmation de la zone */}
      <ZoneSection />

      {/* 3. Programmation */}
      <ProgrammationSection />

      {/* 4. Récapitulatif complet */}
      <RecapSection />

      {/* ── Erreur d'activation ── */}
      {error && (
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
              {t("Erreur lors de l'activation", "Activation error")}
            </p>
            <p className="mt-0.5 text-xs text-danger-600">{error}</p>
          </div>
        </div>
      )}

      {/* ── CTA final : Activer le pilotage automatique ── */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <RocketIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {t("Prêt à lancer le pilotage automatique ?", "Ready to launch automatic piloting?")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t(
                "En cliquant, vous créez votre campagne et confiez la publication à vos agents IA. Vous gardez toujours la main depuis le tableau de bord.",
                "By clicking, you create your campaign and hand publishing over to your AI agents. You always stay in control from the dashboard."
              )}
            </p>
            <button
              type="button"
              onClick={handleActivate}
              disabled={submitting}
              className="btn-primary mt-4 inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
              aria-busy={submitting}
              aria-label={t("Activer le pilotage automatique", "Activate automatic piloting")}
            >
              {submitting ? (
                <>
                  <Spinner />
                  {t("Activation en cours…", "Activating…")}
                </>
              ) : (
                <>
                  <RocketIcon />
                  {t("Activer le pilotage automatique", "Activate automatic piloting")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
