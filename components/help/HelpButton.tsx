"use client";

import { useEffect, useState } from "react";
import { HelpDrawer } from "./HelpDrawer";
import { useT } from "@/lib/i18n";

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const t = useT();

  // Raccourci clavier : « ? » ouvre l'aide (hors champs de saisie).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Ouvrir l'aide de cette page", "Open help for this page")}
        aria-expanded={open}
        title={t("Aide de la page (?)", "Page help (?)")}
        className="
          inline-flex items-center gap-1.5 rounded-full
          border border-primary-200 bg-primary-50
          px-3 py-1.5 text-sm font-semibold text-primary-700
          shadow-xs
          transition-all duration-[150ms]
          hover:border-primary-300 hover:bg-primary-100 hover:shadow-sm
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-primary-500 focus-visible:ring-offset-1
          active:scale-[0.98]
          select-none
        "
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M5.3 5.2A1.7 1.7 0 0 1 7 3.6c.94 0 1.7.7 1.7 1.6 0 .9-.6 1.3-1.1 1.6-.4.25-.6.5-.6 1"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="7" cy="10.2" r="0.7" fill="currentColor" />
        </svg>
        <span className="hidden sm:inline">{t("Aide", "Help")}</span>
      </button>

      <HelpDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
