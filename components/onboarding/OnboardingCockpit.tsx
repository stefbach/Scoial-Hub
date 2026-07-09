"use client";

// ── OnboardingCockpit ────────────────────────────────────────────────────────
// Bannière d'accueil affichée en haut du tableau de bord.
// • Parcours NON terminé → héro premium gradient prune/violet avec barre de
//   progression et CTA vers /demarrage.
// • Parcours terminé     → bandeau succès "Pilotage actif" compact.
// • Erreur de fetch      → fallback héro "Démarrer maintenant" (jamais vide).
// • Chargement           → squelette slim, non bloquant.

import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { useOnboardingStatus, type OnboardingStatus } from "@/components/onboarding/useOnboardingStatus";

// Nombre total d'étapes — synchronisé avec TOTAL_STEPS dans lib/onboarding/types.ts
const TOTAL_STEPS = 6;

// ── Icônes inline SVG (aucune dépendance externe) ──────────────────────────

function IconRocket({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.894 2.553a1 1 0 0 0-1.788 0l-7 14a1 1 0 0 0 1.169 1.409l.528-.176 4.5 4.5.176-.528A1 1 0 0 0 9.5 21H10v-1h.5a1 1 0 0 0 .95-.691l.176-.528 4.5-4.5.528.176A1 1 0 0 0 17.894 13l-7-10.447z" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconSparkles({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 0 0-1.898 0l-.5 1.738a1 1 0 0 1-.68.681l-1.738.5a1 1 0 0 0 0 1.897l1.738.5a1 1 0 0 1 .68.681l.5 1.738a1 1 0 0 0 1.898 0l.5-1.738a1 1 0 0 1 .68-.681l1.738-.5a1 1 0 0 0 0-1.897l-1.738-.5a1 1 0 0 1-.68-.681l-.5-1.738z" />
    </svg>
  );
}

// ── Squelette de chargement ─────────────────────────────────────────────────

function SkeletonBanner() {
  return (
    <div className="animate-pulse rounded-2xl bg-primary-100 p-6" aria-hidden="true">
      <div className="mb-3 h-3 w-24 rounded-full bg-primary-200" />
      <div className="mb-2 h-6 w-64 rounded-full bg-primary-200" />
      <div className="mb-4 h-3 w-48 rounded-full bg-primary-200" />
      <div className="h-2 w-full rounded-full bg-primary-200" />
    </div>
  );
}

// ── Bandeau "Pilotage actif" (parcours terminé) ─────────────────────────────

function PilotageActiveStrip({ companyName }: { companyName: string }) {
  const t = useT();

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border-l-4 border-success-500 bg-success-50 px-5 py-4 shadow-xs sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-label={t("Pilotage actif", "Active piloting")}
    >
      {/* Icône + texte */}
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-100">
          <IconCheck className="h-4 w-4 text-success-700" />
        </span>
        <div>
          <p className="text-sm font-semibold text-success-700">
            {t("Pilotage actif", "Active piloting")}
          </p>
          <p className="text-2xs text-success-600">
            {t(
              `${companyName} est en mode automatique. Vos agents IA travaillent.`,
              `${companyName} is on autopilot. Your AI agents are working.`
            )}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-11 sm:pl-0">
        <Link
          href="/demarrage?new=1"
          className="btn-primary text-sm"
        >
          {t("Nouvelle campagne", "New campaign")}
          <IconArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
        <Link
          href="/pilotage"
          className="btn-secondary text-sm"
        >
          {t("Voir le pilotage", "Open piloting")}
        </Link>
        <Link
          href="/demarrage"
          className="btn-secondary text-sm"
        >
          {t("Revoir mon parcours", "Review setup")}
        </Link>
      </div>
    </div>
  );
}

// ── Héro "Démarrer / Reprendre" (parcours non terminé) ─────────────────────

interface HeroBannerProps {
  companyName: string;
  step: number;
}

function HeroBanner({ companyName, step }: HeroBannerProps) {
  const t = useT();

  // Progression : clampée entre 0 et 100
  const progressPct = Math.min(100, Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100));
  const isNew = step <= 1;

  // Libellé CTA
  const ctaLabel = isNew
    ? t("Démarrer maintenant", "Start now")
    : t("Reprendre le parcours", "Resume setup");

  // Petits indices d'étapes affichés comme pills
  const stepHints = [
    t("Identité", "Identity"),
    t("Objectifs", "Objectives"),
    t("Diffusion", "Distribution"),
  ];

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 shadow-lg sm:p-8"
      style={{
        background: "linear-gradient(135deg, #5b2d8e 0%, #6d28d9 50%, #7c3aed 100%)",
      }}
      role="region"
      aria-label={t("Démarrage assisté", "Assisted onboarding")}
    >
      {/* Décoration de fond — cercle lumineux subtil */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #bb9fff 0%, transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #ece3ff 0%, transparent 70%)" }}
      />

      {/* Contenu relatif (au-dessus des décorations) */}
      <div className="relative z-10">

        {/* Eyebrow — label "Assistant" */}
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
            <IconSparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-2xs font-semibold uppercase tracking-widest text-white/80">
            {t("Assistant IA · Démarrage", "AI Assistant · Onboarding")}
          </span>
        </div>

        {/* Titre principal */}
        <h2 className="mb-2 text-xl font-bold leading-tight text-white sm:text-2xl">
          {t(
            `Mettez ${companyName} en pilotage automatique`,
            `Put ${companyName} on autopilot`
          )}
        </h2>

        {/* Sous-titre */}
        <p className="mb-5 max-w-xl text-sm leading-relaxed text-white/80">
          {isNew
            ? t(
                "L'IA analyse votre marque et construit votre dispositif complet en 6 étapes guidées — moins de 10 minutes.",
                "The AI analyses your brand and builds your full setup in 6 guided steps — less than 10 minutes."
              )
            : t(
                `Vous en êtes à l'étape ${step} sur ${TOTAL_STEPS}. Continuez pour activer le pilotage automatique.`,
                `You are on step ${step} of ${TOTAL_STEPS}. Continue to activate autopilot.`
              )}
        </p>

        {/* Barre de progression */}
        <div className="mb-5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-2xs font-medium text-white/70">
              {t(`Étape ${step} / ${TOTAL_STEPS}`, `Step ${step} / ${TOTAL_STEPS}`)}
            </span>
            <span className="text-2xs font-semibold text-white">
              {progressPct}%
            </span>
          </div>
          {/* Piste */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #ece3ff 0%, #ffffff 100%)",
              }}
            />
          </div>
        </div>

        {/* Pills indicateurs d'étapes */}
        <div className="mb-6 flex flex-wrap gap-2">
          {stepHints.map((hint) => (
            <span
              key={hint}
              className="inline-flex items-center rounded-full bg-white/15 px-3 py-0.5 text-2xs font-medium text-white/90"
            >
              {hint}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/demarrage"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-page shadow-md transition-all duration-[120ms] hover:bg-primary-50 hover:shadow-lg active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          {ctaLabel}
          <IconArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ── Composant principal exporté ─────────────────────────────────────────────

export function OnboardingCockpit({ status }: { status?: OnboardingStatus }) {
  const { company } = useCompany();
  const companyName = company.name;

  // Statut partagé (le tableau de bord peut le fournir pour éviter un 2e fetch).
  const fallback = useOnboardingStatus();
  const { loading, completed, step } = status ?? fallback;

  // Pendant le chargement : squelette slim, non bloquant
  if (loading) {
    return <SkeletonBanner />;
  }

  // Parcours terminé → bandeau succès compact
  if (completed) {
    return <PilotageActiveStrip companyName={companyName} />;
  }

  // Parcours en cours ou non commencé → héro proéminent
  return <HeroBanner companyName={companyName} step={step} />;
}
