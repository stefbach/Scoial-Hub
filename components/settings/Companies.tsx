"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { SubHeader } from "./shared";
import { COMPANIES, ORG_NAME } from "@/lib/mock-data";
import type { Company } from "@/lib/types";

export function Companies() {
  const [open, setOpen] = useState<{ mode: "new" | "edit"; company?: Company } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Frontend-only: render from the imported COMPANIES list; mutations are
  // session-only (re-rendering on this page only).
  const [_, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  return (
    <div>
      <SubHeader title="Companies" scope="org" scopeLabel={ORG_NAME} />
      <p className="mb-4 text-sm text-muted">Each company has its own social accounts, library, and campaigns.</p>

      <div className="space-y-2">
        {COMPANIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpen({ mode: "edit", company: c })}
            className="flex w-full cursor-pointer items-center gap-3 rounded-md border-hair border-hair bg-canvas px-3 py-2.5 text-left transition-colors hover:bg-canvas/60"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-2xs font-bold text-white"
              style={{ backgroundColor: c.accent }}
            >
              {c.code}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{c.name}</div>
              <div className="truncate text-2xs text-muted">Brand voice: {c.brandVoice}</div>
            </div>
            <span className="text-muted">›</span>
          </button>
        ))}
      </div>

      <Button variant="secondary" className="mt-3" onClick={() => setOpen({ mode: "new" })}>
        + Add company
      </Button>

      {open && (
        <CompanyModal
          mode={open.mode}
          company={open.company}
          onClose={() => setOpen(null)}
          onSaved={(msg) => {
            setToast(msg);
            refresh();
          }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function CompanyModal({
  mode,
  company,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  company?: Company;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(company?.name ?? "");
  const [brandVoice, setBrandVoice] = useState(company?.brandVoice ?? "");
  const [platforms, setPlatforms] = useState<{ fb: boolean; ig: boolean; ln: boolean }>({
    fb: true,
    ig: true,
    ln: false,
  });
  const [defaultTime, setDefaultTime] = useState("09:00");
  const [needsReviewDefault, setNeedsReviewDefault] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const togglePlatform = (key: keyof typeof platforms) =>
    setPlatforms((p) => ({ ...p, [key]: !p[key] }));

  const editing = mode === "edit";
  const canSave = !!name.trim();

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        {editing ? "Edit company" : "New company"}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <label className="text-2xs font-medium text-muted">Company name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          />
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">Logo</label>
          <div className="mt-1 flex items-center gap-2 rounded-md border-hair border-hair bg-canvas/60 px-3 py-2 text-2xs text-muted">
            <UploadIcon />
            <span>Drop a logo file here, or click to upload (PNG, JPG · up to 5MB)</span>
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">Brand voice</label>
          <textarea
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            className="mt-1 h-20 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-sm text-ink focus:outline-none"
          />
          <div className="mt-1 text-2xs text-muted">
            Used by AI to write in this company&apos;s voice. Be specific: &ldquo;Warm, professional, evidence-based, encouraging&rdquo;
            works better than &ldquo;friendly&rdquo;.
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">Default platforms</label>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-ink">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={platforms.fb} onChange={() => togglePlatform("fb")} />
              Facebook
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={platforms.ig} onChange={() => togglePlatform("ig")} />
              Instagram
            </label>
            <label
              className="flex cursor-not-allowed items-center gap-1.5 text-muted"
              title="LinkedIn not yet connected for this company"
            >
              <input type="checkbox" disabled />
              LinkedIn
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-2xs font-medium text-muted">Default posting time</label>
            <input
              type="time"
              value={defaultTime}
              onChange={(e) => setDefaultTime(e.target.value)}
              className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
            />
          </div>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={needsReviewDefault}
              onChange={() => setNeedsReviewDefault((x) => !x)}
            />
            <span className="text-sm text-ink">New posts default to &lsquo;needs review&rsquo;</span>
          </label>
        </div>

        {editing && (
          <div className="mt-2 rounded-md border-hair border-red-200 bg-red-50/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-red-700">Delete company</div>
                <div className="text-2xs text-muted">
                  Removes {company?.name} including its posts, audiences, and campaigns.
                </div>
              </div>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete company</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!canSave}
          onClick={() => {
            onSaved(editing ? `Saved changes to ${name}.` : `Created company ${name}.`);
            onClose();
          }}
        >
          {editing ? "Save changes" : "Create company"}
        </Button>
      </div>

      {editing && deleteOpen && company && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20 p-6">
          <div className="w-full max-w-sm rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">
              This will permanently delete {company.name}.
            </p>
            <p className="mt-1 text-2xs text-muted">
              Type <span className="font-semibold">&apos;{company.name}&apos;</span> to confirm.
            </p>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={company.name}
              className="mt-2 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={deleteText !== company.name}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteText("");
                  onSaved(`Company deletion is a mock action — ${company.name} is preserved.`);
                  onClose();
                }}
              >
                Delete forever
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
