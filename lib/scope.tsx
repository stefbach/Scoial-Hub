"use client";

import { createContext, useContext, useMemo, useState } from "react";

// Scope global de l'app : zone géographique ciblée + période d'analyse.
// Utilisé par la ScopeBar et consommé par les pages (analytics, ad-perf, agents).

export type GeoZone = { id: string; label: string; flag: string };
export type Period = { id: string; label: string; days: number };

export const GEO_ZONES: GeoZone[] = [
  { id: "fr", label: "France", flag: "🇫🇷" },
  { id: "eu", label: "Europe", flag: "🇪🇺" },
  { id: "maghreb", label: "Maghreb", flag: "🌍" },
  { id: "waf", label: "Afrique de l'Ouest", flag: "🌍" },
  { id: "cv", label: "Cap-Vert", flag: "🇨🇻" },
  { id: "intl", label: "International", flag: "🌐" },
];

export const PERIODS: Period[] = [
  { id: "7d", label: "7 derniers jours", days: 7 },
  { id: "30d", label: "30 derniers jours", days: 30 },
  { id: "90d", label: "90 derniers jours", days: 90 },
  { id: "12m", label: "12 derniers mois", days: 365 },
];

interface ScopeValue {
  geoZone: GeoZone;
  period: Period;
  setGeoZoneId: (id: string) => void;
  setPeriodId: (id: string) => void;
}

const ScopeContext = createContext<ScopeValue | null>(null);

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [geoZoneId, setGeoZoneId] = useState("fr");
  const [periodId, setPeriodId] = useState("30d");

  const value = useMemo<ScopeValue>(
    () => ({
      geoZone: GEO_ZONES.find((z) => z.id === geoZoneId) ?? GEO_ZONES[0],
      period: PERIODS.find((p) => p.id === periodId) ?? PERIODS[1],
      setGeoZoneId,
      setPeriodId,
    }),
    [geoZoneId, periodId]
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope must be used within ScopeProvider");
  return ctx;
}
