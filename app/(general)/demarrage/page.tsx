"use client";

// ── Démarrage assisté ────────────────────────────────────────────────────────
// Parcours guidé en 6 étapes où l'IA fait le travail et propose à chaque étape.
// Coque : header + rail de progression + étape courante + navigation.
// L'état est persisté (reprise possible à tout moment, sur tout appareil).

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OnboardingProvider, useOnboardingCtx } from "@/components/onboarding/context";
import { Stepper, type StepMeta } from "@/components/onboarding/Stepper";
import { BrandConsultant } from "@/components/onboarding/BrandConsultant";
import { useT } from "@/lib/i18n";

import Step1Identity from "@/components/onboarding/Step1Identity";
import Step2Objectives from "@/components/onboarding/Step2Objectives";
import Step3Competition from "@/components/onboarding/Step3Competition";
import Step4Creative from "@/components/onboarding/Step4Creative";
import Step5Agents from "@/components/onboarding/Step5Agents";
import Step6Diffusion from "@/components/onboarding/Step6Diffusion";

const STEPS: StepMeta[] = [
  { n: 1, key: "identity", title: { fr: "Mon identité", en: "My identity" }, short: { fr: "Identité", en: "Identity" } },
  { n: 2, key: "objectives", title: { fr: "Mes objectifs", en: "My objectives" }, short: { fr: "Objectifs", en: "Objectives" } },
  { n: 3, key: "competition", title: { fr: "Concurrence & mots-clés", en: "Competition & keywords" }, short: { fr: "Concurrence", en: "Competition" } },
  { n: 4, key: "creative", title: { fr: "Création des visuels", en: "Creative assets" }, short: { fr: "Création", en: "Creative" } },
  { n: 5, key: "agents", title: { fr: "Lancer les agents IA", en: "Launch AI agents" }, short: { fr: "Agents IA", en: "AI agents" } },
  { n: 6, key: "diffusion", title: { fr: "Diffusion & pilotage", en: "Distribution & piloting" }, short: { fr: "Diffusion", en: "Distribution" } },
];

function StepBody() {
  const { state } = useOnboardingCtx();
  switch (state.step) {
    case 1: return <Step1Identity />;
    case 2: return <Step2Objectives />;
    case 3: return <Step3Competition />;
    case 4: return <Step4Creative />;
    case 5: return <Step5Agents />;
    case 6: return <Step6Diffusion />;
    default: return <Step1Identity />;
  }
}

// Bandeau de confirmation après la création d'une société (?new=1).
// Compense l'absence de toast de création signalée par l'audit.
function WelcomeBanner() {
  const t = useT();
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || params.get("new") !== "1") return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-success-200 bg-success-50 p-3" role="status">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-100 text-sm font-bold text-success-600">
        ✓
      </span>
      <p className="flex-1 text-sm font-medium text-success-700">
        {t("Société créée ✓ — construisons son profil", "Company created ✓ — let's build its profile")}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("Fermer", "Dismiss")}
        className="shrink-0 rounded-md px-1.5 text-success-600 hover:bg-success-100"
      >
        ✕
      </button>
    </div>
  );
}

function Shell() {
  const { state, loading, saving, back, skip, next, totalSteps, profile, applyProfile, companyId, companyName } = useOnboardingCtx();
  const t = useT();
  const [skipConsult, setSkipConsult] = useState(false);
  const meta = STEPS.find((s) => s.n === state.step) ?? STEPS[0];
  const isFirst = state.step <= 1;
  const isLast = state.step >= totalSteps;
  const pct = Math.round(((state.step - 1) / (totalSteps - 1)) * 100);

  // ── Étape 0 — Consultant de marque ────────────────────────────────────────
  // Pour une marque qui démarre (jamais analysée et philosophie non verrouillée),
  // on commence par construire et verrouiller l'ADN avec le consultant IA, comme
  // un vrai entretien. Les marques déjà profilées passent directement au parcours.
  if (!loading && !profile.philosophyLocked && !profile.analyzedAt && !skipConsult) {
    return (
      <div className="animate-fade-in space-y-6">
        <Suspense fallback={null}>
          <WelcomeBanner />
        </Suspense>
        <header className="space-y-1">
          <p className="section-label text-primary-500">{t("Démarrage assisté · Étape 0", "Assisted onboarding · Step 0")}</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t("Construisons l'identité de votre marque", "Let's build your brand identity")}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            {t(
              "Avant de lancer la moindre campagne, on verrouille la philosophie : qui vous êtes, ce que vous voulez dire, et l'univers visuel. Discutez avec le consultant comme avec un vrai directeur de marque.",
              "Before launching any campaign, we lock the philosophy: who you are, what you want to say, and the visual world. Chat with the consultant like a real brand director."
            )}
          </p>
        </header>
        <BrandConsultant
          companyId={companyId}
          companyName={companyName}
          onLocked={(p) => applyProfile(p)}
        />
        <div className="flex justify-center border-t border-hair pt-4">
          <button type="button" onClick={() => setSkipConsult(true)} className="btn-ghost text-sm text-muted">
            {t("Construire l'identité plus tard →", "Build the identity later →")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Confirmation de création de société */}
      <Suspense fallback={null}>
        <WelcomeBanner />
      </Suspense>

      {/* En-tête */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="section-label text-primary-500">{t("Démarrage assisté", "Assisted onboarding")}</p>
          <span className="text-2xs font-medium text-muted">
            {saving ? t("Enregistrement…", "Saving…") : state.completed ? t("Dispositif actif ✓", "Setup active ✓") : t("Sauvegarde auto", "Auto-saved")}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t(meta.title.fr, meta.title.en)}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "L'IA analyse votre marque puis construit votre dispositif. Vous êtes guidé à chaque étape — et vous gardez la main.",
            "The AI analyses your brand then builds your setup. You are guided at every step — and you stay in control."
          )}
        </p>
      </header>

      {/* Rail de progression */}
      <div className="card p-4 sm:p-5">
        <Stepper steps={STEPS} />
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-page transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Corps de l'étape */}
      {loading ? (
        <div className="card flex items-center justify-center p-12 text-sm text-muted">
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-hair border-t-primary" />
          {t("Chargement de votre parcours…", "Loading your journey…")}
        </div>
      ) : (
        <StepBody />
      )}

      {/* Navigation */}
      {!loading && (
        <div className="flex items-center justify-between gap-3 border-t border-hair pt-4">
          <button
            type="button"
            onClick={back}
            disabled={isFirst}
            className={`btn-secondary text-sm ${isFirst ? "pointer-events-none opacity-40" : ""}`}
          >
            ← {t("Retour", "Back")}
          </button>
          <div className="flex items-center gap-2">
            {!isLast && (
              <button type="button" onClick={skip} className="btn-ghost text-sm text-muted">
                {t("Passer cette étape", "Skip this step")}
              </button>
            )}
            {!isLast && (
              <button type="button" onClick={next} className="btn-primary text-sm">
                {t("Continuer", "Continue")} →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemarragePage() {
  return (
    <OnboardingProvider>
      <Shell />
    </OnboardingProvider>
  );
}
