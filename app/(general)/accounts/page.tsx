"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { Toast } from "@/components/ui/Toast";
import { disconnectMeta, setMeta } from "@/lib/connection-store";
import { TEAM } from "@/lib/mock-data";
import type { MetaConnection } from "@/lib/types";

// Anchor "today" to the same point the rest of the app uses for the seed data.
const TODAY = new Date("2026-05-30T00:00:00");
const SAFETY_DAYS = 7;

function readOnlyExpiry(meta?: MetaConnection): Date | null {
  if (!meta?.connectedAt) return null;
  const d = new Date(`${meta.connectedAt}T00:00:00`);
  d.setDate(d.getDate() + SAFETY_DAYS);
  return d;
}

function safetyState(meta?: MetaConnection): "active" | "expired" | "expired-but-kept" | "off" {
  if (!meta || !meta.connected) return "off";
  const exp = readOnlyExpiry(meta);
  if (!exp) return "off";
  const isExpired = TODAY.getTime() >= exp.getTime();
  if (!isExpired && meta.readOnly) return "active";
  if (isExpired && meta.readOnly && meta.keepReadOnlyAfterSafety) return "expired-but-kept";
  if (isExpired && meta.readOnly) return "expired";
  return "off";
}

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  return format(d, "d MMM yyyy");
}

const USER_EMAIL = TEAM[0]?.email ?? "you@example.com";

export default function AccountsPage() {
  const { company, data } = useCompany();
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const meta = data.meta;
  const state = safetyState(meta);
  const expiry = readOnlyExpiry(meta);

  const noticeText = useMemo(() => {
    if (state === "active") {
      return `Ads access: read-only until ${fmtDate(expiry)}. Switch to full control after the safety period.`;
    }
    if (state === "expired-but-kept") {
      return "Ads access: read-only (kept active after safety period). Disable in Manage settings to allow full ad control.";
    }
    return null; // expired-and-off ⇒ full control, no notice
  }, [state, expiry]);

  return (
    <div>
      <PageHeader title="Connected accounts" />

      <div className="mb-4 rounded-md border-hair border-ai-text/20 bg-ai-textbg px-3 py-2.5 text-xs text-ai-text">
        Connect each platform once per company. Meta&apos;s connection covers Facebook and Instagram
        (organic + ads) together. LinkedIn is separate.
      </div>

      <div className="mb-2 text-sm font-medium text-ink">Meta (Facebook + Instagram)</div>
      {meta?.connected ? (
        <ConnectedMetaCard
          companyCode={company.code}
          meta={meta}
          notice={noticeText}
          onReconnectDisabledTooltip="Connection management will be enabled when Meta integration is wired."
          onDisconnect={() => setConfirmDisconnect(true)}
          onManage={() => setManageOpen(true)}
        />
      ) : (
        <DisconnectedMetaCard companyCode={company.code} companyName={company.name} />
      )}

      <div className="mb-2 mt-5 text-sm font-medium text-ink">LinkedIn</div>
      <div className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">LinkedIn Company Page</span>
              <StatusBadge tone="gray">Not connected</StatusBadge>
            </div>
            <div className="mt-0.5 text-2xs text-muted">
              Connect {company.code}&apos;s LinkedIn Company Page to publish organic posts. Requires LinkedIn
              Marketing Developer Platform access (approval takes 5-10 business days).
            </div>
          </div>
          <Button variant="primary" onClick={() => setLinkedinOpen(true)}>Connect</Button>
        </div>
      </div>

      {confirmDisconnect && (
        <DisconnectModal
          companyName={company.name}
          onCancel={() => setConfirmDisconnect(false)}
          onConfirm={() => {
            disconnectMeta(company.id);
            setConfirmDisconnect(false);
            refresh();
          }}
        />
      )}

      {manageOpen && meta && (
        <ManageAdsAccessModal
          companyName={company.name}
          meta={meta}
          expiry={expiry}
          state={state}
          onClose={() => setManageOpen(false)}
          onSave={(keep) => {
            setMeta(company.id, { keepReadOnlyAfterSafety: keep });
            setManageOpen(false);
            refresh();
          }}
        />
      )}

      {linkedinOpen && (
        <LinkedInModal
          companyName={company.name}
          email={USER_EMAIL}
          onClose={() => setLinkedinOpen(false)}
          onNotify={() => {
            setLinkedinOpen(false);
            setToast(`We'll email you at ${USER_EMAIL} when LinkedIn integration is available.`);
          }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function ConnectedMetaCard({
  companyCode,
  meta,
  notice,
  onReconnectDisabledTooltip,
  onDisconnect,
  onManage,
}: {
  companyCode: string;
  meta: MetaConnection;
  notice: string | null;
  onReconnectDisabledTooltip: string;
  onDisconnect: () => void;
  onManage: () => void;
}) {
  return (
    <div className="card mb-5 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">Meta Business Manager</span>
            <StatusBadge tone="green">Connected</StatusBadge>
          </div>
          <div className="mt-0.5 text-2xs text-muted">
            Connected via Meta Official MCP · {meta.connectedAt ? fmtDate(new Date(`${meta.connectedAt}T00:00:00`)) : "—"}
          </div>
          <div className="text-2xs text-muted">
            Business Manager: {meta.businessManagerName ?? `${companyCode} Holdings`}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled title={onReconnectDisabledTooltip}>Reconnect</Button>
          <Button variant="danger" onClick={onDisconnect}>Disconnect</Button>
        </div>
      </div>

      <div className="mt-3 border-t-hair border-hair pt-3">
        <div className="section-label mb-2">Pages &amp; accounts available</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border-hair border-hair bg-canvas px-3 py-2">
            <div className="text-xs font-medium text-ink">{meta.facebookPageName ?? `${companyCode} Facebook Page`}</div>
            <div className="text-2xs text-muted">Organic + Ads</div>
          </div>
          <div className="rounded-md border-hair border-hair bg-canvas px-3 py-2">
            <div className="text-xs font-medium text-ink">{meta.instagramHandle ?? `@${companyCode.toLowerCase()}_mauritius`}</div>
            <div className="text-2xs text-muted">Business · Organic + Ads</div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-3 flex items-center justify-between rounded-md bg-amber-50 px-3 py-2">
          <span className="text-2xs text-amber-700">{notice}</span>
          <Button variant="secondary" className="py-1 text-2xs" onClick={onManage}>Manage</Button>
        </div>
      )}
    </div>
  );
}

function DisconnectedMetaCard({ companyCode, companyName }: { companyCode: string; companyName: string }) {
  return (
    <div className="mb-5 rounded-lg border border-dashed border-hair bg-canvas/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">Meta Business Manager</span>
            <StatusBadge tone="gray">Not connected</StatusBadge>
          </div>
          <div className="mt-0.5 text-2xs text-muted">
            Connect {companyName}&apos;s Facebook Page and Instagram account to publish organic posts and run ads.
          </div>
        </div>
        <Button
          variant="primary"
          disabled
          title="Meta connection will be wired in the next phase."
        >
          Connect
        </Button>
      </div>
      <div className="mt-2 text-2xs text-muted">
        {companyCode} has no Meta connection yet.
      </div>
    </div>
  );
}

function DisconnectModal({
  companyName,
  onCancel,
  onConfirm,
}: {
  companyName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open onClose={onCancel} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        Disconnect Meta from {companyName}?
      </div>
      <div className="p-4 text-sm text-ink">
        All scheduled posts and active campaigns for {companyName} will stop. You can reconnect
        later but data Meta may have deleted in the meantime won&apos;t be recoverable.
      </div>
      <div className="flex items-center justify-between border-t-hair border-hair px-4 py-3">
        <Button variant="danger" onClick={onConfirm}>Disconnect anyway</Button>
        <Button variant="primary" onClick={onCancel}>Cancel</Button>
      </div>
    </Modal>
  );
}

function ManageAdsAccessModal({
  companyName,
  meta,
  expiry,
  state,
  onClose,
  onSave,
}: {
  companyName: string;
  meta: MetaConnection;
  expiry: Date | null;
  state: "active" | "expired" | "expired-but-kept" | "off";
  onClose: () => void;
  onSave: (keep: boolean) => void;
}) {
  const [keep, setKeep] = useState<boolean>(meta.keepReadOnlyAfterSafety);

  const expiryLine =
    state === "active"
      ? `Read-only expires: ${fmtDate(expiry)}`
      : state === "expired-but-kept"
      ? `Safety period ended ${fmtDate(expiry)} — read-only kept on by preference.`
      : state === "expired"
      ? `Safety period ended ${fmtDate(expiry)}.`
      : "Read-only is currently off.";

  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        Manage ads access for {companyName}
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="section-label mb-1">Current state</div>
          <div className="text-sm text-ink">Currently: Read-only mode</div>
          <div className="text-2xs text-muted">
            Social Hub can view ad data but cannot create, edit, or pause ads.
          </div>
          <div className="mt-1 text-2xs text-muted">{expiryLine}</div>
        </div>

        <div>
          <div className="section-label mb-1">Settings</div>
          <label className="flex items-start justify-between gap-3 rounded-md border-hair border-hair p-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">
                Keep read-only mode after the safety period ends
              </div>
              <div className="text-2xs text-muted">
                Recommended if you want to use Social Hub for organic posting and analytics only,
                without giving it permission to spend on ads.
              </div>
            </div>
            <Toggle defaultOn={keep} onChange={setKeep} />
          </label>
        </div>

        <div className="rounded-md border-hair border-amber-200 bg-amber-50 p-3 text-2xs text-amber-700">
          <div className="flex items-start gap-2">
            <InfoIcon />
            <span>
              Once the safety period ends and read-only mode is off, Social Hub can create campaigns,
              modify budgets, and pause ads on your behalf. All actions remain subject to the spend
              safeguards configured in Settings → Ad Safety.
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => onSave(keep)}>Save</Button>
      </div>
    </Modal>
  );
}

function LinkedInModal({
  companyName,
  email,
  onClose,
  onNotify,
}: {
  companyName: string;
  email: string;
  onClose: () => void;
  onNotify: () => void;
}) {
  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        Connect LinkedIn — coming soon
      </div>
      <div className="space-y-3 p-4 text-sm text-ink">
        <p>
          LinkedIn integration requires approval from LinkedIn&apos;s Marketing Developer Platform.
          We&apos;ve applied for access — approval typically takes 5–10 business days after the
          request is submitted.
        </p>
        <p>
          Once approved, you&apos;ll be able to publish organic posts to {companyName}&apos;s LinkedIn
          Company Page. LinkedIn ads are a separate future capability.
        </p>
        <p className="text-2xs text-muted">
          We&apos;ll notify {email} when integration is ready.
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t-hair border-hair px-4 py-3">
        <a
          href="https://developer.linkedin.com/product-catalog/marketing"
          target="_blank"
          rel="noreferrer"
          className="text-2xs text-ai-text underline hover:text-ai-text/80"
        >
          Learn more about LinkedIn API approval
        </a>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-xs text-muted hover:text-ink">
            Close
          </button>
          <Button variant="primary" onClick={onNotify}>Notify me when ready</Button>
        </div>
      </div>
    </Modal>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-amber-700">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
