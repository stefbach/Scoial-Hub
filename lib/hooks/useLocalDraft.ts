"use client";

// lib/hooks/useLocalDraft.ts
//
// Autosave LÉGER (localStorage, par navigateur) pour les compositions qui
// n'ont pas encore de ligne en base — le lot « série » en cours de rédaction
// dans les espaces réseaux (Facebook/Instagram/TikTok/LinkedIn), avant tout
// « Programmer »/« Publier ». Retour client Rosiane #2 : le texte et/ou le
// visuel déjà générés disparaissaient dès qu'on quittait la section sans
// publier ni programmer.
//
// Distinct de l'autosave de Compose (app/(organic)/compose/page.tsx), qui
// écrit une vraie ligne `sh_scheduled_posts` (statut "draft") en base — ce
// module-ci vise un cas plus léger (brouillon de lot, pas encore un post
// individuel) et n'a donc pas besoin de persistance serveur ni de partage
// entre appareils : survivre à une navigation dans le MÊME navigateur suffit
// à couvrir le cas décrit.

import { useEffect } from "react";

export function useLocalDraftAutosave<T>(
  key: string | null,
  value: T,
  opts: { delayMs?: number; enabled?: boolean } = {}
): void {
  const { delayMs = 800, enabled = true } = opts;
  const serialized = JSON.stringify(value);

  useEffect(() => {
    if (!enabled || !key) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(key, serialized);
      } catch {
        /* stockage plein/indisponible (navigation privée…) — non bloquant */
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [key, serialized, delayMs, enabled]);
}

export function loadLocalDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
