"use client";

import { createContext, useContext, useMemo, useState } from "react";

// Scope global : pays précis + période (préréglage OU plage de dates calendrier).

export type Country = { id: string; label: string; flag: string };

export const COUNTRIES: Country[] = [
  { id: "fr", label: "France", flag: "🇫🇷" },
  { id: "be", label: "Belgique", flag: "🇧🇪" },
  { id: "ch", label: "Suisse", flag: "🇨🇭" },
  { id: "lu", label: "Luxembourg", flag: "🇱🇺" },
  { id: "pt", label: "Portugal", flag: "🇵🇹" },
  { id: "es", label: "Espagne", flag: "🇪🇸" },
  { id: "it", label: "Italie", flag: "🇮🇹" },
  { id: "de", label: "Allemagne", flag: "🇩🇪" },
  { id: "gb", label: "Royaume-Uni", flag: "🇬🇧" },
  { id: "nl", label: "Pays-Bas", flag: "🇳🇱" },
  { id: "ma", label: "Maroc", flag: "🇲🇦" },
  { id: "dz", label: "Algérie", flag: "🇩🇿" },
  { id: "tn", label: "Tunisie", flag: "🇹🇳" },
  { id: "sn", label: "Sénégal", flag: "🇸🇳" },
  { id: "ci", label: "Côte d'Ivoire", flag: "🇨🇮" },
  { id: "cm", label: "Cameroun", flag: "🇨🇲" },
  { id: "ml", label: "Mali", flag: "🇲🇱" },
  { id: "cv", label: "Cap-Vert", flag: "🇨🇻" },
  { id: "ca", label: "Canada", flag: "🇨🇦" },
  { id: "us", label: "États-Unis", flag: "🇺🇸" },
  { id: "ae", label: "Émirats arabes unis", flag: "🇦🇪" },
  { id: "mu", label: "Maurice", flag: "🇲🇺" },
];

export type DateRange = { from: Date; to: Date };

interface ScopeValue {
  country: Country;
  setCountryId: (id: string) => void;
  /** Plage de dates précise sélectionnée (null = aucune plage custom). */
  range: DateRange | null;
  setRange: (r: DateRange | null) => void;
}

const ScopeContext = createContext<ScopeValue | null>(null);

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [countryId, setCountryId] = useState("fr");
  const [range, setRange] = useState<DateRange | null>(null);

  const value = useMemo<ScopeValue>(
    () => ({
      country: COUNTRIES.find((c) => c.id === countryId) ?? COUNTRIES[0],
      setCountryId,
      range,
      setRange,
    }),
    [countryId, range]
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope must be used within ScopeProvider");
  return ctx;
}
