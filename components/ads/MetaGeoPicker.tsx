"use client";

// ── Autocomplétion de localisation Meta (pays + villes + régions) ────────────
// Comme dans le Gestionnaire de publicités : on tape, Meta renvoie des entrées
// avec leur CLÉ officielle ; on les ajoute en « chips ». Les villes portent un
// rayon (km) ajustable. Indispensable pour cibler des villes (clé Meta requise).

import { useEffect, useRef, useState } from "react";
import { useT, useLang } from "@/lib/i18n";

export interface GeoLoc {
  key: string;
  name: string;
  type: string;            // country | city | region | …
  countryCode?: string;
  countryName?: string;
  region?: string;
  radius?: number;         // villes uniquement (km)
}

interface SearchResult {
  key: string;
  name: string;
  type: string;
  countryCode?: string;
  countryName?: string;
  region?: string;
}

const typeLabel = (t: (fr: string, en: string) => string, type: string) =>
  type === "country" ? t("Pays", "Country")
  : type === "city" ? t("Ville", "City")
  : type === "region" ? t("Région", "Region")
  : type === "zip" ? t("Code postal", "Zip")
  : type;

export function MetaGeoPicker({
  companyId,
  value,
  onChange,
  disabled,
}: {
  companyId: string;
  value: GeoLoc[];
  onChange: (next: GeoLoc[]) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Recherche débattue (debounce) sur l'API Meta adgeolocation.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/meta/geo?companyId=${encodeURIComponent(companyId)}&q=${encodeURIComponent(term)}&locale=${lang}`,
          { signal: ctrl.signal }
        );
        const data = await res.json();
        setNotConnected(data?.connected === false);
        setResults(Array.isArray(data?.results) ? data.results : []);
        setOpen(true);
      } catch { /* ignore (abort/réseau) */ }
      finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q, companyId, lang]);

  // Ferme la liste au clic extérieur.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const add = (r: SearchResult) => {
    if (value.some((v) => v.key === r.key)) return;
    onChange([...value, { ...r, radius: r.type === "city" ? 25 : undefined }]);
    setQ(""); setResults([]); setOpen(false);
  };
  const remove = (key: string) => onChange(value.filter((v) => v.key !== key));
  const setRadius = (key: string, radius: number) =>
    onChange(value.map((v) => (v.key === key ? { ...v, radius } : v)));

  return (
    <div ref={boxRef} className="relative">
      {/* Chips sélectionnées */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v.key} className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-canvas px-2.5 py-1 text-2xs text-ink">
              <span className="font-medium">{v.name}</span>
              <span className="text-muted">· {typeLabel(t, v.type)}{v.countryCode && v.type !== "country" ? ` (${v.countryCode})` : ""}</span>
              {v.type === "city" && (
                <select
                  value={v.radius ?? 25}
                  onChange={(e) => setRadius(v.key, Number(e.target.value))}
                  className="rounded bg-card px-1 text-2xs text-ink outline-none ring-1 ring-hair"
                  title={t("Rayon", "Radius")}
                >
                  {[10, 15, 25, 40, 80].map((r) => <option key={r} value={r}>{r} km</option>)}
                </select>
              )}
              <button type="button" onClick={() => remove(v.key)} aria-label={t("Retirer", "Remove")} className="text-muted hover:text-danger-600">✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Champ de recherche */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        disabled={disabled}
        placeholder={t("Rechercher un pays ou une ville… (ex. « Maurice », « Paris »)", "Search a country or city… (e.g. \"Mauritius\", \"Paris\")")}
        className="w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
      />

      {/* Liste de résultats */}
      {open && (loading || results.length > 0 || notConnected) && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-hair bg-card shadow-lg">
          {notConnected ? (
            <p className="px-3 py-2 text-2xs text-muted">{t("Connectez Meta pour la recherche de localisations.", "Connect Meta to search locations.")}</p>
          ) : loading ? (
            <p className="px-3 py-2 text-2xs text-muted">{t("Recherche…", "Searching…")}</p>
          ) : (
            results.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => add(r)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
              >
                <span className="truncate">{r.name}{r.region ? `, ${r.region}` : ""}{r.countryName && r.type !== "country" ? ` · ${r.countryName}` : ""}</span>
                <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-2xs text-muted ring-1 ring-hair">{typeLabel(t, r.type)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
