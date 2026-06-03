"use client";

import type { Competitor } from "@/lib/repositories/competitors";
import type { ScrapeNetwork } from "@/lib/scraping/types";

const NETWORK_COLORS: Record<ScrapeNetwork, string> = {
  youtube:   "bg-red-100 text-red-700 border-red-200",
  instagram: "bg-pink-100 text-pink-700 border-pink-200",
  tiktok:    "bg-neutral-100 text-neutral-700 border-neutral-200",
  linkedin:  "bg-blue-100 text-blue-700 border-blue-200",
  twitter:   "bg-sky-100 text-sky-700 border-sky-200",
  facebook:  "bg-indigo-100 text-indigo-700 border-indigo-200",
};

const NETWORK_LABELS: Record<ScrapeNetwork, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  facebook: "Facebook",
};

interface Props {
  competitor: Competitor;
  onRemove: (id: string) => void;
  removing?: boolean;
}

export function CompetitorItem({ competitor, onRemove, removing }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-hair bg-card px-3 py-2.5 shadow-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-semibold ${NETWORK_COLORS[competitor.network]}`}>
          {NETWORK_LABELS[competitor.network]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{competitor.name}</p>
          <p className="truncate text-2xs text-muted">{competitor.handle}</p>
        </div>
      </div>
      <button
        onClick={() => onRemove(competitor.id)}
        disabled={removing}
        aria-label={`Supprimer ${competitor.name}`}
        className="shrink-0 rounded-md p-1.5 text-muted hover:bg-danger-50 hover:text-danger-600 transition-colors disabled:opacity-40"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
