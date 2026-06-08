"use client";

import { createContext, useContext, useMemo, useState } from "react";

// Scope global : pays précis + période (préréglage OU plage de dates calendrier).

export type Country = { id: string; label: string; flag: string };

// Couverture COMPLÈTE du marché Meta : tous les pays (ISO 3166-1 alpha-2).
// Le drapeau est calculé depuis le code, le libellé est localisé (FR) via Intl.
const ISO2_CODES = [
  "AF","AL","DZ","AD","AO","AI","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD",
  "BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BR","BN","BG","BF","BI","KH",
  "CM","CA","CV","KY","CF","TD","CL","CN","CO","KM","CG","CD","CR","CI","HR","CU",
  "CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FJ","FI",
  "FR","GF","PF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG",
  "GN","GW","GY","HT","HN","HK","HU","IS","IN","ID","IQ","IE","IM","IL","IT","JM",
  "JP","JE","JO","KZ","KE","KI","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT",
  "LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD",
  "MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI","NE","NG",
  "MK","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PL","PT","PR","QA","RE",
  "RO","RU","RW","BL","KN","LC","MF","VC","WS","SM","ST","SA","SN","RS","SC","SL",
  "SG","SK","SI","SB","SO","ZA","KR","SS","ES","LK","SD","SR","SE","CH","SY","TW",
  "TJ","TZ","TH","TL","TG","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB",
  "US","UY","UZ","VU","VA","VE","VN","VG","VI","YE","ZM","ZW",
];

function flagFromCode(code: string): string {
  try {
    return String.fromCodePoint(
      ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  } catch {
    return "🏳️";
  }
}

const regionNames: { of: (c: string) => string | undefined } | null = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

export const COUNTRIES: Country[] = ISO2_CODES.map((code) => ({
  id: code.toLowerCase(),
  label: regionNames?.of(code) ?? code,
  flag: flagFromCode(code),
})).sort((a, b) => a.label.localeCompare(b.label, "fr"));

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
