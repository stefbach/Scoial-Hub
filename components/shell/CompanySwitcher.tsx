"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-context";

export function CompanySwitcher() {
  const { companies, company, setCompanyId } = useCompany();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border-hair border-hair bg-card px-3 py-1.5 text-sm hover:bg-canvas"
      >
        <span className="text-muted">Company:</span>
        <span className="font-semibold text-ink">{company.code}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted">
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-64 overflow-hidden rounded-md border-hair border-hair bg-card shadow-lg">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCompanyId(c.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-canvas ${
                  c.id === company.id ? "bg-canvas" : ""
                }`}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-2xs font-bold text-white"
                  style={{ backgroundColor: c.accent }}
                >
                  {c.code}
                </span>
                <span>
                  <span className="block font-medium text-ink">{c.name}</span>
                  <span className="block text-2xs text-muted">{c.brandVoice}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
