"use client";

/**
 * Autocomplétion de villes pour le(s) pays sélectionné(s).
 * - `countries` : codes ISO2 (ex. ["FR","MU"]) — restreint les suggestions.
 * - `onAdd(name)` : appelé quand une ville est choisie.
 * Source : /api/geo/cities (Nominatim/OpenStreetMap). Si aucun pays n'est
 * choisi, on invite d'abord à sélectionner un pays. Texte libre toléré (Entrée).
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

interface CityOpt { name: string; label: string }

export function CityCombobox({
  countries,
  onAdd,
  placeholder,
}: {
  countries: string[];
  onAdd: (name: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<CityOpt[]>([]);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const cc = countries.map((c) => c.toLowerCase()).join(",");
  const noCountry = countries.length === 0;

  // Fermeture au clic extérieur.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Débounce de la recherche.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setOpts([]); return; }
    const id = ++reqId.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo/cities?country=${encodeURIComponent(cc)}&q=${encodeURIComponent(term)}`);
        const data = (await res.json()) as { cities?: CityOpt[] };
        if (id === reqId.current) { setOpts(data.cities ?? []); setHighlight(0); }
      } catch {
        if (id === reqId.current) setOpts([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, cc]);

  function choose(name: string) {
    if (!name.trim()) return;
    onAdd(name.trim());
    setQuery("");
    setOpts([]);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        className="input w-full"
        value={query}
        disabled={noCountry}
        placeholder={
          noCountry
            ? t("Choisissez d'abord un pays ci-dessus", "Pick a country above first")
            : placeholder ?? t("Tapez une ville…", "Type a city…")
        }
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, opts.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") {
            e.preventDefault();
            if (opts[highlight]) choose(opts[highlight].name);
            else if (query.trim()) choose(query.trim()); // texte libre toléré
          } else if (e.key === "Escape") { setOpen(false); }
        }}
      />
      {open && !noCountry && (query.trim().length >= 2) && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-hair bg-card py-1 shadow-lg">
          {loading && <li className="px-3 py-2 text-2xs text-muted">{t("Recherche…", "Searching…")}</li>}
          {!loading && opts.length === 0 && (
            <li className="px-3 py-2 text-2xs text-muted">{t("Aucune ville. Entrée = utiliser la saisie.", "No city. Enter = use what you typed.")}</li>
          )}
          {opts.map((c, i) => (
            <li key={`${c.name}-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(c.name)}
                className={`flex w-full flex-col items-start px-3 py-1.5 text-left ${i === highlight ? "bg-primary-50" : "hover:bg-canvas"}`}
              >
                <span className="text-sm text-ink">{c.name}</span>
                <span className="text-2xs text-muted">{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
