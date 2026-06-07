"use client";

import { useEffect, useState } from "react";
import { HelpDrawer } from "./HelpDrawer";

/**
 * Hôte de l'aide contextuelle. N'affiche plus de pastille flottante (qui
 * chevauchait le contenu) : l'aide s'ouvre depuis la rubrique « Aide » de la
 * barre latérale (sur le côté) ou via le raccourci clavier « ? ». Le panneau
 * lui-même glisse depuis le bord droit.
 *
 * Ouverture programmatique : `window.dispatchEvent(new Event("axon:help"))`.
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
