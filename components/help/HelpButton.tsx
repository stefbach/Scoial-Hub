"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpDrawer } from "./HelpDrawer";
import { useT } from "@/lib/i18n";

/**
 * Bouton d'aide FLOTTANT (bas-droite) — pas dans l'en-tête.
 * Ouvre le tutoriel contextuel de la page. Raccourci clavier « ? ».
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  // Masque le bouton flottant quand une fenêtre modale / un tiroir est ouvert,
  // sinon il chevauche les actions de la modale (ex. le bouton « Continuer »).
  const [overlayOpen, setOverlayOpen] = useState(false);
  const t = useT();
  const pathname = usePathname();
  // Pages avec une barre d'action FIXE en bas (Retour / Continuer…) : le bouton
  // flottant chevaucherait le « Continuer ». On le masque sur ces parcours.
  const hasOwnBottomBar = pathname?.startsWith("/demarrage") ?? false;

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

  // Observe le DOM : présence d'un dialog/modale ouvert → on cache le bouton.
  useEffect(() => {
    const check = () =>
      setOverlayOpen(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "aria-modal"] });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {!overlayOpen && !hasOwnBottomBar && (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Ouvrir l'aide de cette page", "Open help for this page")}
        aria-expanded={open}
        title={t("Aide / Tutoriel de la page (?)", "Page help / tutorial (?)")}
        className="
          fixed bottom-5 right-5 z-30
          inline-flex items-center gap-2 rounded-full
          bg-page px-4 py-3 text-sm font-semibold text-white
          shadow-lg ring-1 ring-black/5
          transition-all duration-150
          hover:brightness-110 hover:shadow-xl
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2
          active:scale-[0.97]
          select-none
        "
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
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
        <span>{t("Aide", "Help")}</span>
      </button>
      )}

      <HelpDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
