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

  return (
    <nav aria-label={t("Progression du parcours", "Onboarding progress")}>
      <ol className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
        {steps.map((s, i) => {
          const done = current > s.n;
          const active = current === s.n;
          return (
            <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => goTo(s.n)}
                aria-current={active ? "step" : undefined}
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
                <span className="hidden min-w-0 flex-col lg:flex">
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
