"use client";

import { useEffect, useState } from "react";
import { HelpDrawer } from "./HelpDrawer";

/**
 * Hôte de l'aide contextuelle. N'affiche aucun bouton lui-même : l'aide s'ouvre
 * via le bouton « ? » du header (ou le raccourci clavier « ? »), en émettant
 * l'événement window "axon:help". Le panneau glisse depuis la droite et MASQUE
 * la page (overlay) ; on revient en arrière en le fermant (X / Échap / clic).
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);

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

  return <HelpDrawer open={open} onClose={() => setOpen(false)} />;
}
