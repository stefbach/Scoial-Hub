"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { SubHeader, SectionLabel } from "./shared";
import { COMPANIES, ORG_NAME, TEAM } from "@/lib/mock-data";

const INDUSTRIES = ["Healthcare", "Marketing", "Retail", "Education", "Other"];

export function Organization({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [name, setName] = useState(ORG_NAME);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [industry, setIndustry] = useState("Healthcare");
  const [logo, setLogo] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const orgInitials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogo = (file?: File) => {
    if (!file) return;
    setLogo(URL.createObjectURL(file));
  };

  return (
    <div>
      <SubHeader title="Organization" scope="org" scopeLabel={name} />

      {/* Logo */}
      <div className="mb-5 flex items-center gap-4">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-page text-sm font-bold text-white">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="logo" className="h-full w-full object-cover" />
            ) : (
              orgInitials
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-hair border-hair bg-card text-muted shadow-sm hover:text-ink"
            aria-label="Upload organization logo"
          >
            <CameraIcon />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleLogo(e.target.files?.[0] ?? undefined)}
          />
        </div>
        <div className="text-2xs text-muted">JPG or PNG · displayed in nav and exports.</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-medium text-muted">Organization name</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              defaultValue={name}
              onChange={(e) => setPendingName(e.target.value)}
              className="block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
            />
            <Button
              variant="secondary"
              disabled={!pendingName || pendingName === name}
              onClick={() => {
                if (!pendingName) return;
                if (confirm("Renaming will update the organization name everywhere (audit logs, exports, invoices). Continue?")) {
                  setName(pendingName);
                  setPendingName(null);
                  setToast("Organization renamed.");
                }
              }}
            >
              Rename
            </Button>
          </div>
        </div>
        <div>
          <label className="text-2xs font-medium text-muted">Industry</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <SectionLabel>Composition</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate("companies")}
          className="cursor-pointer rounded-md border-hair border-hair bg-canvas p-3 text-left hover:bg-canvas/60"
        >
          <div className="text-sm font-medium text-ink">Companies ({COMPANIES.length})</div>
          <div className="text-2xs text-muted">{COMPANIES.map((c) => c.code).join(", ")}</div>
        </button>
        <button
          onClick={() => onNavigate("team")}
          className="cursor-pointer rounded-md border-hair border-hair bg-canvas p-3 text-left hover:bg-canvas/60"
        >
          <div className="text-sm font-medium text-ink">Team members ({TEAM.length})</div>
          <div className="text-2xs text-muted">{TEAM.map((t) => t.name.split(" ")[0]).join(", ")}</div>
        </button>
      </div>

      <SectionLabel>Subscription &amp; billing</SectionLabel>
      <div className="rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Current plan: Free trial</div>
            <div className="text-2xs text-muted">30 days remaining</div>
          </div>
          <Button variant="primary" disabled title="Billing will be enabled in the next phase.">Upgrade plan</Button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-2xs text-muted">
          <div>Next billing date: —</div>
          <div>Payment method: not set</div>
        </div>
      </div>

      <SectionLabel>Danger zone</SectionLabel>
      <div className="rounded-md border-hair border-red-200 bg-red-50/40 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-red-700">Delete organization</div>
            <div className="text-2xs text-muted">Removes the organization and every company, post, audience, and team member.</div>
          </div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete organization</Button>
        </div>
      </div>

      {deleteOpen && (
        <Modal open onClose={() => setDeleteOpen(false)} width="max-w-md">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
            Delete organization
          </div>
          <div className="space-y-3 p-4 text-sm text-ink">
            <p>This will permanently delete the organization and all its data.</p>
            <p>
              Type <span className="font-semibold">&apos;{name}&apos;</span> to confirm.
            </p>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={name}
              className="w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={deleteText !== name}
              onClick={() => {
                setDeleteOpen(false);
                setDeleteText("");
                setToast("Organization deletion is a mock action — nothing was actually deleted.");
              }}
            >
              Delete forever
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M5 8h3l2-2h4l2 2h3a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
