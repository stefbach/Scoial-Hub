"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { COMPANIES, COMPANY_DATA } from "./mock-data";
import type { Company, CompanyData } from "./types";

interface CompanyContextValue {
  companies: Company[];
  company: Company;
  data: CompanyData;
  setCompanyId: (id: string) => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);

  const value = useMemo<CompanyContextValue>(() => {
    const company =
      COMPANIES.find((c) => c.id === companyId) ?? COMPANIES[0];
    return {
      companies: COMPANIES,
      company,
      data: COMPANY_DATA[company.id],
      setCompanyId,
    };
  }, [companyId]);

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
