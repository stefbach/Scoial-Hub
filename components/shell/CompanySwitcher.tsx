"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-context";

export function CompanySwitcher() {
  const { companies, company, setCompanyId } = useCompany();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* Trigger — chip avec pastille de marque */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="
          group flex items-center gap-2 rounded-lg border border-hair bg-canvas/70 px-2.5 py-1.5
          text-sm shadow-xs
          transition-all duration-[120ms]
          hover:border-[#cac4b9] hover:bg-canvas hover:shadow-sm
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35 focus-visible:ring-offset-1
        "
      >
        {/* Pastille accent marque */}
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-bold text-white"
          style={{ backgroundColor: company.accent }}
          aria-hidden="true"
        >
          {company.code.slice(0, 2)}
        </span>

        <span className="font-semibold text-ink leading-none">
          {company.name ?? company.code}
        </span>

        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`shrink-0 text-muted transition-transform duration-[150ms] ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M1.5 3.5L5 7l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div
            role="listbox"
            aria-label="Sélectionner un espace de travail"
            className="
              absolute left-0 z-20 mt-2 min-w-[15rem] overflow-hidden
              rounded-xl border border-hair bg-card shadow-lg
              animate-fade-in
            "
          >
            {/* En-tête */}
            <div className="border-b border-hair px-3 py-2">
              <p className="section-label">Workspace</p>
            </div>

            {/* Liste */}
            <div className="p-1.5">
              {companies.map((c) => {
                const active = c.id === company.id;
                return (
                  <button
                    key={c.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setCompanyId(c.id);
                      setOpen(false);
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm",
                      "transition-colors duration-[100ms]",
                      active
                        ? "bg-primary-50 text-ink"
                        : "text-ink hover:bg-canvas",
                    ].join(" ")}
                  >
                    {/* Avatar entreprise */}
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: c.accent }}
                    >
                      {c.code}
                    </span>

                    {/* Nom + détail */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink leading-snug">
                        {c.name}
                      </span>
                      <span className="block truncate text-2xs text-muted">
                        {c.brandVoice}
                      </span>
                    </span>

                    {/* Coche active */}
                    {active && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                        className="shrink-0 text-primary-600"
                      >
                        <path
                          d="M2.5 7L6 10.5l5.5-7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
