/**
 * lib/composer/apply-formatting.ts
 *
 * Logique PURE (aucun DOM/React) derrière components/composer/FormattingToolbar.tsx
 * — retour client Rosiane #6, BUGS-SocialHub35. Séparée du composant pour
 * rester testable sans moteur de rendu (cf. scripts/verify-formatting-toolbar.ts),
 * comme lib/linkedin-format.ts dont ce module réutilise les fonctions Unicode.
 */

import { toUnicodeBold, toUnicodeItalic } from "@/lib/linkedin-format";
import type { FormattingMode } from "@/lib/composer/formatting-types";

export interface FormattingResult {
  next: string;
  /** Sélection à restaurer dans le champ après application (couvre le texte inséré). */
  selStart: number;
  selEnd: number;
}

/**
 * Applique gras/italique à la sélection [start, end) de `value`.
 * - mode "markdown" (LinkedIn) : entoure de `**`/`*`, converti en Unicode natif
 *   à la publication (lib/linkedin-format.ts) — reste éditable en clair.
 * - mode "unicode" (Facebook/Instagram/TikTok) : aucune conversion à la
 *   publication pour ces réseaux → la sélection est remplacée directement par
 *   son équivalent Unicode stylé.
 * Sans sélection (start === end), un texte-repère est inséré et sélectionné,
 * prêt à être retapé par l'utilisateur.
 */
export function applyWrapFormatting(
  value: string,
  start: number,
  end: number,
  kind: "bold" | "italic",
  mode: FormattingMode,
  placeholder: string
): FormattingResult {
  const selected = value.slice(start, end);
  const raw = selected || placeholder;

  const inserted =
    mode === "markdown"
      ? kind === "bold"
        ? `**${raw}**`
        : `*${raw}*`
      : kind === "bold"
      ? toUnicodeBold(raw)
      : toUnicodeItalic(raw);

  const next = value.slice(0, start) + inserted + value.slice(end);
  const markerLen = mode === "markdown" ? (kind === "bold" ? 2 : 1) : 0;
  return { next, selStart: start + markerLen, selEnd: start + markerLen + raw.length };
}

/** Insère `text` (typiquement un emoji) à la position du curseur/de la sélection. */
export function insertAtCursor(value: string, start: number, end: number, text: string): FormattingResult {
  const next = value.slice(0, start) + text + value.slice(end);
  const pos = start + text.length;
  return { next, selStart: pos, selEnd: pos };
}
