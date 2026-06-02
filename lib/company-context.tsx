"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { COMPANIES, COMPANY_DATA, registerCompany } from "./mock-data";
import type { Company, CompanyData } from "./types";

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
  // Initialised with mock data, so the app is fully functional before the
  // fetch resolves (and remains functional if it fails or Supabase is absent).
  useEffect(() => {
    let cancelled = false;

    fetch("/api/companies")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/companies returned ${res.status}`);
        return res.json() as Promise<Company[]>;
      })
      .then((fetched) => {
        if (cancelled || !Array.isArray(fetched) || fetched.length === 0) return;

        // Merge fetched companies into the shared mock store so that
        // COMPANY_DATA look-ups by id remain consistent.
        for (const c of fetched) {
          const existing = COMPANIES.findIndex((x) => x.id === c.id);
          if (existing >= 0) {
            COMPANIES[existing] = { ...COMPANIES[existing], ...c };
          } else {
            registerCompany(c);
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
