"use client";

// ── Autocomplétion de langues de ciblage Meta (Graph adlocale) ───────────────
// Optionnel : par défaut, Meta cible toutes les langues. Ajouter des langues
// restreint la diffusion aux personnes utilisant ces langues.

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

export interface MetaLocale {
  key: number;
  name: string;
}

export function MetaLanguagePicker({
  companyId,
  value,
  onChange,
  disabled,
}: {
  companyId: string;
  value: MetaLocale[];
  onChange: (next: MetaLocale[]) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MetaLocale[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meta/locales?companyId=${encodeURIComponent(companyId)}&q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        setNotConnected(data?.connected === false);
        setResults(Array.isArray(data?.results) ? data.results : []);
        setOpen(true);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q, companyId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const add = (l: MetaLocale) => {
    if (value.some((v) => v.key === l.key)) return;
    onChange([...value, l]);
    setQ(""); setResults([]); setOpen(false);
  };
  const remove = (key: number) => onChange(value.filter((v) => v.key !== key));

  return (
    <div ref={boxRef} className="relative">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v.key} className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-canvas px-2.5 py-1 text-2xs text-ink">
              {v.name}
              <button type="button" onClick={() => remove(v.key)} aria-label={t("Retirer", "Remove")} className="text-muted hover:text-danger-600">✕</button>
            </span>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        disabled={disabled}
        placeholder={t("Toutes les langues — ou recherchez (ex. « français », « anglais »)", "All languages — or search (e.g. \"French\", \"English\")")}
        className="w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
      />
      {open && (loading || results.length > 0 || notConnected) && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-hair bg-card shadow-lg">
          {notConnected ? (
            <p className="px-3 py-2 text-2xs text-muted">{t("Connectez Meta pour la recherche de langues.", "Connect Meta to search languages.")}</p>
          ) : loading ? (
            <p className="px-3 py-2 text-2xs text-muted">{t("Recherche…", "Searching…")}</p>
          ) : (
            results.map((r) => (
              <button key={r.key} type="button" onClick={() => add(r)} className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas">
                {r.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
