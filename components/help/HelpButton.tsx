"use client";

import { useEffect, useState } from "react";
import { HelpDrawer } from "./HelpDrawer";
import { useT } from "@/lib/i18n";

/**
 * Bouton d'aide — placé dans l'EN-TÊTE (barre du haut), à côté du sélecteur de
 * langue. Toujours visible, ne chevauche jamais les actions de page (modales,
 * barres d'action en bas…). Ouvre le tutoriel contextuel. Raccourci clavier « ? ».
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
          flex h-9 w-9 shrink-0 items-center justify-center rounded-full
          bg-primary-50 text-primary-700 ring-1 ring-primary-200
          shadow-xs
          transition-colors duration-150
          hover:bg-primary-100 hover:text-primary-800
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
        "
      >
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M6.8 6.8A2.2 2.2 0 0 1 9 4.7c1.2 0 2.2.9 2.2 2.1 0 1.1-.8 1.6-1.4 2-.5.3-.8.6-.8 1.3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="9" cy="13" r="0.9" fill="currentColor" />
        </svg>
      </button>

      <HelpDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
