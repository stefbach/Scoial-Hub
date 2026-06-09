"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { useT } from "@/lib/i18n";
import { deletePost, publishPost, reschedulePost } from "@/lib/draft-store";
import type { ScheduledPost } from "@/lib/types";

function headerLabel(p: ScheduledPost) {
  const base = (p.body?.split("\n")[0] || p.title).trim();
  return base.length > 60 ? base.slice(0, 60) + "…" : base;
}

function whenLabel(date: string, time: string) {
  const d = new Date(`${date}T00:00:00`);
  return `${format(d, "EEEE, d MMMM yyyy")} at ${time}`;
}

export function ScheduledDetailModal({
  companyId,
  post,
  onClose,
  onChanged,
}: {
  companyId: string;
  post: ScheduledPost | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const t = useT();
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState("09:00");
  const [confirm, setConfirm] = useState<null | "publish" | "delete">(null);
  const [busy, setBusy] = useState(false);

  // Reset transient state whenever a different post is opened.
  useEffect(() => {
    if (post) {
      setRescheduling(false);
      setConfirm(null);
      setDate(new Date(`${post.date}T00:00:00`));
      setTime(post.time);
    }
  }, [post]);

  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [post, onClose]);

  if (!post) return null;

  const handleSaveReschedule = async () => {
    const newDate = format(date, "yyyy-MM-dd");
    setBusy(true);
    // Persiste côté serveur (Supabase) — c'est la source affichée.
    try {
      await fetch(`/api/scheduled-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, time }),
      });
    } catch { /* on tente quand même le store local */ }
    // Met aussi à jour le store local (posts de démo / hors Supabase).
    reschedulePost(companyId, post.id, newDate, time);
    setBusy(false);
    onChanged();
    onClose();
  };

  const handlePublish = async () => {
    setBusy(true);
    try {
      await fetch(`/api/scheduled-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published", publishedAt: new Date().toISOString() }),
      });
    } catch { /* store local en repli */ }
    publishPost(companyId, post.id);
    setBusy(false);
    onChanged();
    onClose();
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await fetch(`/api/scheduled-posts/${post.id}`, { method: "DELETE" });
    } catch { /* store local en repli */ }
    deletePost(companyId, post.id);
    setBusy(false);
    onChanged();
    onClose();
  };

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">{headerLabel(post)}</div>
        <button
          onClick={onClose}
          aria-label={t("Fermer", "Close")}
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3">
        {/* Status + platform + when */}
        <div className="mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue">{t("Planifié", "Scheduled")}</StatusBadge>
            <PlatformTag platform={post.platform} />
          </div>
          <div className="mt-1.5 text-xs font-medium text-ink">
            {whenLabel(post.date, post.time)}
          </div>
        </div>

        {/* Source */}
        <div className="mb-3 flex items-center gap-1.5 text-2xs text-muted">
          {post.source === "automation" ? (
            <>
              <RefreshIcon />
              <span>{t("Depuis l'automatisation", "From automation")}: {post.automationName ?? t("Règle récurrente", "Recurring rule")}</span>
            </>
          ) : (
            <>
              <EditIcon />
              <span>{t("Publication manuelle", "Manual post")}</span>
            </>
          )}
        </div>

        {/* Content */}
        <div className="whitespace-pre-line rounded-md border-hair border-hair bg-canvas p-3 text-sm leading-relaxed text-ink">
          {post.body || post.title}
        </div>

        {/* Media */}
        {post.media && (
          <div className="mt-3">
            <div className="section-label mb-1">{t("Média", "Media")}</div>
            <div className="flex h-[90px] w-[120px] items-center justify-center rounded-md border-hair border-hair bg-canvas">
              <span className="text-2xs text-muted">
                {post.media.kind === "video" ? t("Vidéo", "Video") : t("Image", "Image")}
              </span>
            </div>
          </div>
        )}

        {/* Reschedule inline */}
        {rescheduling && (
          <div className="mt-3 rounded-md border-hair border-hair bg-canvas p-3">
            <div className="section-label mb-2">{t("Replanifier", "Reschedule")}</div>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker value={date} onChange={setDate} />
              <TimePicker value={time} onChange={setTime} />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRescheduling(false)}>{t("Annuler", "Cancel")}</Button>
              <Button variant="primary" onClick={handleSaveReschedule} disabled={busy}>{busy ? t("Enregistrement…", "Saving…") : t("Enregistrer", "Save")}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="danger" onClick={() => setConfirm("delete")}>
          <span className="flex items-center gap-1.5"><TrashIcon /> {t("Supprimer", "Delete")}</span>
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setRescheduling((r) => !r)}>
            {t("Replanifier", "Reschedule")}
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/compose?post=${post.id}`)}>
            {t("Modifier dans Compose", "Edit in Compose")}
          </Button>
          <Button variant="primary" onClick={() => setConfirm("publish")}>
            <span className="flex items-center gap-1.5"><PlayIcon /> {t("Publier maintenant", "Publish now")}</span>
          </Button>
        </div>
      </div>

      {/* Confirmation overlay */}
      {confirm && (
        <ConfirmDialog
          message={
            confirm === "publish"
              ? t("Publier cette publication immédiatement ? Cette action est irréversible.", "Publish this post immediately? This cannot be undone.")
              : t("Supprimer cette publication ? Cette action est irréversible.", "Delete this post? This cannot be undone.")
          }
          confirmLabel={confirm === "publish" ? t("Publier", "Publish") : t("Supprimer", "Delete")}
          danger={confirm === "delete"}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm === "publish" ? handlePublish : handleDelete}
        />
      )}
    </Modal>
  );
}

function ConfirmDialog({
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-ink/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-xs rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
        <p className="text-sm text-ink">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>{t("Annuler", "Cancel")}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 0115-6.7L21 7M21 3v4h-4M21 12a9 9 0 01-15 6.7L3 17m0 4v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}
