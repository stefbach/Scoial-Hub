"use client";

import { useT } from "@/lib/i18n";

export interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  current: number; // 0-based index
}

export function Stepper({ steps, current }: StepperProps) {
  const t = useT();

  return (
    <nav aria-label={t("Étapes du tunnel de création", "Creation wizard steps")} className="mb-8">
      {/* Barre de progression */}
      <div className="relative mb-6">
        <div className="h-1 w-full rounded-full bg-hair" />
        <div
          className="absolute left-0 top-0 h-1 rounded-full bg-page transition-all duration-500"
          style={{ width: `${((current + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Indicateurs d'étapes */}
      <ol className="flex items-start gap-0" role="list">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                aria-current={active ? "step" : undefined}
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200",
                  done
                    ? "bg-page text-white"
                    : active
                    ? "border-2 border-page bg-card text-page"
                    : "border-2 border-hair bg-canvas text-muted",
                ].join(" ")}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={[
                  "text-center text-2xs font-medium leading-tight",
                  active ? "text-page" : done ? "text-ink" : "text-muted",
                ].join(" ")}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
