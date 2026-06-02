"use client";

import { GEO_ZONES, PERIODS, useScope } from "@/lib/scope";

// Barre de contexte globale : zone géographique + période d'analyse.
// Toujours visible sous le header → le contexte de pilotage est clair partout.
export function ScopeBar() {
  const { geoZone, period, setGeoZoneId, setPeriodId } = useScope();

  return (
    <div className="sticky top-[3.25rem] z-20 border-b border-hair bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-7 py-2.5">
        <span className="section-label text-muted">Contexte</span>

        {/* Zone géographique */}
        <Selector
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 7h11M7 1.5c1.6 1.7 1.6 9.3 0 11M7 1.5c-1.6 1.7-1.6 9.3 0 11" stroke="currentColor" strokeWidth="1" />
            </svg>
          }
          label="Zone"
          value={`${geoZone.flag} ${geoZone.label}`}
          options={GEO_ZONES.map((z) => ({ id: z.id, label: `${z.flag} ${z.label}` }))}
          onSelect={setGeoZoneId}
          current={geoZone.id}
        />

        {/* Période */}
        <Selector
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 5.5h11M4.5 1v2.5M9.5 1v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          }
          label="Période"
          value={period.label}
          options={PERIODS.map((p) => ({ id: p.id, label: p.label }))}
          onSelect={setPeriodId}
          current={period.id}
        />

        <span className="ml-auto hidden text-2xs text-muted sm:block">
          Les analyses et recommandations s'adaptent à ce contexte.
        </span>
      </div>
    </div>
  );
}

function Selector({
  icon,
  label,
  value,
  options,
  onSelect,
  current,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
  current: string;
}) {
  return (
    <label className="group relative flex items-center gap-2 rounded-lg border border-hair bg-card px-3 py-1.5 text-sm shadow-xs transition-all hover:border-[#cac4b9] hover:shadow-sm">
      <span className="text-muted">{icon}</span>
      <span className="text-2xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted" aria-hidden="true">
        <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        aria-label={label}
        value={current}
        onChange={(e) => onSelect(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
