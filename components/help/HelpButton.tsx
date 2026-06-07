"use client";

import { useEffect, useState } from "react";
import { HelpDrawer } from "./HelpDrawer";
import { useT } from "@/lib/i18n";

/**
 * Bouton d'aide « ? » flottant (en bas à droite, ne chevauche aucun contenu de
 * page) : un clic ouvre l'aide contextuelle en PANNEAU LATÉRAL (glisse depuis la
 * droite). Raccourci clavier « ? ». Peut aussi être ouvert depuis la rubrique
 * « Aide » de la barre latérale via l'événement `window` "axon:help".
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
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("axon:help", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("axon:help", onOpen);
    };
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
          fixed bottom-5 right-5 z-40
          flex h-12 w-12 items-center justify-center rounded-full
          bg-page text-white shadow-xl ring-2 ring-white/15
          transition-all duration-150
          hover:brightness-110 hover:shadow-2xl active:scale-95
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2
        "
      >
        <svg width="22" height="22" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M6.8 6.8A2.2 2.2 0 0 1 9 4.7c1.2 0 2.2.9 2.2 2.1 0 1.1-.8 1.6-1.4 2-.5.3-.8.6-.8 1.3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="9" cy="13" r="1" fill="currentColor" />
        </svg>
      </button>

      <HelpDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
