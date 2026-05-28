"use client";

import { useCompany } from "@/lib/company-context";

export function PageHeader({
  title,
  scoped = true,
  actions,
}: {
  title: string;
  scoped?: boolean;
  actions?: React.ReactNode;
}) {
  const { company } = useCompany();
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        {scoped && (
          <>
            <span className="text-hair">|</span>
            <span className="text-sm text-muted">
              Company: <span className="font-semibold text-ink">{company.code}</span>
            </span>
          </>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
