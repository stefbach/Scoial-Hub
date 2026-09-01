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
  isAccountAdmin,
  onClose,
  onChanged,
  onOptimisticDelete,
  onOptimisticReschedule,
}: {
  companyId: string;
  post: ScheduledPost | null;
  /** Workflow de validation (retour client Rosiane #5) : seul un owner/admin
   *  approuve ou refuse une publication en attente. */
  isAccountAdmin?: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  /** Masque le post de la liste immédiatement (avant le refetch). */
  onOptimisticDelete?: (id: string) => void;
  /** Met à jour la date/heure du post dans la liste immédiatement. */
  onOptimisticReschedule?: (id: string, date: string, time: string) => void;
}) {
  const router = useRouter();
  const t = useT();
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState("09:00");
  const [confirm, setConfirm] = useState<null | "publish" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const [pubError, setPubError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Reset transient state whenever a different post is opened.
  useEffect(() => {
    if (post) {
      setRescheduling(false);
      setConfirm(null);
      setPubError(null);
      setRejecting(false);
      setRejectNote("");
      setApprovalError(null);
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
    onOptimisticReschedule?.(post.id, newDate, time); // reflète la nouvelle date tout de suite
    setBusy(false);
    // On rafraîchit la liste AVANT de fermer pour que la nouvelle date soit
    // immédiatement reflétée dans la liste/calendrier parent.
    await onChanged();
    onClose();
  };

  const handlePublish = async () => {
    setBusy(true);
    setPubError(null);
    // Publication RÉELLE sur le réseau connecté (Facebook/LinkedIn) côté serveur.
    // Si ça échoue (compte non connecté, token expiré…), on remonte l'erreur au
    // lieu de faire croire à une publication réussie.
    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("Publication impossible.", "Could not publish."));
      // Succès → on reflète l'état localement et on ferme.
      publishPost(companyId, post.id);
      setBusy(false);
      setConfirm(null);
      onChanged();
      onClose();
    } catch (e) {
      setBusy(false);
      setConfirm(null);
      setPubError(e instanceof Error ? e.message : t("Publication impossible.", "Could not publish."));
    }
  };

  // Workflow de validation (retour client Rosiane #5) : approuve — la
  // publication repasse "scheduled" et part normalement (cron ou « Publier
  // en avance »).
  const handleApprove = async () => {
    setBusy(true);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("Approbation impossible.", "Could not approve."));
      setBusy(false);
      await onChanged();
      onClose();
    } catch (e) {
      setBusy(false);
      setApprovalError(e instanceof Error ? e.message : t("Approbation impossible.", "Could not approve."));
    }
  };

  // Refuse — repasse "draft" avec le motif, pour que le Community Manager la
  // retrouve dans ses brouillons et la soumette à nouveau après correction.
  const handleReject = async () => {
    setBusy(true);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("Refus impossible.", "Could not reject."));
      setBusy(false);
      setRejecting(false);
      await onChanged();
      onClose();
    } catch (e) {
      setBusy(false);
      setApprovalError(e instanceof Error ? e.message : t("Refus impossible.", "Could not reject."));
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    onOptimisticDelete?.(post.id); // disparaît de la liste immédiatement
    try {
      await fetch(`/api/scheduled-posts/${post.id}`, { method: "DELETE" });
    } catch { /* store local en repli */ }
    deletePost(companyId, post.id);
    setBusy(false);
    await onChanged();
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
            {post.status === "pending_approval" ? (
              <StatusBadge tone="amber">{t("À valider", "To approve")}</StatusBadge>
            ) : (
              <StatusBadge tone="blue">{t("Planifié", "Scheduled")}</StatusBadge>
            )}
            <PlatformTag platform={post.platform} />
          </div>
          <div className="mt-1.5 text-xs font-medium text-ink">
            {whenLabel(post.date, post.time)}
          </div>
        </div>

        {/* Refusé précédemment (statut redevenu "draft" avec un motif) : le
            Community Manager doit voir pourquoi avant de resoumettre. */}
        {post.status === "draft" && post.approvalNote && (
          <div className="mb-3 rounded-md border-hair border border-danger-200 bg-danger-50 px-3 py-2 text-2xs text-danger-700">
            <span className="font-semibold">{t("Refusé :", "Rejected:")}</span> {post.approvalNote}
          </div>
        )}

        {/* Mode de publication — un post « planifié » PART AUTOMATIQUEMENT à
            l'heure prévue (cron). « Publier maintenant » sert juste à l'envoyer
            en avance. On le dit explicitement pour lever toute ambiguïté. */}
        <div className="mb-3 flex items-center gap-1.5 text-2xs">
          {post.status === "draft" ? (
            <span className="flex items-center gap-1.5 text-muted">
              <EditIcon /> {t("Brouillon — non programmé", "Draft — not scheduled")}
            </span>
          ) : post.status === "pending_approval" ? (
            <span className="flex items-center gap-1.5 text-primary-700">
              <ClockIcon />
              {isAccountAdmin
                ? t("En attente de votre validation.", "Awaiting your approval.")
                : t("En attente de validation par un responsable — ne partira qu'une fois approuvée.", "Awaiting a manager's approval — will only go out once approved.")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-success-700">
              <ClockIcon /> {t("Se publie automatiquement à l'heure prévue", "Publishes automatically at the scheduled time")}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="whitespace-pre-line rounded-md border-hair border-hair bg-canvas p-3 text-sm leading-relaxed text-ink">
          {post.body || post.title}
        </div>

        {/* Media — aperçu réel si l'URL est connue (visuel qui sera publié) */}
        {post.media && (
          <div className="mt-3">
            <div className="section-label mb-1">{t("Média", "Media")}</div>
            <div className="flex h-[90px] w-[120px] items-center justify-center overflow-hidden rounded-md border-hair border-hair bg-canvas">
              {post.media.url ? (
                post.media.kind === "video" ? (
                  <video src={post.media.url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.media.url} alt="" className="h-full w-full object-cover" />
                )
              ) : (
                <span className="text-2xs text-muted">
                  {post.media.kind === "video" ? t("Vidéo", "Video") : t("Image", "Image")}
                </span>
              )}
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

        {/* Refus inline (workflow de validation) — motif optionnel, transmis
            au Community Manager pour qu'il sache quoi corriger. */}
        {rejecting && (
          <div className="mt-3 rounded-md border-hair border-hair bg-canvas p-3">
            <div className="section-label mb-2">{t("Motif du refus (optionnel)", "Reason for rejection (optional)")}</div>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={t("Ex. : ton à adoucir, visuel à changer…", "E.g.: soften the tone, change the visual…")}
              className="w-full resize-none rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejecting(false)}>{t("Annuler", "Cancel")}</Button>
              <Button variant="danger" onClick={handleReject} disabled={busy}>
                {busy ? t("Envoi…", "Sending…") : t("Confirmer le refus", "Confirm rejection")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Erreur de publication (réseau non connecté, token expiré, refus Graph…) */}
      {pubError && (
        <div className="mx-4 mb-1 rounded-md border-hair border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {pubError}
        </div>
      )}
      {approvalError && (
        <div className="mx-4 mb-1 rounded-md border-hair border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {approvalError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="danger" onClick={() => setConfirm("delete")}>
          <span className="flex items-center gap-1.5"><TrashIcon /> {t("Supprimer", "Delete")}</span>
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setRescheduling((r) => !r)}>
            {t("Replanifier", "Reschedule")}
          </Button>
          {/* Un brouillon se reprend par `?draft=` : c'est le paramètre que
              l'écran de rédaction attend pour le retrouver (R27 #8). */}
          <Button
            variant="secondary"
            onClick={() =>
              router.push(post.status === "draft" ? `/compose?draft=${post.id}` : `/compose?post=${post.id}`)
            }
          >
            {t("Modifier dans Compose", "Edit in Compose")}
          </Button>
          {post.status === "pending_approval" ? (
            isAccountAdmin && (
              <>
                <Button variant="secondary" onClick={() => setRejecting((r) => !r)} disabled={busy}>
                  {t("Refuser", "Reject")}
                </Button>
                <Button variant="primary" onClick={handleApprove} disabled={busy}>
                  {busy ? t("Approbation…", "Approving…") : t("Approuver", "Approve")}
                </Button>
              </>
            )
          ) : (
            <Button variant="primary" onClick={() => setConfirm("publish")}>
              <span className="flex items-center gap-1.5"><PlayIcon /> {t("Publier en avance", "Publish early")}</span>
            </Button>
          )}
        </div>
      </div>
      {post.status !== "draft" && post.status !== "pending_approval" && (
        <p className="px-4 pb-3 -mt-1 text-2xs text-muted">
          {t("Inutile de cliquer : ce post part seul à l'heure prévue. « Publier en avance » l'envoie tout de suite.",
             "No need to click: this post goes out on its own at the scheduled time. “Publish early” sends it right now.")}
        </p>
      )}

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
    <div className="confirm-scrim absolute inset-0 z-10 flex items-center justify-center rounded-2xl p-6">
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

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
