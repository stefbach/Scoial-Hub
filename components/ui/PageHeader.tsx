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
    <div className="mb-6 flex items-center justify-between gap-4">
      {/* Titre + scope */}
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-lg font-bold tracking-tight text-ink">
          {title}
        </h1>

        {scoped && (
          <>
            {/* Séparateur vertical */}
            <span
              aria-hidden="true"
              className="h-4 w-px shrink-0 rounded-full bg-hair"
            />
            {/* Badge de contexte entreprise */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-canvas px-2.5 py-0.5 text-2xs text-muted shadow-xs">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-primary-400"
              />
              <span className="font-semibold text-ink">{company.code}</span>
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
