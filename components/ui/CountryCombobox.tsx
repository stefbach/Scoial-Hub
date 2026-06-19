"use client";

/**
 * Sélecteur de pays avec autocomplétion.
 * - Tape le nom du pays (ou le code) → filtre la liste COUNTRIES (drapeau + label).
 * - `value`/`onChange` portent l'ID ISO en minuscules (ex. "mu", "fr").
 * Dégradation : si l'utilisateur tape un code non listé, on le conserve tel quel.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryLabel } from "@/lib/scope";
import { useT, useLang } from "@/lib/i18n";

export function CountryCombobox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // #6 — libellés localisés dans la langue de l'interface (FR/EN), triés en conséquence.
  const localized = useMemo(
    () => COUNTRIES.map((c) => ({ ...c, label: countryLabel(c.id, lang) }))
      .sort((a, b) => a.label.localeCompare(b.label, lang)),
    [lang]
  );

  const selected = useMemo(
    () => localized.find((c) => c.id.toLowerCase() === value.toLowerCase()),
    [value, localized]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return localized;
    return localized.filter(
      (c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [query, localized]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function select(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  // Texte affiché dans le champ : la requête en cours, sinon le pays sélectionné.
  const displayValue = open
    ? query
    : selected
      ? `${selected.flag} ${selected.label}`
      : value;

  return (
    <div ref={ref} className="relative">
      <input
        className="input w-full"
        value={displayValue}
        placeholder={placeholder ?? t("Tapez un pays…", "Type a country…")}
        onFocus={() => { setOpen(true); setQuery(""); setHighlight(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[highlight]) select(filtered[highlight].id);
            else if (query.trim()) select(query.trim()); // code libre toléré
          } else if (e.key === "Escape") { setOpen(false); }
        }}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-hair bg-card py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-2xs text-muted">{t("Aucun pays. Entrée = utiliser le code saisi.", "No country. Enter = use the typed code.")}</li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => select(c.id)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === highlight ? "bg-primary-50 text-primary-700" : "text-ink hover:bg-canvas"}`}
                >
                  <span aria-hidden>{c.flag}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="text-2xs uppercase text-muted">{c.id}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
