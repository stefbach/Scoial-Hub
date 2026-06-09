"use client";

// ── Étape 2 — Mes objectifs ────────────────────────────────────────────────
// Sélection des objectifs marketing, des canaux, du nombre de campagnes
// et de la zone géographique. Tout est persisté via ctx.patchState.

import { useState, useCallback } from "react";
import { useOnboardingCtx } from "@/components/onboarding/context";
import { useT } from "@/lib/i18n";
import { ALL_NETWORKS, type SocialNetwork } from "@/lib/onboarding/types";
import type { SuggestedObjective } from "@/lib/onboarding/types";
import { CountryCombobox } from "@/components/ui/CountryCombobox";
import { CityCombobox } from "@/components/ui/CityCombobox";
import { COUNTRIES } from "@/lib/scope";

/** Nom complet d'un pays depuis son code ISO (sinon le code tel quel). */
function countryLabel(code: string): string {
  const c = COUNTRIES.find((x) => x.id.toLowerCase() === code.toLowerCase());
  return c ? `${c.flag} ${c.label}` : code;
}

// ── Icônes SVG inline ───────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.5l3 3 5-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <circle cx="11.5" cy="4.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M9 5.5H7.5C7.2 5.5 7 5.7 7 6v1.5h2l-.3 2H7V14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 2c.2 1.5 1 2.5 2.5 2.7v2c-.9 0-1.8-.3-2.5-.8v4.1A3.5 3.5 0 1 1 6.5 6.5V8.6a1.5 1.5 0 1 0 1.5 1.5V2H10Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M5 6.5v4.5M5 4.5v.5M8 11V8.5C8 7.7 8.4 7 9.5 7s1.5.8 1.5 1.5V11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M8 1.5c0 0-3 2-3 6.5s3 6.5 3 6.5 3-2 3-6.5-3-6.5-3-6.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path d="M1.5 8h13M2.5 5h11M2.5 11h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CityIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="4" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <rect x="7" y="3" width="6" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M5 6V4M9 3V1.5M11 3V1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 7h2M9 9.5h2M9 12h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M3.5 10h1M3.5 12h1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function RadiusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" fill="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

// ── Config des plateformes ──────────────────────────────────────────────────

interface NetworkCfg {
  key: SocialNetwork;
  labelFr: string;
  labelEn: string;
  colorClass: string;
  bgSelected: string;
  borderSelected: string;
  icon: React.ReactNode;
}

const NETWORK_CFG: NetworkCfg[] = [
  {
    key: "instagram",
    labelFr: "Instagram",
    labelEn: "Instagram",
    colorClass: "text-platform-instagram",
    bgSelected: "bg-pink-50",
    borderSelected: "border-pink-300",
    icon: <InstagramIcon />,
  },
  {
    key: "facebook",
    labelFr: "Facebook",
    labelEn: "Facebook",
    colorClass: "text-platform-facebook",
    bgSelected: "bg-blue-50",
    borderSelected: "border-blue-300",
    icon: <FacebookIcon />,
  },
  {
    key: "tiktok",
    labelFr: "TikTok",
    labelEn: "TikTok",
    colorClass: "text-ink",
    bgSelected: "bg-canvas",
    borderSelected: "border-ink",
    icon: <TikTokIcon />,
  },
  {
    key: "linkedin",
    labelFr: "LinkedIn",
    labelEn: "LinkedIn",
    colorClass: "text-platform-linkedin",
    bgSelected: "bg-sky-50",
    borderSelected: "border-sky-300",
    icon: <LinkedInIcon />,
  },
];

// ── Objectifs par défaut (si pas de profil IA) ─────────────────────────────

interface FallbackObjective {
  id: string;
  labelFr: string;
  labelEn: string;
  whyFr: string;
  whyEn: string;
  emoji: string;
}

const FALLBACK_OBJECTIVES: FallbackObjective[] = [
  {
    id: "awareness",
    labelFr: "Notoriété",
    labelEn: "Awareness",
    whyFr: "Faire connaître votre marque auprès d'une nouvelle audience.",
    whyEn: "Make your brand known to a new audience.",
    emoji: "📢",
  },
  {
    id: "leads",
    labelFr: "Leads",
    labelEn: "Leads",
    whyFr: "Générer des contacts qualifiés intéressés par votre offre.",
    whyEn: "Generate qualified contacts interested in your offer.",
    emoji: "🎯",
  },
  {
    id: "sales",
    labelFr: "Ventes",
    labelEn: "Sales",
    whyFr: "Convertir directement votre audience en clients.",
    whyEn: "Directly convert your audience into customers.",
    emoji: "💳",
  },
  {
    id: "traffic",
    labelFr: "Trafic",
    labelEn: "Traffic",
    whyFr: "Ramener plus de visiteurs sur votre site ou boutique.",
    whyEn: "Drive more visitors to your site or store.",
    emoji: "🔗",
  },
  {
    id: "community",
    labelFr: "Communauté",
    labelEn: "Community",
    whyFr: "Fédérer vos fans, créer de l'engagement et de la fidélité.",
    whyEn: "Build your fan base, create engagement and loyalty.",
    emoji: "🤝",
  },
];

// ── Composant de chip supprimable (pays, ville) ────────────────────────────

function RemovableChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-primary-400 transition-colors hover:text-primary-700"
        aria-label={`Retirer ${label}`}
      >
        ×
      </button>
    </span>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

export default function Step2Objectives() {
  const t = useT();
  const ctx = useOnboardingCtx();
  const { state, profile, patchState } = ctx;

  // ── Objectifs ──────────────────────────────────────────────────────────────
  // On utilise les objectifs suggérés par l'IA s'ils existent, sinon la liste de secours.
  const aiObjectives: SuggestedObjective[] = profile.suggestedObjectives ?? [];
  const hasAiObjectives = aiObjectives.length > 0;

  function toggleObjective(id: string) {
    const prev = state.objectives ?? [];
    const next = prev.includes(id)
      ? prev.filter((o) => o !== id)
      : [...prev, id];
    patchState({ objectives: next });
  }

  // ── Canaux ─────────────────────────────────────────────────────────────────
  function toggleNetwork(network: SocialNetwork) {
    const prev = state.networks ?? [];
    const next = prev.includes(network)
      ? prev.filter((n) => n !== network)
      : [...prev, network];
    patchState({ networks: next });
  }

  // ── Nombre de campagnes ─────────────────────────────────────────────────────
  const CAMPAIGN_OPTIONS: { value: number; label: string }[] = [
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
    { value: 4, label: "4+" },
  ];

  // ── Zone géographique ──────────────────────────────────────────────────────
  const geo = state.geo ?? { countries: [] };

  const addCountry = useCallback(
    (id: string) => {
      const v = id.trim().toUpperCase();
      if (!v) return;
      const countries = geo.countries ?? [];
      if (!countries.includes(v)) {
        patchState({ geo: { ...geo, countries: [...countries, v] } });
      }
    },
    [geo, patchState]
  );

  const removeCountry = useCallback(
    (code: string) => {
      patchState({
        geo: { ...geo, countries: (geo.countries ?? []).filter((c) => c !== code) },
      });
    },
    [geo, patchState]
  );

  const addCity = useCallback(
    (name: string) => {
      const v = name.trim();
      if (!v) return;
      const cities = geo.cities ?? [];
      if (!cities.includes(v)) {
        patchState({ geo: { ...geo, cities: [...cities, v] } });
      }
    },
    [geo, patchState]
  );

  const removeCity = useCallback(
    (city: string) => {
      patchState({
        geo: { ...geo, cities: (geo.cities ?? []).filter((c) => c !== city) },
      });
    },
    [geo, patchState]
  );

  const setRadiusKm = useCallback(
    (val: number | undefined) => {
      patchState({ geo: { ...geo, radiusKm: val } });
    },
    [geo, patchState]
  );

  // Réseaux recommandés par l'IA (pour le hint visuel)
  const recommended = profile.recommendedNetworks ?? [];

  return (
    <div className="space-y-5">
      {/* ── Section 1 : Objectifs ─────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5 space-y-4">
        {/* En-tête */}
        <div>
          <p className="section-label text-primary-600">
            {t("Objectifs marketing", "Marketing objectives")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {hasAiObjectives
              ? t(
                  "L'IA a sélectionné ces objectifs selon votre profil. Choisissez-en un ou plusieurs.",
                  "The AI selected these objectives based on your profile. Pick one or more."
                )
              : t(
                  "Quels résultats voulez-vous atteindre ? Sélectionnez un ou plusieurs objectifs.",
                  "What results do you want to achieve? Select one or more objectives."
                )}
          </p>
        </div>

        {/* Cartes objectifs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hasAiObjectives
            ? aiObjectives.map((obj) => {
                const selected = (state.objectives ?? []).includes(obj.id);
                return (
                  <ObjectiveCard
                    key={obj.id}
                    id={obj.id}
                    label={obj.label}
                    why={obj.why}
                    selected={selected}
                    onToggle={() => toggleObjective(obj.id)}
                    isAi
                  />
                );
              })
            : FALLBACK_OBJECTIVES.map((obj) => {
                const selected = (state.objectives ?? []).includes(obj.id);
                return (
                  <ObjectiveCard
                    key={obj.id}
                    id={obj.id}
                    label={t(obj.labelFr, obj.labelEn)}
                    why={t(obj.whyFr, obj.whyEn)}
                    emoji={obj.emoji}
                    selected={selected}
                    onToggle={() => toggleObjective(obj.id)}
                    isAi={false}
                  />
                );
              })}
        </div>

        {/* Compteur de sélection */}
        {(state.objectives ?? []).length > 0 && (
          <p className="text-xs text-success-600 font-medium">
            {t(
              `${state.objectives.length} objectif${state.objectives.length > 1 ? "s" : ""} sélectionné${state.objectives.length > 1 ? "s" : ""}`,
              `${state.objectives.length} objective${state.objectives.length > 1 ? "s" : ""} selected`
            )}
          </p>
        )}
      </div>

      {/* ── Section 2 : Canaux ───────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div>
          <p className="section-label text-primary-600">
            {t("Canaux de diffusion", "Distribution channels")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Sur quels réseaux souhaitez-vous diffuser votre contenu ?",
              "On which networks do you want to distribute your content?"
            )}
            {recommended.length > 0 && (
              <span className="ml-1 text-xs text-primary-600 font-medium">
                {t(
                  `— L'IA recommande : ${recommended.join(", ")}`,
                  `— AI recommends: ${recommended.join(", ")}`
                )}
              </span>
            )}
          </p>
        </div>

        {/* Chips de réseaux */}
        <div className="flex flex-wrap gap-2">
          {ALL_NETWORKS.map((network) => {
            const cfg = NETWORK_CFG.find((c) => c.key === network)!;
            const selected = (state.networks ?? []).includes(network);
            const isRecommended = recommended.includes(network);

            return (
              <button
                key={network}
                type="button"
                onClick={() => toggleNetwork(network)}
                aria-pressed={selected}
                aria-label={t(
                  `Sélectionner ${cfg.labelFr}`,
                  `Select ${cfg.labelEn}`
                )}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1",
                  selected
                    ? `${cfg.bgSelected} ${cfg.borderSelected} shadow-sm`
                    : "border-hair bg-white/[0.04] text-muted hover:border-primary-400 hover:text-ink",
                ].join(" ")}
              >
                <span className={selected ? cfg.colorClass : "text-muted"}>
                  {cfg.icon}
                </span>
                <span className={selected ? cfg.colorClass : "text-ink"}>
                  {t(cfg.labelFr, cfg.labelEn)}
                </span>
                {/* Pastille « recommandé » si l'IA le suggère et pas encore sélectionné */}
                {isRecommended && !selected && (
                  <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-2xs font-bold text-primary-600">
                    {t("IA", "AI")}
                  </span>
                )}
                {/* Coche si sélectionné */}
                {selected && (
                  <span className={`${cfg.colorClass} opacity-80`}>
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section 3 : Nombre de campagnes ──────────────────────────────── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div>
          <p className="section-label text-primary-600">
            {t("Nombre de campagnes", "Number of campaigns")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t(
              "1 campagne = 1 objectif principal, bien ciblé. Plusieurs campagnes permettent de tester plusieurs angles simultanément.",
              "1 campaign = 1 main objective, well-targeted. Multiple campaigns let you test different angles simultaneously."
            )}
          </p>
        </div>

        {/* Segmented control */}
        <div
          className="inline-flex overflow-hidden rounded-xl border border-hair bg-canvas shadow-xs"
          role="group"
          aria-label={t("Sélectionner le nombre de campagnes", "Select number of campaigns")}
        >
          {CAMPAIGN_OPTIONS.map((opt) => {
            const isSelected = (state.campaignCount ?? 1) === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => patchState({ campaignCount: opt.value })}
                aria-pressed={isSelected}
                className={[
                  "px-5 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-400",
                  isSelected
                    ? "bg-page text-white shadow-sm"
                    : "text-muted hover:bg-white/[0.06] hover:text-ink",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Aide contextuelle selon la sélection */}
        <p className="text-xs text-muted">
          {(state.campaignCount ?? 1) === 1
            ? t(
                "Idéal pour démarrer : 1 message clair, 1 audience, 1 canal.",
                "Ideal to start: 1 clear message, 1 audience, 1 channel."
              )
            : (state.campaignCount ?? 1) <= 2
            ? t(
                "Bon équilibre : vous pouvez A/B tester deux approches.",
                "Good balance: you can A/B test two approaches."
              )
            : t(
                "Multi-angles : testez plusieurs messages et audiences en parallèle.",
                "Multi-angle: test several messages and audiences in parallel."
              )}
        </p>
      </div>

      {/* ── Section 4 : Zone géographique ─────────────────────────────────── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div>
          <p className="section-label text-primary-600">
            {t("Zone géographique", "Geographic zone")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t(
              "La zone cible oriente l'analyse concurrentielle et le ciblage des campagnes. Vous pourrez affiner plus tard.",
              "The target zone shapes competitor analysis and campaign targeting. You can refine this later."
            )}
          </p>
        </div>

        {/* Pays */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span className="text-primary-500">
              <GlobeIcon />
            </span>
            {t("Pays ciblés", "Target countries")}
          </label>

          {/* Chips pays existants (nom complet + drapeau) */}
          {(geo.countries ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {geo.countries.map((code) => (
                <RemovableChip
                  key={code}
                  label={countryLabel(code)}
                  onRemove={() => removeCountry(code)}
                />
              ))}
            </div>
          )}

          {/* Autocomplétion : tapez le NOM du pays, sélectionnez → ajouté en chip */}
          <CountryCombobox
            value=""
            onChange={(id) => addCountry(id)}
            placeholder={t("Tapez un pays (ex. France, Maurice)…", "Type a country (e.g. France, Mauritius)…")}
          />
          <p className="text-2xs text-muted">
            {t(
              "Tapez le nom du pays et sélectionnez-le dans la liste. Les pays choisis s'affichent ci-dessus.",
              "Type the country name and pick it from the list. Selected countries appear above.",
            )}
          </p>
        </div>

        {/* Séparateur */}
        <div className="border-t border-hair" />

        {/* Villes (optionnel) */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span className="text-primary-500">
              <CityIcon />
            </span>
            {t("Villes (optionnel)", "Cities (optional)")}
          </label>

          {(geo.cities ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(geo.cities ?? []).map((city) => (
                <RemovableChip
                  key={city}
                  label={city}
                  onRemove={() => removeCity(city)}
                />
              ))}
            </div>
          )}

          <CityCombobox
            countries={geo.countries ?? []}
            onAdd={addCity}
            placeholder={t("Tapez une ville du pays choisi…", "Type a city in the chosen country…")}
          />
          <p className="text-2xs text-muted">
            {t(
              "Les villes proposées correspondent au(x) pays sélectionné(s) ci-dessus.",
              "Suggested cities match the country(ies) selected above.",
            )}
          </p>
        </div>

        {/* Rayon (optionnel) */}
        <div className="space-y-2">
          <label
            className="flex items-center gap-1.5 text-xs font-semibold text-muted"
            htmlFor="step2-radius"
          >
            <span className="text-primary-500">
              <RadiusIcon />
            </span>
            {t("Rayon autour des villes (km, optionnel)", "Radius around cities (km, optional)")}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="step2-radius"
              type="number"
              min={0}
              max={5000}
              value={geo.radiusKm ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setRadiusKm(val === "" ? undefined : Number(val));
              }}
              placeholder="50"
              className="input w-28"
              aria-label={t("Rayon en kilomètres", "Radius in kilometres")}
            />
            <span className="text-sm text-muted">{t("km", "km")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sous-composant : carte d'objectif ─────────────────────────────────────

function ObjectiveCard({
  id,
  label,
  why,
  emoji,
  selected,
  onToggle,
  isAi,
}: {
  id: string;
  label: string;
  why: string;
  emoji?: string;
  selected: boolean;
  onToggle: () => void;
  isAi: boolean;
}) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={t(`Sélectionner l'objectif ${label}`, `Select objective ${label}`)}
      className={[
        "group relative w-full rounded-xl border p-4 text-left transition-all",
        "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1",
        selected
          ? "border-primary-400 bg-page/15 shadow-sm ring-2 ring-primary-500/40 ring-offset-1"
          : "border-hair bg-white/[0.04] hover:border-primary-400",
      ].join(" ")}
    >
      {/* Badge sélectionné */}
      <span
        className={[
          "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-white transition-all",
          selected ? "bg-page opacity-100 scale-100" : "bg-canvas border border-hair opacity-60 scale-90",
        ].join(" ")}
        aria-hidden="true"
      >
        {selected && <CheckIcon />}
      </span>

      {/* Emoji ou badge IA */}
      <div className="mb-2 flex items-center gap-2">
        {isAi ? (
          <span className="inline-flex items-center rounded-full bg-ai-textbg px-2 py-0.5 text-2xs font-bold text-ai-text">
            ✨ {t("IA", "AI")}
          </span>
        ) : (
          emoji && <span className="text-lg" aria-hidden="true">{emoji}</span>
        )}
      </div>

      {/* Titre */}
      <p
        className={[
          "text-sm font-semibold leading-snug",
          selected ? "text-primary-700" : "text-ink",
        ].join(" ")}
      >
        {label}
      </p>

      {/* Explication */}
      <p
        className={[
          "mt-1 text-xs leading-snug",
          selected ? "text-primary-600" : "text-muted",
        ].join(" ")}
      >
        {why}
      </p>
    </button>
  );
}
