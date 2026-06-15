"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* Sélecteur des éléments naturellement focusables, pour le focus-trap. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Mémorise l'élément focalisé avant l'ouverture pour le restaurer à la fermeture.
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Portal vers <body> : garantit que le scrim couvre TOUTE la page, même si un
  // ancêtre a un transform/filter/backdrop (qui « piège » sinon position:fixed).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Focus initial : le 1er élément focusable du panneau, sinon le panneau lui-même.
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const el = panelRef.current;
      if (!el) return;
      const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      if (focusables.length === 0) {
        // Garde le focus sur le panneau s'il n'y a rien de focusable dedans.
        e.preventDefault();
        el.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Tab/Shift+Tab cyclent à l'intérieur du panneau.
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restaure le focus à l'élément précédent à la fermeture.
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    /* Scrim: full-screen translucent overlay with blur — never an opaque grey box.
       Clicking the scrim (but not the panel) closes the modal. */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel: stops click propagation so clicking inside never closes the modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`relative mx-2 w-full ${width} max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-card shadow-xl outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
