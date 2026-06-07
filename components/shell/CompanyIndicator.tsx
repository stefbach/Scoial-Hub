"use client";

// Indicateur de société active (remplace l'ancien menu déroulant en haut).
// On NE change PAS de société depuis un menu volatil : la sélection se fait
// dans « Mes sociétés » (verrouillage clair du périmètre). Ici on affiche
// seulement la société courante + un badge « lecture seule » le cas échéant.

import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";

export function CompanyIndicator() {
  const { company, access } = useCompany();
  const t = useT();

  const hasCompany = Boolean(company?.id);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link
        href="/mes-societes"
        className="group flex min-w-0 items-center gap-2 rounded-lg border border-hair bg-card px-2.5 py-1.5 hover:border-page/50"
        title={t("Gérer mes sociétés", "Manage my companies")}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ background: company?.accent || "#7c3aed" }}
          aria-hidden="true"
        >
          {(company?.code || "—").slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-ink">
          {hasCompany ? company.name : t("Aucune société", "No company")}
        </span>
        <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="shrink-0 text-muted">
          <path d="M5 3.5 9 7.5 5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {hasCompany && access.mode === "view" && !access.isAccountAdmin && (
        <span className="hidden items-center gap-1 rounded-full border border-warning-500/40 bg-warning-50 px-2 py-0.5 text-2xs font-semibold text-warning-700 sm:inline-flex">
          👁 {t("Lecture seule", "View only")}
        </span>
      )}
    </div>
  );
}
