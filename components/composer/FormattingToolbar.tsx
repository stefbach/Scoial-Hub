"use client";

// components/composer/FormattingToolbar.tsx
//
// Barre d'outils de mise en forme (gras/italique/emoji) — retour client
// Rosiane #6, BUGS-SocialHub35 : ces options n'existaient nulle part, ni dans
// Composer ni dans les espaces réseaux.
//
// Deux régimes, selon que le réseau visé interprète du markdown à la
// publication :
//   - "markdown" (LinkedIn) : insère `**gras**` / `*italique*`, converti en
//     Unicode natif à la publication par lib/linkedin-format.ts (déjà en
//     place) — le texte reste éditable/undo-able en clair dans le champ.
//   - "unicode" (Facebook/Instagram/TikTok) : leur API Graph est du texte
//     brut, sans AUCUNE conversion à la publication — la mise en forme doit
//     donc être appliquée immédiatement au texte lui-même, avec les mêmes
//     caractères Unicode « Mathematical Sans-Serif » que LinkedIn utilise en
//     coulisses (lib/linkedin-format.ts, fonctions déjà génériques).

import { useEffect, useRef, useState, type RefObject } from "react";
import { useT } from "@/lib/i18n";
import { applyWrapFormatting, insertAtCursor } from "@/lib/composer/apply-formatting";
import type { FormattingMode } from "@/lib/composer/formatting-types";

export type { FormattingMode } from "@/lib/composer/formatting-types";

const EMOJIS = ["😀", "😂", "🎉", "🚀", "❤️", "👍", "🔥", "✨", "📣", "💡", "✅", "👀", "🙌", "😉", "📅", "📈"];

export interface FormattingToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
  mode: FormattingMode;
  disabled?: boolean;
}

export function FormattingToolbar({ textareaRef, value, onChange, mode, disabled }: FormattingToolbarProps) {
  const t = useT();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!emojiOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [emojiOpen]);

  function selectionBounds(): { start: number; end: number } {
    const el = textareaRef.current;
    return { start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length };
  }

  function focusSelection(start: number, end: number) {
    // Sans ce recentrage, chaque clic sur un bouton de la barre faisait
    // perdre le focus (et donc la position d'écriture) du champ de texte.
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(start, end);
    });
  }

  function applyWrap(kind: "bold" | "italic") {
    const { start, end } = selectionBounds();
    const placeholder = kind === "bold" ? t("texte en gras", "bold text") : t("texte en italique", "italic text");
    const result = applyWrapFormatting(value, start, end, kind, mode, placeholder);
    onChange(result.next);
    focusSelection(result.selStart, result.selEnd);
  }

  function insertEmoji(emoji: string) {
    const { start, end } = selectionBounds();
    const result = insertAtCursor(value, start, end, emoji);
    onChange(result.next);
    setEmojiOpen(false);
    focusSelection(result.selStart, result.selEnd);
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => applyWrap("bold")}
        title={t("Gras", "Bold")}
        aria-label={t("Gras", "Bold")}
        className="btn-secondary flex h-7 w-7 items-center justify-center rounded-md p-0 text-xs font-bold disabled:opacity-50"
      >
        B
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => applyWrap("italic")}
        title={t("Italique", "Italic")}
        aria-label={t("Italique", "Italic")}
        className="btn-secondary flex h-7 w-7 items-center justify-center rounded-md p-0 text-xs italic disabled:opacity-50"
      >
        I
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEmojiOpen((v) => !v)}
        title={t("Emoji", "Emoji")}
        aria-label={t("Emoji", "Emoji")}
        className="btn-secondary flex h-7 w-7 items-center justify-center rounded-md p-0 text-xs disabled:opacity-50"
      >
        🙂
      </button>
      {emojiOpen && (
        <div className="absolute left-0 top-8 z-10 grid grid-cols-6 gap-0.5 rounded-lg border border-hair bg-card p-1.5 shadow-lg">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertEmoji(e)}
              className="rounded p-1 text-base leading-none hover:bg-canvas"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
