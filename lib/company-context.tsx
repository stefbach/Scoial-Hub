"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { COMPANIES, COMPANY_DATA, registerCompany, makeEmptyCompanyData } from "./mock-data";
import type { Company, CompanyData } from "./types";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

interface CompanyContextValue {
  companies: Company[];
  company: Company;
  data: CompanyData;
  setCompanyId: (id: string) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, patch: Partial<Company>) => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  // Snapshot of the shared COMPANIES list; bumping this triggers re-renders
  // for the switcher and any consumer when companies are added/edited.
  const [companies, setCompanies] = useState<Company[]>([...COMPANIES]);

  // Attempt to hydrate companies from the REST API on mount.
  // Quand Supabase est configuré et un user connecté existe, on passe son
  // orgId en query param pour que la RLS filtre correctement.
  // Initialised with mock data, so the app is fully functional before the
  // fetch resolves (and remains functional if it fails or Supabase is absent).
  useEffect(() => {
    let cancelled = false;

    async function resolveApiUrl(): Promise<string> {
      if (!isSupabaseConfigured) return "/api/companies";
      const supabase = createClient();
      if (!supabase) return "/api/companies";
      const { data } = await supabase.auth.getUser();
      if (!data.user) return "/api/companies";
      // Récupère l'orgId depuis les memberships
      const { data: membership } = await supabase
        .from("sh_memberships")
        .select("org_id")
        .eq("user_id", data.user.id)
        .limit(1)
        .single();
      if (membership?.org_id) {
        return `/api/companies?orgId=${encodeURIComponent(membership.org_id as string)}`;
      }
      return "/api/companies";
    }

    resolveApiUrl()
      .then((url) => fetch(url))
      .then((res) => {
        if (!res.ok) throw new Error(`/api/companies returned ${res.status}`);
        return res.json() as Promise<Company[]>;
      })
      .then((fetched) => {
        if (cancelled || !Array.isArray(fetched) || fetched.length === 0) return;

        // Merge fetched companies (vrais UUID Supabase) dans le store mock.
        // On matche par CODE (OCC/TI/CV) pour REMPLACER l'entrée mock par la
        // vraie (UUID), et on aliase les données riches mock sur le nouvel id
        // afin que les pages continuent de s'afficher tout en utilisant l'UUID.
        for (const c of fetched) {
          const byId = COMPANIES.findIndex((x) => x.id === c.id);
          const byCode = COMPANIES.findIndex((x) => x.code === c.code);
          if (byId >= 0) {
            COMPANIES[byId] = { ...COMPANIES[byId], ...c };
          } else if (byCode >= 0) {
            const oldId = COMPANIES[byCode].id;
            if (COMPANY_DATA[oldId] && !COMPANY_DATA[c.id]) {
              COMPANY_DATA[c.id] = COMPANY_DATA[oldId]; // alias données riches
            }
            COMPANIES[byCode] = { ...COMPANIES[byCode], ...c }; // adopte l'UUID réel
          } else {
            registerCompany(c);
            if (!COMPANY_DATA[c.id]) COMPANY_DATA[c.id] = makeEmptyCompanyData();
          }
        }

        setCompanies([...COMPANIES]);
        // If the previously-selected companyId no longer exists in the
        // refreshed list, fall back to the first entry.
        setCompanyId((prev) => {
          const stillExists = COMPANIES.some((c) => c.id === prev);
          return stillExists ? prev : (COMPANIES[0]?.id ?? prev);
        });
      })
      .catch((err) => {
        // Non-blocking: the app continues with mock data.
        console.warn("[CompanyProvider] API hydration failed, using mock data:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addCompany = useCallback((company: Company) => {
    registerCompany(company);
    setCompanies([...COMPANIES]);
  }, []);

  const updateCompany = useCallback((id: string, patch: Partial<Company>) => {
    const idx = COMPANIES.findIndex((c) => c.id === id);
    if (idx >= 0) COMPANIES[idx] = { ...COMPANIES[idx], ...patch };
    setCompanies([...COMPANIES]);
  }, []);

  const value = useMemo<CompanyContextValue>(() => {
    const company = companies.find((c) => c.id === companyId) ?? companies[0];
    return {
      companies,
      company,
      data: COMPANY_DATA[company.id],
      setCompanyId,
      addCompany,
      updateCompany,
    };
  }, [companyId, companies, addCompany, updateCompany]);

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
