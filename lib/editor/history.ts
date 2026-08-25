// Pile d'historique — annuler / rétablir sur le document de projet.
//
// L'éditeur n'avait aucun retour en arrière : une fois un effet appliqué, il
// était impossible de le retirer ou de l'ajuster. Avec un document de projet,
// annuler revient simplement à restaurer un état antérieur — il n'y a rien à
// « défaire » dans le média, puisqu'il n'a jamais été modifié.
//
// Module PUR : aucune dépendance, entièrement testable.

import type { EditorProject } from "./project";

/** Profondeur d'historique. Au-delà, les états les plus anciens sont oubliés. */
export const HISTORY_LIMIT = 50;

export interface History {
  /** États antérieurs, du plus ancien au plus récent. */
  past: EditorProject[];
  present: EditorProject;
  /** États annulés, réutilisables tant qu'aucune nouvelle action n'est posée. */
  future: EditorProject[];
}

export function initHistory(present: EditorProject): History {
  return { past: [], present, future: [] };
}

/**
 * Enregistre un nouvel état. Toute action neuve invalide la pile de
 * rétablissement : on ne peut pas rétablir une branche qu'on vient d'abandonner.
 */
export function push(h: History, next: EditorProject): History {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    future: [],
  };
}

export function canUndo(h: History): boolean {
  return h.past.length > 0;
}

export function canRedo(h: History): boolean {
  return h.future.length > 0;
}

export function undo(h: History): History {
  if (!canUndo(h)) return h;
  const previous = h.past[h.past.length - 1];
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
  };
}

export function redo(h: History): History {
  if (!canRedo(h)) return h;
  const [next, ...rest] = h.future;
  return {
    past: [...h.past, h.present],
    present: next,
    future: rest,
  };
}
