"use client";

import { useEffect, useState } from "react";
import { HelpDrawer } from "./HelpDrawer";
import { useT } from "@/lib/i18n";

/**
 * Bouton d'aide — pastille VIOLETTE fixe, en haut à droite, juste sous l'avatar.
 * Toujours visible sur chaque page, ne chevauche pas les actions du bas.
 * Ouvre le tutoriel contextuel. Raccourci clavier « ? ».
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  const t = useT();

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
        title={t("Aide / Tutoriel de la page (?)", "Page help / tutorial (?)")}
        className="
          fixed right-4 top-[4.25rem] z-30
          flex h-11 w-11 items-center justify-center rounded-full
          bg-page text-white shadow-lg ring-2 ring-white/70
          transition-all duration-150
          hover:brightness-110 hover:shadow-xl active:scale-95
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        "
      >
        <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M6.8 6.8A2.2 2.2 0 0 1 9 4.7c1.2 0 2.2.9 2.2 2.1 0 1.1-.8 1.6-1.4 2-.5.3-.8.6-.8 1.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="9" cy="13" r="0.95" fill="currentColor" />
        </svg>
      </button>

      <HelpDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
