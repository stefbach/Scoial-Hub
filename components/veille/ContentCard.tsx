"use client";

import type { CompetitorContent } from "@/lib/scraping/types";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

const NETWORK_BADGE: Record<string, { label: string; cls: string }> = {
  youtube:   { label: "YouTube",    cls: "bg-red-100 text-red-700 border-red-200" },
  instagram: { label: "Instagram",  cls: "bg-pink-100 text-pink-700 border-pink-200" },
  tiktok:    { label: "TikTok",     cls: "bg-neutral-100 text-neutral-700 border-neutral-200" },
  linkedin:  { label: "LinkedIn",   cls: "bg-blue-100 text-blue-700 border-blue-200" },
  twitter:   { label: "X",          cls: "bg-sky-100 text-sky-700 border-sky-200" },
  facebook:  { label: "Facebook",   cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
};

const TYPE_LABEL: Record<string, string> = {
  post: "Post", video: "Vidéo", reel: "Reel", story: "Story",
};

interface Props {
  content: CompetitorContent;
}

export function ContentCard({ content }: Props) {
  const badge = NETWORK_BADGE[content.network] ?? { label: content.network, cls: "bg-canvas text-muted border-hair" };

  return (
    <div className="card p-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-xs font-medium text-ink truncate">{content.handle}</span>
          {content.simulated && (
            <span className="shrink-0 inline-flex items-center rounded border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-2xs font-medium text-warning-700">
              Simulé
            </span>
          )}
        </div>
        <span className="shrink-0 chip">{TYPE_LABEL[content.type] ?? content.type}</span>
      </div>

      {/* Caption */}
      <p className="text-sm text-ink leading-snug line-clamp-3">{content.caption}</p>

      {/* Métriques */}
      <div className="flex items-center gap-3 pt-1 border-t border-hair">
        <Metric icon={<HeartIcon />} value={fmt(content.likes)} label="Likes" />
        <Metric icon={<EyeIcon />}   value={fmt(content.views)} label="Vues" />
        <Metric icon={<ChatIcon />}  value={fmt(content.comments)} label="Comments" />
        <div className="ml-auto">
          <span className="text-xs font-semibold text-primary-600">
            {(content.engagementRate * 100).toFixed(1)}% ER
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 text-2xs text-muted">
        <span>{relativeDate(content.postedAt)}</span>
        {content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-600 transition-colors"
          >
            Voir →
          </a>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted" title={label}>
      <span className="opacity-60">{icon}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function HeartIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M5.5 9.5S1 6.5 1 3.5A2.5 2.5 0 0 1 5.5 2a2.5 2.5 0 0 1 4.5 1c0 3-4.5 6-4.5 6Z"
            fill="currentColor"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="12" height="11" viewBox="0 0 12 11" fill="none" aria-hidden="true">
      <ellipse cx="6" cy="5.5" rx="5" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="6" cy="5.5" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M3 9l2-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
