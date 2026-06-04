"use client";

import { useT } from "@/lib/i18n";

export function SubHeader({
  title,
  scope,
  scopeLabel,
}: {
  title: string;
  scope: "org" | "company";
  scopeLabel: string;
}) {
  const t = useT();
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <span className="text-hair">|</span>
      <span className="text-sm text-muted">
        {scope === "org" ? t("Organisation :", "Organization:") : t("Paramètres pour", "Settings for")}{" "}
        <span className="font-semibold text-ink">{scopeLabel}</span>
      </span>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label mb-2 mt-4 first:mt-0">{children}</div>;
}

export function RowCard({
  title,
  desc,
  control,
}: {
  title: string;
  desc: string;
  control: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-hair p-3">
      <div className="min-w-0 flex-1 pr-2">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-2xs text-muted">{desc}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
