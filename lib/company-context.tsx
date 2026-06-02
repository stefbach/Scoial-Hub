"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
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
