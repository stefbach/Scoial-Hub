"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import "react-day-picker/style.css";
import { COUNTRIES, useScope, type DateRange } from "@/lib/scope";

// Barre de contexte globale : PAYS précis + PLAGE DE DATES (calendrier).
export function ScopeBar() {
  const { country, setCountryId, range, setRange } = useScope();

  return (
    <div className="sticky top-[3.25rem] z-20 border-b border-hair bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-7 py-2.5">
        <span className="section-label text-muted">Contexte</span>
        <CountryPicker currentId={country.id} flag={country.flag} label={country.label} onSelect={setCountryId} />
        <DateRangePicker range={range} onChange={setRange} />
        <span className="ml-auto hidden text-2xs text-muted lg:block">
          Analyses, ciblage et recommandations s'adaptent au pays et à la période.
        </span>
      </div>
    </div>
  );
}

/* ── Pays : combobox recherchable ─────────────────────────────── */
function CountryPicker({
  currentId,
  flag,
  label,
  onSelect,
}: {
  currentId: string;
  flag: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = COUNTRIES.filter((c) =>
    c.label.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-hair bg-card px-3 py-1.5 text-sm shadow-xs transition-all hover:border-[#cac4b9] hover:shadow-sm"
      >
        <span className="text-base leading-none">{flag}</span>
        <span className="text-2xs font-medium uppercase tracking-wide text-muted">Pays</span>
        <span className="font-semibold text-ink">{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted" aria-hidden="true">
          <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-40 w-64 rounded-xl border border-hair bg-card p-2 shadow-lg animate-fade-in">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un pays…"
            className="input mb-2"
          />
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted">Aucun pays</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                  setQ("");
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                  c.id === currentId ? "bg-primary-50 font-semibold text-primary-700" : "text-ink hover:bg-canvas"
                }`}
              >
                <span className="text-base">{c.flag}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Période : calendrier de plage de dates ───────────────────── */
const PRESETS: { id: string; label: string; days: number }[] = [
  { id: "7d", label: "7 jours", days: 7 },
  { id: "30d", label: "30 jours", days: 30 },
  { id: "90d", label: "90 jours", days: 90 },
  { id: "12m", label: "12 mois", days: 365 },
];

function DateRangePicker({
  range,
  onChange,
}: {
  range: DateRange | null;
  onChange: (r: DateRange | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ from, to });
    setOpen(false);
  };

  const label = range
    ? `${format(range.from, "d MMM", { locale: fr })} – ${format(range.to, "d MMM yyyy", { locale: fr })}`
    : "Choisir une période";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-hair bg-card px-3 py-1.5 text-sm shadow-xs transition-all hover:border-[#cac4b9] hover:shadow-sm"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-muted" aria-hidden="true">
          <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M1.5 5.5h11M4.5 1v2.5M9.5 1v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-2xs font-medium uppercase tracking-wide text-muted">Période</span>
        <span className="font-semibold text-ink">{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted" aria-hidden="true">
          <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-40 rounded-xl border border-hair bg-card p-3 shadow-lg animate-fade-in">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="chip hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200"
              >
                {p.label}
              </button>
            ))}
          </div>
          <DayPicker
            mode="range"
            locale={fr}
            selected={range ?? undefined}
            onSelect={(r) => {
              if (r?.from && r?.to) {
                onChange({ from: r.from, to: r.to });
              } else if (r?.from) {
                onChange({ from: r.from, to: r.from });
              }
            }}
            numberOfMonths={1}
            className="[--rdp-accent-color:theme(colors.page)] [--rdp-accent-background-color:theme(colors.primary.50)]"
            styles={{ day: { fontSize: "0.8rem" } }}
          />
          {range && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="mt-1 w-full text-center text-2xs text-muted hover:text-ink"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}
    </div>
  );
}
