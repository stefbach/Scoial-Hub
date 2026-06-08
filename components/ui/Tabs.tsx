"use client";

import { useState } from "react";

/* Tabs & Pills — palette Prune-Améthyste synchronisée */
export function Tabs({
  tabs,
  className = "",
  defaultActiveId,
}: {
  tabs: { id: string; label: React.ReactNode; content: React.ReactNode }[];
  className?: string;
  defaultActiveId?: string;
}) {
  const [active, setActive] = useState(defaultActiveId ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active);

  return (
    <div className={className}>
      {/* Barre d'onglets */}
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-hair"
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${t.id}`}
              onClick={() => setActive(t.id)}
              className={[
                "relative -mb-px shrink-0 px-2 pb-2.5 pt-1 text-sm font-medium sm:px-3",
                "transition-colors duration-[120ms]",
                // Anneau focus améthyste
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 rounded-t",
                isActive
                  ? "text-ink"
                  : "text-muted hover:text-ink/80",
              ].join(" ")}
            >
              {t.label}
              {/* Indicateur actif — barre prune-violet en bas */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-page"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div
        id={`tabpanel-${active}`}
        role="tabpanel"
        className="pt-4"
      >
        {current?.content}
      </div>
    </div>
  );
}

export function Pills({
  options,
  defaultId,
  onChange,
  tone = "default",
}: {
  options: { id: string; label: string }[];
  defaultId?: string;
  onChange?: (id: string) => void;
  tone?: "default" | "ai";
}) {
  const [active, setActive] = useState(defaultId ?? options[0]?.id);

  /* Actif default → fond améthyste doux (primary) au lieu de ai-textbg */
  const activeCls =
    tone === "ai"
      ? "bg-ai-visual text-white shadow-xs"
      : "bg-primary-100 text-primary-700 ring-1 ring-primary-400/30";

  /* Inactif → bordure lavande, hover améthyste légère */
  const inactiveCls =
    "border border-hair bg-card text-ink hover:bg-canvas hover:border-[#bb9fff]";

  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {options.map((o) => {
        const isActive = o.id === active;
        return (
          <button
            key={o.id}
            onClick={() => {
              setActive(o.id);
              onChange?.(o.id);
            }}
            aria-pressed={isActive}
            className={[
              "rounded-lg px-2.5 py-1 text-2xs font-medium",
              "transition-all duration-[120ms]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40",
              isActive ? activeCls : inactiveCls,
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
