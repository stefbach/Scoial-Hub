"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useCompany } from "@/lib/company-context";
import { findAdSet } from "@/lib/campaign-store";
import { deleteAudience, duplicateAudience } from "@/lib/audience-store";
import type { Audience, AudienceType } from "@/lib/types";

const TYPE_LABEL: Record<AudienceType, string> = {
  saved: "Saved",
  custom: "Custom",
  lookalike: "Lookalike",
};

const TYPE_STYLE: Record<AudienceType, { bg: string; text: string }> = {
  saved: { bg: "bg-ai-textbg", text: "text-ai-text" },
  custom: { bg: "bg-ai-visualbg", text: "text-ai-visual" },
  lookalike: { bg: "bg-amber-50", text: "text-amber-700" },
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
}

function fmtStamp(iso?: string) {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM HH:mm");
}

export function AudienceDetailModal({
  audience,
  onClose,
  onChanged,
}: {
  audience: Audience | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { company, data } = useCompany();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    if (audience) {
      setConfirmDelete(false);
      setShowTechnical(false);
    }
  }, [audience]);

  useEffect(() => {
    if (!audience) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [audience, onClose]);

  if (!audience) return null;

  const typeStyle = TYPE_STYLE[audience.type];
  const usedBy = (audience.usedByAdSetIds ?? [])
    .map((id) => findAdSet(company.id, id))
    .filter((x): x is NonNullable<ReturnType<typeof findAdSet>> => !!x);
  const inUseCount = usedBy.length;

  const handleDuplicate = () => {
    duplicateAudience(company.id, audience.id);
    onChanged();
    onClose();
  };

  const handleDelete = () => {
    deleteAudience(company.id, audience.id);
    onChanged();
    onClose();
  };

  // Find a source lookalike's source audience (if applicable) for the link.
  const sourceAudience = audience.config?.sourceAudienceId
    ? data.audiences.list.find((a) => a.id === audience.config!.sourceAudienceId)
    : undefined;

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b-hair border-hair px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
              {TYPE_LABEL[audience.type]}
            </span>
            {inUseCount > 0 ? (
              <StatusBadge tone="green">In use ({inUseCount})</StatusBadge>
            ) : (
              <StatusBadge tone="gray">Not in use</StatusBadge>
            )}
          </div>
          <h2 className="text-sm font-semibold text-ink">{audience.name}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
        {/* Configuration */}
        <div className="mb-4">
          <div className="section-label mb-1">Configuration</div>
          <dl className="space-y-1 text-2xs">
            {audience.type === "saved" && audience.config && (
              <>
                <Row label="Gender" value={audience.config.gender ?? "—"} />
                <Row label="Age range" value={audience.config.ageRange ?? "—"} />
                <Row label="Locations" value={(audience.config.locations ?? []).join(", ") || "—"} />
                <Row label="Interests" value={(audience.config.interests ?? []).join(", ") || "—"} />
                {audience.config.behaviors && audience.config.behaviors.length > 0 && (
                  <Row label="Behaviors" value={audience.config.behaviors.join(", ")} />
                )}
              </>
            )}
            {audience.type === "custom" && audience.config && (
              <>
                <Row label="Source" value={audience.config.source ?? "—"} />
                <Row label="File name" value={audience.config.fileName ?? "—"} />
                <Row label="Upload date" value={fmtDate(audience.config.uploadDate)} />
                <Row label="Match rate" value={audience.config.matchRate ?? "—"} />
                <Row label="Refreshed" value={fmtDate(audience.config.refreshedAt)} />
                {audience.config.duplicatedFrom && (
                  <Row label="Duplicated from" value={audience.config.duplicatedFrom} />
                )}
              </>
            )}
            {audience.type === "lookalike" && audience.config && (
              <>
                <dt className="text-muted">Source audience</dt>
                <dd className="flex items-center gap-1 text-right text-ink">
                  {audience.config.sourceAudienceName ?? "—"}
                  {sourceAudience && (
                    <span title="View source audience" className="text-muted">
                      <LinkIcon />
                    </span>
                  )}
                </dd>
                <Row label="Similarity" value={audience.config.similarity ?? "—"} />
                <Row label="Countries" value={(audience.config.countries ?? []).join(", ") || "—"} />
              </>
            )}
          </dl>
        </div>

        {/* Reach */}
        <div className="mb-4">
          <div className="section-label mb-1">Reach</div>
          <div className="rounded-md border-hair border-hair bg-canvas p-3 text-xs text-ink">
            <div className="font-medium">{audience.reach} people</div>
            <div className="mt-1 text-2xs text-muted">
              Last synced from Meta: {fmtStamp(audience.lastSyncedAt)}
            </div>
            <div className="text-2xs text-muted">
              Reach updates automatically when Meta is connected.
            </div>
          </div>
        </div>

        {/* Used by */}
        {inUseCount > 0 && (
          <div className="mb-4">
            <div className="section-label mb-1">Used by</div>
            <div className="card divide-y divide-hair">
              {usedBy.map(({ adSet, campaign }) => (
                <Link
                  key={adSet.id}
                  href={`/ad-sets/${adSet.id}`}
                  onClick={onClose}
                  className="flex items-center justify-between px-3 py-2 text-xs text-ink hover:bg-canvas"
                >
                  <div>
                    <div className="font-medium">{adSet.name}</div>
                    <div className="text-2xs text-muted">{campaign.name}</div>
                  </div>
                  <span className="text-muted"><ArrowIcon /></span>
                </Link>
              ))}
            </div>
            <div className="mt-1 text-2xs text-muted">
              Deleting this audience will remove targeting from these ad sets.
            </div>
          </div>
        )}

        {/* Technical details */}
        <div>
          <button
            onClick={() => setShowTechnical((s) => !s)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-2xs text-muted hover:bg-canvas"
          >
            <span>Technical details</span>
            <span className="inline-block transition-transform" style={{ transform: showTechnical ? "rotate(90deg)" : undefined }}>▸</span>
          </button>
          {showTechnical && (
            <dl className="mt-2 space-y-1 text-2xs">
              <Row label="Audience ID" value={audience.id} />
              <Row label="Meta audience ID" value={audience.metaAudienceId ?? "—"} />
              <Row label="Created" value={fmtDate(audience.createdAt)} />
              <Row label="Created by" value={audience.createdBy ?? "—"} />
            </dl>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <span className="flex items-center gap-1.5"><TrashIcon /> Delete</span>
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDuplicate}>
            <span className="flex items-center gap-1.5"><CopyIcon /> Duplicate</span>
          </Button>
          <Button
            variant="primary"
            disabled
            title="Audience editing coming in next update"
          >
            <span className="flex items-center gap-1.5"><EditIcon /> Edit</span>
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20 p-6">
          <div className="w-full max-w-sm rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            {inUseCount > 0 ? (
              <>
                <p className="text-sm text-ink">
                  This audience is used by {inUseCount} ad set{inUseCount === 1 ? "" : "s"}. Deleting it
                  will leave those ad sets without targeting and may pause them. Continue anyway?
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="primary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button variant="danger" onClick={handleDelete}>Delete anyway</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-ink">Delete this audience? This cannot be undone.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button variant="danger" onClick={handleDelete}>Delete</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="8" y="8" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
