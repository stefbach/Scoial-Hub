"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { useT } from "@/lib/i18n";
import type { HistoryItem } from "@/lib/types";

function header(p: HistoryItem) {
  const base = (p.fullBody?.split("\n")[0] || p.body).trim();
  return base.length > 60 ? base.slice(0, 60) + "…" : base;
}

function fmt(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return format(d, "EEE d MMM HH:mm");
}

const PLATFORM_NAME = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
} as const;

export function HistoryDetailModal({
  post,
  onClose,
  onDelete,
}: {
  post: HistoryItem | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [post, onClose]);

  if (!post) return null;

  const scheduled = fmt(post.scheduledAt) ?? post.when;
  const published = fmt(post.publishedAt);
  const sameTime = scheduled === published;

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="flex items-start justify-between gap-3 border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">{header(post)}</div>
        <button
          onClick={onClose}
          aria-label={t("Fermer", "Close")}
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {post.status === "published" ? (
            <StatusBadge tone="green">{t("Publié", "Published")}</StatusBadge>
          ) : (
            <StatusBadge tone="red">{t("Échoué", "Failed")}</StatusBadge>
          )}
          <PlatformTag platform={post.platform} />
        </div>

        <div className="mb-3 text-xs font-medium text-ink">
          {t("Planifié", "Scheduled")}: {scheduled}
          {published && !sameTime && <> · {t("Publié", "Published")}: {published}</>}
        </div>

        <div className="mb-3 text-2xs text-muted">
          {post.source === "automation" && post.automationName
            ? `${t("Depuis l'automatisation", "From automation")}: ${post.automationName}`
            : t("Publication manuelle", "Manual post")}
        </div>

        <div className="whitespace-pre-line rounded-md border-hair border-hair bg-canvas p-3 text-sm leading-relaxed text-ink">
          {post.fullBody || post.body}
        </div>

        {post.media && (
          <div className="mt-3">
            <div className="section-label mb-1">{t("Média", "Media")}</div>
            <div className="flex h-[110px] w-[150px] items-center justify-center rounded-md border-hair border-hair bg-canvas">
              <span className="text-2xs text-muted">
                {post.media.kind === "video" ? t("Vidéo", "Video") : t("Image", "Image")}
              </span>
            </div>
          </div>
        )}

        {post.status === "published" && post.metrics && (
          <div className="mt-3">
            <div className="section-label mb-1">{t("Engagement", "Engagement")}</div>
            <div className="grid grid-cols-4 gap-2">
              <Metric label={t("Réactions", "Reactions")} value={post.metrics.reactions} />
              <Metric label={t("Commentaires", "Comments")} value={post.metrics.comments} />
              <Metric label={t("Partages", "Shares")} value={post.metrics.shares} />
              <Metric label={t("Clics sur le lien", "Link clicks")} value={post.metrics.linkClicks} />
            </div>
            {post.externalUrl && (
              <a
                href={post.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border-hair border-hair bg-card px-3 py-1.5 text-xs text-ink hover:bg-canvas"
              >
                {t("Voir sur", "View on")} {PLATFORM_NAME[post.platform]}
                <ExternalIcon />
              </a>
            )}
          </div>
        )}

        {post.status === "failed" && post.error && (
          <div className="mt-3">
            <div className="rounded-md border-hair border-red-200 bg-red-50 px-3 py-2">
              <div className="text-2xs font-medium text-red-600">{post.error.title}</div>
              <div className="text-2xs text-muted">{post.error.detail}</div>
            </div>
            <Button variant="secondary" className="mt-2 py-1 text-2xs">{t("Réessayer", "Retry")}</Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="danger" onClick={() => onDelete(post.id)}>
          <span className="flex items-center gap-1.5"><TrashIcon /> {t("Supprimer", "Delete")}</span>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push(`/compose?duplicate=${post.id}`)}
          >
            {t("Dupliquer en nouvelle publication", "Duplicate as new post")}
          </Button>
          <Button variant="primary" onClick={onClose}>{t("Fermer", "Close")}</Button>
        </div>
      </div>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border-hair border-hair bg-canvas p-2">
      <div className="text-2xs text-muted">{label}</div>
      <div className="text-sm font-semibold text-ink">{value.toLocaleString()}</div>
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
