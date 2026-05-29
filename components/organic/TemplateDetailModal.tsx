"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { TagInput } from "@/components/ui/TagInput";
import { deleteTemplates, duplicateTemplate, updateTemplate } from "@/lib/template-store";
import type { Template } from "@/lib/types";

const statusLabel = { unused: "Unused", used: "Used", archived: "Archived" } as const;

function header(t: Template) {
  const base = t.body.split("\n")[0].trim();
  if (!base) return `Template — ${t.platform}`;
  return base.length > 60 ? base.slice(0, 60) + "…" : base;
}

export function TemplateDetailModal({
  companyId,
  template,
  onClose,
  onChanged,
}: {
  companyId: string;
  template: Template | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (template) {
      setEditing(false);
      setConfirmDelete(false);
      setBody(template.body);
      setTags(template.tags);
    }
  }, [template]);

  useEffect(() => {
    if (!template) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [template, onClose]);

  if (!template) return null;

  const saveEdit = () => {
    updateTemplate(companyId, template.id, { body: body.trim(), tags });
    onChanged();
    setEditing(false);
  };

  const handleDuplicate = () => {
    duplicateTemplate(companyId, template.id);
    onChanged();
    onClose();
  };

  const handleDelete = () => {
    deleteTemplates(companyId, [template.id]);
    onChanged();
    onClose();
  };

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="flex items-start justify-between gap-3 border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">{header(template)}</div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <PlatformTag platform={template.platform} />
          {editing ? (
            <div className="flex-1">
              <TagInput tags={tags} onChange={setTags} />
            </div>
          ) : (
            template.tags.map((tag) => (
              <span key={tag} className="rounded bg-canvas px-1.5 py-0.5 text-2xs text-muted">
                {tag}
              </span>
            ))
          )}
        </div>

        {editing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="h-28 w-full resize-none rounded-md border-hair border-hair bg-card p-3 text-sm text-ink focus:outline-none"
          />
        ) : (
          <div className="whitespace-pre-line rounded-md border-hair border-hair bg-canvas p-3 text-sm leading-relaxed text-ink">
            {template.body}
          </div>
        )}

        {template.media.ready && (
          <div className="mt-3">
            <div className="section-label mb-1">Media</div>
            <div className="h-36 w-48 overflow-hidden rounded-md border-hair border-hair bg-canvas">
              {template.media.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={template.media.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xs text-muted">
                  {template.media.kind === "video"
                    ? `AI video · ${template.media.seconds}s`
                    : "AI image"}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 text-2xs text-muted">
          Added {format(new Date(`${template.addedDate}T00:00:00`), "d MMM yyyy")} · Status:{" "}
          {statusLabel[template.status]}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <span className="flex items-center gap-1.5"><TrashIcon /> Delete</span>
        </Button>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" onClick={saveEdit}>Save</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleDuplicate}>Duplicate</Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="primary" onClick={() => router.push(`/compose?template=${template.id}`)}>
                Use now
              </Button>
            </>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20 p-6">
          <div className="w-full max-w-xs rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">Delete this template? This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
