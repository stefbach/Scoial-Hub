"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import "react-day-picker/style.css";
import { COUNTRIES, useScope, type DateRange } from "@/lib/scope";
import { useT } from "@/lib/i18n";

// Barre de contexte globale : PAYS précis + PLAGE DE DATES (calendrier).
export function ScopeBar() {
  const { country, setCountryId, range, setRange } = useScope();
  const t = useT();

  return (
    <div className="sticky top-[3.25rem] z-20 border-b border-hair bg-canvas/85 backdrop-blur-md">
      <div className="flex w-full flex-wrap items-center gap-1.5 px-3 py-2.5 sm:gap-3 sm:px-5 lg:px-7">
        <span className="section-label text-muted">{t("Contexte", "Context")}</span>
        <CountryPicker currentId={country.id} flag={country.flag} label={country.label} onSelect={setCountryId} />
        <DateRangePicker range={range} onChange={setRange} />
        <span className="ml-auto hidden text-2xs text-muted lg:block">
          {t(
            "Analyses, ciblage et recommandations s'adaptent au pays et à la période.",
            "Analyses, targeting and recommendations adjust to the selected country and period."
          )}
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
  const t = useT();

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
        <span className="text-2xs font-medium uppercase tracking-wide text-muted">{t("Pays", "Country")}</span>
        <span className="font-semibold text-ink">{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted" aria-hidden="true">
          <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-40 w-[min(16rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-xl border border-hair bg-card p-2 shadow-lg animate-fade-in">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Rechercher un pays…", "Search a country…")}
            className="input mb-2"
          />
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted">{t("Aucun pays", "No country found")}</p>
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
const PRESETS: { id: string; labelFr: string; labelEn: string; days: number }[] = [
  { id: "7d", labelFr: "7 jours", labelEn: "7 days", days: 7 },
  { id: "30d", labelFr: "30 jours", labelEn: "30 days", days: 30 },
  { id: "90d", labelFr: "90 jours", labelEn: "90 days", days: 90 },
  { id: "12m", labelFr: "12 mois", labelEn: "12 months", days: 365 },
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
  const t = useT();

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
    : t("Choisir une période", "Select a period");

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
        <span className="text-2xs font-medium uppercase tracking-wide text-muted">{t("Période", "Period")}</span>
        <span className="font-semibold text-ink">{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted" aria-hidden="true">
          <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-40 w-[min(16rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-xl border border-hair bg-card p-3 shadow-lg animate-fade-in">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="chip hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200"
              >
                {t(p.labelFr, p.labelEn)}
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
              {t("Réinitialiser", "Reset")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
