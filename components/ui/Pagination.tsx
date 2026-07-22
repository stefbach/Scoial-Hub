"use client";

// Pagination client numérotée « ← / 1 2 3 / → » — partagée par les tableaux
// longs (campagnes du compte, meilleures publicités). Ne s'affiche qu'à
// partir de deux pages.

import { useT } from "@/lib/i18n";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const t = useT();
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav aria-label={t("Pagination", "Pagination")} className="mt-3 flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t("Page précédente", "Previous page")}
        className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-muted transition-colors hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        ←
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          aria-label={t(`Page ${p}`, `Page ${p}`)}
          className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold transition-colors ${
            p === page ? "bg-page text-white" : "text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={t("Page suivante", "Next page")}
        className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-muted transition-colors hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        →
      </button>
    </nav>
  );
}
