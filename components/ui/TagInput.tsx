"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

export function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const tr = useT();
  const ph = placeholder ?? tr("Ajouter un tag…", "Add a tag…");
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim().replace(/^#/, "");
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border-hair border-hair bg-card p-2">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded bg-canvas px-1.5 py-0.5 text-2xs text-ink"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove ${t}`}
            className="text-muted hover:text-ink"
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={tags.length ? "" : ph}
        className="min-w-[80px] flex-1 bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none"
      />
    </div>
  );
}
