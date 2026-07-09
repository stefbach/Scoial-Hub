"use client";

// Rail de progression du parcours assisté — moderne, cliquable, responsive.
// Affiche les 6 étapes ; l'utilisateur peut revenir/aller à une étape (parcours
// guidé mais non bloquant).

import { useOnboardingCtx } from "./context";
import { useT } from "@/lib/i18n";

export interface StepMeta {
  n: number;
  key: string;
  title: { fr: string; en: string };
  short: { fr: string; en: string };
}

export function Stepper({ steps }: { steps: StepMeta[] }) {
  const { state, goTo } = useOnboardingCtx();
  const t = useT();
  const current = state.step;

  const activeStep = steps.find((s) => s.n === current) ?? steps[0];

  return (
    <nav aria-label={t("Progression du parcours", "Onboarding progress")}>
      {/* Titre de l'étape courante — toujours visible, y compris en fenêtre
          étroite / écran partagé où les libellés du rail sont masqués (#4). */}
      {activeStep && (
        <div className="mb-2 flex items-center gap-2 lg:hidden">
          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-primary-700">
            {t(`Étape ${current}`, `Step ${current}`)} / {steps.length}
          </span>
          <span className="truncate text-sm font-semibold text-ink">
            {t(activeStep.title.fr, activeStep.title.en)}
          </span>
        </div>
      )}
      <ol className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
        {steps.map((s, i) => {
          const done = current > s.n;
          const active = current === s.n;
          return (
            <li
              key={s.key}
              // L'étape active garde sa largeur naturelle (shrink-0) sous lg :
              // son titre reste lisible en écran étroit/partagé au lieu d'être
              // tronqué à 2-3 caractères ; le rail défile si nécessaire (#32).
              className={`flex min-w-0 shrink-0 items-center gap-1.5 lg:gap-2 ${
                active ? "lg:flex-1 lg:shrink" : "sm:flex-1 sm:shrink"
              }`}
            >
              <button
                type="button"
                onClick={() => goTo(s.n)}
                aria-current={active ? "step" : undefined}
                // Infobulle : les étapes non actives n'affichent que leur numéro
                // (libellé masqué sous lg) — le titre est révélé au survol via le
                // `title` natif et annoncé aux lecteurs d'écran via `aria-label`.
                // (Un tooltip CSS positionné serait rogné par l'overflow-x du rail.)
                title={
                  active
                    ? undefined
                    : t(`Étape ${s.n} — ${s.title.fr}`, `Step ${s.n} — ${s.title.en}`)
                }
                aria-label={
                  active
                    ? undefined
                    : t(`Étape ${s.n} — ${s.title.fr}`, `Step ${s.n} — ${s.title.en}`)
                }
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-canvas"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    done
                      ? "bg-success-500 text-white"
                      : active
                      ? "bg-primary text-white ring-4 ring-primary-100"
                      : "bg-canvas text-muted ring-1 ring-hair"
                  }`}
                >
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.5l3 3 6-6.5"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    s.n
                  )}
                </span>
                <span className={`min-w-0 flex-col ${active ? "flex" : "hidden lg:flex"}`}>
                  <span
                    className={`truncate text-2xs font-semibold uppercase tracking-wide ${
                      active ? "text-primary-700" : done ? "text-success-700" : "text-muted"
                    }`}
                  >
                    {t(`Étape ${s.n}`, `Step ${s.n}`)}
                  </span>
                  <span
                    className={`truncate text-xs font-medium ${
                      active ? "text-ink" : "text-muted"
                    }`}
                  >
                    {t(s.short.fr, s.short.en)}
                  </span>
                </span>
              </button>
              {i < steps.length - 1 && (
                <span
                  className={`hidden h-px w-4 shrink-0 sm:block lg:w-8 ${
                    done ? "bg-success-500" : "bg-hair"
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
