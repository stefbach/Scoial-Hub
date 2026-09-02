"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Enveloppe un contenu qui défile horizontalement (tableau dense, etc.) et
 * affiche un dégradé de bord tant qu'il reste du contenu à découvrir dans
 * cette direction — l'indice visuel qui manquait pour signaler qu'un tableau
 * scrollable ne montre pas tout (cf. docs/UX_REDESIGN_2026.md § 4).
 * Remplace un simple `<div className="overflow-x-auto">` — l'API est
 * identique (mêmes enfants), donc sans risque pour la logique des tableaux.
 */
export function ScrollFade({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();

    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className={`overflow-x-auto ${className}`}>
        {children}
      </div>
      {canLeft && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent"
        />
      )}
      {canRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent"
        />
      )}
    </div>
  );
}
