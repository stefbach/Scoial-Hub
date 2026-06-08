"use client";

// Sélecteur de société (haut de page) : affiche la société active et, au clic,
// déroule TOUTES les sociétés accessibles pour basculer en un clic. Le lien
// « Gérer mes sociétés » mène à la page de gestion. Badge « lecture seule » si
// l'utilisateur n'a qu'un accès consultation sur la société active.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";

export function CompanyIndicator() {
  const { companies, company, setCompanyId, access } = useCompany();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const list = companies.filter((c) => c.id);
  const hasCompany = Boolean(company?.id);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="group flex w-full min-w-0 items-center gap-2 rounded-lg border border-hair bg-card px-2.5 py-2 hover:border-page/50"
        title={t("Changer de société", "Switch company")}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ background: company?.accent || "#7c3aed" }}
          aria-hidden="true"
        >
          {(company?.code || "—").slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink">
          {hasCompany ? company.name : t("Aucune société", "No company")}
        </span>
        {hasCompany && access.mode === "view" && !access.isAccountAdmin && (
          <span className="shrink-0 text-2xs" title={t("Lecture seule", "View only")}>👁</span>
        )}
        <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="shrink-0 text-muted">
          <path d="M4 6l3.5 3.5L11 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-hair bg-card shadow-lg animate-fade-in"
        >
          <div className="px-3 py-2 section-label border-b border-hair text-muted">
            {t("Mes sociétés", "My companies")}
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {list.length === 0 && (
              <p className="px-3 py-3 text-2xs text-muted">{t("Aucune société.", "No company.")}</p>
            )}
            {list.map((c) => {
              const active = c.id === company.id;
              return (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={active}
                  onClick={() => { setCompanyId(c.id); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    active ? "bg-page/15 text-ink" : "text-muted hover:bg-white/[0.06] hover:text-ink"
                  }`}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                    style={{ background: c.accent || "#7c3aed" }}
                    aria-hidden="true"
                  >
                    {(c.code || "—").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="shrink-0 text-page">
                      <path d="M3.5 8l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <Link
            href="/mes-societes"
            onClick={() => setOpen(false)}
            className="block border-t border-hair px-3 py-2.5 text-2xs font-medium text-muted hover:bg-white/[0.06] hover:text-ink"
          >
            ⚙ {t("Gérer mes sociétés", "Manage my companies")}
          </Link>
        </div>
      )}
    </div>
  );
}
