"use client";

import { useState } from "react";

export function Tabs({
  tabs,
  className = "",
}: {
  tabs: { id: string; label: React.ReactNode; content: React.ReactNode }[];
  className?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active);
  return (
    <div className={className}>
      <div className="flex gap-5 border-b-hair border-hair">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm ${
              t.id === active
                ? "border-page font-medium text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{current?.content}</div>
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
  const activeCls =
    tone === "ai"
      ? "bg-ai-visual text-white"
      : "bg-ai-textbg text-ai-text ring-1 ring-ai-text/20";
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => {
            setActive(o.id);
            onChange?.(o.id);
          }}
          className={`rounded-md px-2.5 py-1 text-2xs font-medium ${
            o.id === active ? activeCls : "border-hair border-hair bg-card text-ink hover:bg-canvas"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
