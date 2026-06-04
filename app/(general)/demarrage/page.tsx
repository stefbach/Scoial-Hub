"use client";

// ── Démarrage assisté ────────────────────────────────────────────────────────
// Parcours guidé en 6 étapes où l'IA fait le travail et propose à chaque étape.
// Coque : header + rail de progression + étape courante + navigation.
// L'état est persisté (reprise possible à tout moment, sur tout appareil).

import { OnboardingProvider, useOnboardingCtx } from "@/components/onboarding/context";
import { Stepper, type StepMeta } from "@/components/onboarding/Stepper";
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

function Shell() {
  const { state, loading, saving, back, skip, next, totalSteps } = useOnboardingCtx();
  const t = useT();
  const meta = STEPS.find((s) => s.n === state.step) ?? STEPS[0];
  const isFirst = state.step <= 1;
  const isLast = state.step >= totalSteps;
  const pct = Math.round(((state.step - 1) / (totalSteps - 1)) * 100);

  return (
    <div className="animate-fade-in space-y-6">
      {/* En-tête */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="section-label text-primary-500">{t("Démarrage assisté", "Assisted onboarding")}</p>
          <span className="text-2xs font-medium text-muted">
            {saving ? t("Enregistrement…", "Saving…") : state.completed ? t("Parcours terminé ✓", "Onboarding complete ✓") : t("Sauvegarde auto", "Auto-saved")}
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
