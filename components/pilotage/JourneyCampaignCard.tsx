"use client";

// Carte « Campagne du parcours » — reflète le dispositif RÉELLEMENT créé par le
// Démarrage assisté (étape 6) : la campagne (POST /api/campaigns → sh_campaigns)
// et l'état persisté du parcours (sh_onboarding_state : réseaux, zone, cadence).
// Aucune donnée fabriquée : chaque ligne n'apparaît que si la donnée existe ;
// sans campagne ni parcours activé → état vide honnête avec lien vers /demarrage.

import Link from "next/link";
import { useLang, useT } from "@/lib/i18n";
import { countryLabel } from "@/lib/scope";
import type { Campaign } from "@/lib/types";
import type { OnboardingSchedule, OnboardingState } from "@/lib/onboarding/types";

const NETWORK_META: Record<string, { label: string; color: string }> = {
  facebook: { label: "Facebook", color: "#1877F2" },
  fb: { label: "Facebook", color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E1306C" },
  ig: { label: "Instagram", color: "#E1306C" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
  tiktok: { label: "TikTok", color: "#111111" },
};

/** Libellé lisible des pays du parcours (codes ISO-2 ou noms déjà saisis). */
export function zoneLabel(countries: string[], lang: string): string {
  return countries
    .map((c) => (c.trim().length === 2 ? countryLabel(c.trim(), lang) : c))
    .join(", ");
}

/** Heures par défaut documentées à l'étape 6 (« Par défaut : 08:00 et 19:00 »). */
const DEFAULT_TIMES = ["08:00", "19:00"];

/** Prochaine publication dérivée de la programmation réelle du parcours. */
function nextPublication(schedule: OnboardingSchedule, now = new Date()): Date | null {
  if (!schedule.cadence) return null;
  const days = schedule.cadence === "daily" ? [0, 1, 2, 3, 4, 5, 6] : schedule.days ?? [];
  if (days.length === 0) return null;
  const times = (schedule.times?.length ? schedule.times : DEFAULT_TIMES).slice().sort();
  const start = schedule.startDate ? new Date(`${schedule.startDate}T00:00:00`) : null;
  const from = start && !Number.isNaN(+start) && start > now ? start : now;
  for (let i = 0; i < 14; i++) {
    const day = new Date(from);
    day.setDate(day.getDate() + i);
    if (!days.includes(day.getDay())) continue;
    for (const time of times) {
      const [h, m] = time.split(":").map(Number);
      const candidate = new Date(day);
      candidate.setHours(h || 0, m || 0, 0, 0);
      if (candidate >= from) return candidate;
    }
  }
  return null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
      <span className="w-28 shrink-0 pt-0.5 text-2xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-sm text-ink">{children}</div>
    </div>
  );
}

export function JourneyCampaignCard({
  campaign,
  state,
}: {
  campaign: Campaign | null;
  state: OnboardingState | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "fr" ? "fr-FR" : "en-GB";

  // Rien d'activé pour cette société → état vide honnête, lien vers le parcours.
  if (!campaign && !state?.completed) {
    return (
      <div className="card flex flex-col items-center gap-1.5 p-5 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-muted ring-1 ring-hair">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1c0 0 3 1.5 3 6v1.5l2 2-1 1-1.8-1S9.5 12.5 8 13.5C6.5 12.5 5.8 10.5 5.8 10.5L4 11.5l-1-1 2-2V7c0-4.5 3-6 3-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="text-sm font-semibold text-ink">
          {t("Aucune campagne issue du parcours", "No campaign from the guided setup")}
        </div>
        <p className="max-w-sm text-2xs text-muted">
          {t(
            "Le Démarrage assisté crée votre première campagne pilotée par les agents IA (réseaux, zone, cadence). Elle apparaîtra ici dès son activation.",
            "The guided setup creates your first AI-piloted campaign (networks, zone, cadence). It will appear here as soon as it is activated."
          )}
        </p>
        <Link href="/demarrage" className="mt-1 text-xs font-medium text-primary-600 hover:underline">
          {t("Lancer le démarrage assisté →", "Start the guided setup →")}
        </Link>
      </div>
    );
  }

  const networks: string[] = campaign?.platforms?.length
    ? (campaign.platforms as string[])
    : state?.networks ?? [];
  const countries = state?.geo?.countries ?? [];
  const schedule = state?.schedule ?? {};
  const next = nextPublication(schedule);

  const typeLabel =
    state?.campaignType === "organic" ? t("Organique (gratuit)", "Organic (free)")
    : state?.campaignType === "paid" ? t("Payant", "Paid")
    : state?.campaignType === "mixed" ? t("Mixte", "Mixed")
    : null;

  const cadenceLabel =
    schedule.cadence === "daily" ? t("Quotidien", "Daily")
    : schedule.cadence === "3x_week" ? t("3×/semaine", "3×/week")
    : schedule.cadence === "weekly" ? t("Hebdomadaire", "Weekly")
    : schedule.cadence === "custom" ? t("Personnalisé", "Custom")
    : null;

  const DAY_NAMES = lang === "fr"
    ? ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysLabel = schedule.days?.length
    ? schedule.days.map((d) => DAY_NAMES[d] ?? d).join(" · ")
    : null;

  const startDate = schedule.startDate ?? campaign?.startDate;
  const startLabel = (() => {
    if (!startDate) return null;
    const d = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(+d)) return startDate;
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
  })();

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair bg-canvas/60 px-4 py-3 sm:px-5">
        <span className="section-label text-ink">{t("Campagne du parcours", "Journey campaign")}</span>
        {campaign ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
              campaign.status === "active"
                ? "bg-success-50 text-success-700 ring-1 ring-success-200"
                : "bg-canvas text-muted ring-1 ring-hair"
            }`}
          >
            {campaign.status === "active" && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
            )}
            {campaign.status === "active" ? t("Active", "Active") : t("En pause", "Paused")}
          </span>
        ) : (
          <span className="chip">{t("Parcours activé", "Setup activated")}</span>
        )}
      </div>

      {campaign && (
        <div className="border-b border-hair px-4 py-3 sm:px-5">
          <p className="truncate text-sm font-semibold text-ink">{campaign.name}</p>
          {campaign.objective && (
            <p className="mt-0.5 text-2xs uppercase tracking-wide text-muted">{campaign.objective}</p>
          )}
        </div>
      )}

      <div className="divide-y divide-hair">
        {networks.length > 0 && (
          <Row label={t("Réseaux", "Networks")}>
            <div className="flex flex-wrap gap-1.5">
              {networks.map((n) => {
                const meta = NETWORK_META[n.toLowerCase()];
                return (
                  <span
                    key={n}
                    className="rounded-full bg-canvas px-2.5 py-0.5 text-2xs font-semibold ring-1 ring-hair"
                    style={meta ? { color: meta.color } : undefined}
                  >
                    {meta?.label ?? n}
                  </span>
                );
              })}
            </div>
          </Row>
        )}
        {countries.length > 0 && (
          <Row label={t("Zone", "Zone")}>{zoneLabel(countries, lang)}</Row>
        )}
        {typeLabel && <Row label={t("Type", "Type")}>{typeLabel}</Row>}
        {cadenceLabel && (
          <Row label={t("Cadence", "Cadence")}>
            {cadenceLabel}
            {daysLabel && <span className="ml-2 text-xs text-muted">{daysLabel}</span>}
            {schedule.times && schedule.times.length > 0 && (
              <span className="ml-2 text-xs text-muted">{schedule.times.join(" · ")}</span>
            )}
          </Row>
        )}
        {startLabel && <Row label={t("Démarrage", "Start")}>{startLabel}</Row>}
        {next && (
          <Row label={t("Prochaine publication", "Next publication")}>
            <span className="font-medium text-primary-700">
              {new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(next)}
            </span>
          </Row>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-hair bg-canvas/40 px-4 py-2.5 sm:px-5">
        <Link href="/campaigns" className="text-2xs font-medium text-primary-600 hover:underline">
          {t("Gérer les campagnes →", "Manage campaigns →")}
        </Link>
        <Link href="/demarrage" className="text-2xs font-medium text-muted hover:text-ink hover:underline">
          {t("Revoir le parcours →", "Review the setup →")}
        </Link>
      </div>
    </div>
  );
}
