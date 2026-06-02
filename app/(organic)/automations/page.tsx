"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { Toast } from "@/components/ui/Toast";
import { AutomationModal } from "@/components/organic/AutomationModal";
import {
  deleteAutomation,
  runAutomationNow,
  toggleAutomation,
} from "@/lib/automation-store";
import type { Automation } from "@/lib/types";

const STATUS: Record<Automation["status"], { label: string; tone: "green" | "amber" | "gray" }> = {
  active: { label: "Active", tone: "green" },
  library_low: { label: "Library low", tone: "amber" },
  paused: { label: "Paused", tone: "gray" },
};

type Confirm =
  | { kind: "run"; id: string; name: string }
  | { kind: "delete"; id: string; name: string }
  | null;

export default function AutomationsPage() {
  const { company, data } = useCompany();
  const router = useRouter();
  const a = data.automations;

  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [modal, setModal] = useState<{ open: boolean; automation?: Automation }>({ open: false });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Live counters derived from the rules list.
  const activeCount = a.rules.filter((r) => r.enabled).length;
  const pausedCount = a.rules.filter((r) => !r.enabled).length;

  const goToLibrary = (rule: Automation) => {
    const params = new URLSearchParams();
    params.set("platform", rule.platform);
    if (rule.tagFilter[0]) params.set("tag", rule.tagFilter[0]);
    router.push(`/library?${params.toString()}`);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Automations"
        actions={
          <Button variant="primary" onClick={() => setModal({ open: true })}>
            New automation
          </Button>
        }
      />

      {/* Metric strips */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="metric-strip">
          <div className="section-label mb-1">Active</div>
          <div className="mt-1.5 text-2xl font-bold text-ink">{activeCount}</div>
        </div>
        <div className="metric-strip">
          <div className="section-label mb-1">Paused</div>
          <div className="mt-1.5 text-2xl font-bold text-ink">{pausedCount}</div>
        </div>
        <div className="metric-strip">
          <div className="section-label mb-1">Posts this week</div>
          <div className="mt-1.5 text-2xl font-bold text-ink">{a.postsThisWeek}</div>
        </div>
      </div>

      {/* Rules list */}
      <div className="card divide-y divide-hair overflow-hidden">
        {a.rules.map((rule) => (
          <AutomationRow
            key={rule.id}
            rule={rule}
            onOpenEdit={() => setModal({ open: true, automation: rule })}
            onToggle={() => {
              toggleAutomation(company.id, rule.id);
              refresh();
            }}
            onRun={() => setConfirm({ kind: "run", id: rule.id, name: rule.name })}
            onDelete={() => setConfirm({ kind: "delete", id: rule.id, name: rule.name })}
            onAddTemplates={() => goToLibrary(rule)}
          />
        ))}
        {a.rules.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-2xl shadow-xs">
              ⚡
            </span>
            <div>
              <p className="text-sm font-medium text-ink">No automations yet</p>
              <p className="mt-0.5 text-2xs text-muted">
                Create an automation to post on a recurring schedule without manual effort.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setModal({ open: true })}>
              Create automation
            </Button>
          </div>
        )}
      </div>

      {modal.open && (
        <AutomationModal
          automation={modal.automation}
          onClose={() => setModal({ open: false })}
          onSaved={refresh}
        />
      )}

      {confirm && (
        <ConfirmOverlay
          message={
            confirm.kind === "run"
              ? "Run this automation now? It will pull the next template from the library and create a post immediately."
              : "Delete this automation? This cannot be undone."
          }
          confirmLabel={confirm.kind === "run" ? "Run now" : "Delete"}
          danger={confirm.kind === "delete"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.kind === "run") {
              runAutomationNow(company.id, confirm.id);
              setToast("Automation ran successfully");
            } else {
              deleteAutomation(company.id, confirm.id);
            }
            refresh();
            setConfirm(null);
          }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function AutomationRow({
  rule,
  onOpenEdit,
  onToggle,
  onRun,
  onDelete,
  onAddTemplates,
}: {
  rule: Automation;
  onOpenEdit: () => void;
  onToggle: () => void;
  onRun: () => void;
  onDelete: () => void;
  onAddTemplates: () => void;
}) {
  const st = STATUS[rule.status];
  return (
    <div
      onClick={onOpenEdit}
      className="cursor-pointer px-4 py-4 transition-colors hover:bg-canvas"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{rule.name}</span>
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          </div>
          <div className="mt-1 text-2xs text-muted">
            {rule.account} · {rule.schedule}
            {rule.libraryNote ? ` · ${rule.libraryNote}` : ""}
            {rule.pausedSince ? ` · ${rule.pausedSince}` : ""}
          </div>
          {(rule.next || rule.last || rule.publishedCount != null) && (
            <div className="mt-0.5 flex flex-wrap gap-3 text-2xs text-muted">
              {rule.next && (
                <span>Next: <span className="font-medium text-ink">{rule.next}</span></span>
              )}
              {rule.last && (
                <span>Last: <span className="font-medium text-ink">{rule.last}</span></span>
              )}
              {rule.publishedCount != null && (
                <span><span className="font-medium text-ink">{rule.publishedCount}</span> published</span>
              )}
            </div>
          )}
        </div>
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton title="Run now" onClick={onRun} ariaLabel="Run now">
            <PlayIcon />
          </IconButton>
          <IconButton title="Edit" onClick={onOpenEdit} ariaLabel="Edit automation">
            <PencilIcon />
          </IconButton>
          <IconButton title="Delete" onClick={onDelete} ariaLabel="Delete automation" danger>
            <TrashIcon />
          </IconButton>
          <span className="ml-2">
            <Toggle key={String(rule.enabled)} defaultOn={rule.enabled} onChange={onToggle} />
          </span>
        </div>
      </div>
      {rule.warning && (
        <div
          className="mt-3 flex items-center justify-between rounded-lg bg-warning-50 border border-warning-100 px-3 py-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-2xs text-warning-700">{rule.warning}</span>
          <Button variant="secondary" className="py-1 text-2xs" onClick={onAddTemplates}>
            Add templates
          </Button>
        </div>
      )}
    </div>
  );
}

function IconButton({
  title,
  ariaLabel,
  danger,
  onClick,
  children,
}: {
  title: string;
  ariaLabel: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-canvas ${
        danger ? "text-danger-600 hover:bg-danger-50 hover:text-danger-700" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ConfirmOverlay({
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
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-6 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onCancel} />
      <div className="relative z-50 w-full max-w-sm animate-slide-up rounded-xl border border-hair bg-card p-5 shadow-xl">
        <p className="text-sm leading-relaxed text-ink">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
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
