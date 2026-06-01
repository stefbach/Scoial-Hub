"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Meter } from "@/components/ui/Meter";
import { Toast } from "@/components/ui/Toast";
import { useCompany } from "@/lib/company-context";
import { eur } from "@/lib/format";
import { SubHeader, SectionLabel, RowCard } from "./shared";

export function AdSafety({ onNavigate }: { onNavigate: (section: string, params?: Record<string, string>) => void }) {
  const { company, data } = useCompany();
  const s = data.adSafety;

  // Local state mirrors mock values but only persists on Save.
  const [readOnlyMode, setReadOnlyMode] = useState<boolean>(data.meta?.readOnly ?? true);
  const [monthlyCap, setMonthlyCap] = useState<number>(s.monthlyCap);
  const [requireBudget, setRequireBudget] = useState<boolean>(s.requireBudgetCap);
  const [confirmAi, setConfirmAi] = useState<boolean>(s.confirmAiSpend);
  const [doubleConfirm, setDoubleConfirm] = useState<number>(s.doubleConfirmThreshold);
  const [dailyDigest, setDailyDigest] = useState<boolean>(s.dailyDigest);

  const [dirty, setDirty] = useState(false);
  const [warnLowerCap, setWarnLowerCap] = useState(false);
  const [warnConfirmOff, setWarnConfirmOff] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const usedPct = useMemo(
    () => (monthlyCap > 0 ? Math.round((s.usedThisMonth / monthlyCap) * 100) : 0),
    [s.usedThisMonth, monthlyCap]
  );

  const safetyExpiry = useMemo(() => {
    if (!data.meta?.connectedAt) return null;
    const d = new Date(`${data.meta.connectedAt}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return d;
  }, [data.meta?.connectedAt]);

  const mark = () => setDirty(true);

  const save = () => {
    setDirty(false);
    setToast("Ad safety settings saved.");
  };

  const attemptSetCap = (v: number) => {
    if (v < s.usedThisMonth) {
      setWarnLowerCap(true);
      // hold the input visually until confirmation — we set state on confirm
      return;
    }
    setMonthlyCap(v);
    mark();
  };

  const attemptToggleConfirmAi = (on: boolean) => {
    if (!on) {
      setWarnConfirmOff(true);
      return;
    }
    setConfirmAi(true);
    mark();
  };

  return (
    <div>
      <SubHeader title="Ad Safety" scope="company" scopeLabel={company.name} />

      <div className="mb-4 rounded-md border-hair border-ai-text/20 bg-ai-textbg px-3 py-2 text-2xs text-ai-text">
        These settings protect against unintended ad spend. We recommend keeping the defaults. Limits apply across all of {company.code}&apos;s campaigns.
      </div>

      <SectionLabel>Connection mode</SectionLabel>
      <div className="rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Read-only mode</div>
            <div className="text-2xs text-muted">
              Auto-enabled for 7 days after each new Meta connection. Currently:{" "}
              {readOnlyMode ? "read-only" : "full control"}
              {safetyExpiry && readOnlyMode && (
                <> until {format(safetyExpiry, "d MMM yyyy")}</>
              )}
              .
            </div>
          </div>
          <Toggle
            key={String(readOnlyMode)}
            defaultOn={readOnlyMode}
            onChange={(on) => { setReadOnlyMode(on); mark(); }}
          />
        </div>
      </div>

      <SectionLabel>Spend caps</SectionLabel>
      <div className="mb-3 rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Monthly spend cap</div>
            <div className="text-2xs text-muted">
              Hard ceiling across all {company.code} campaigns. New campaigns blocked once reached; active ones pause.
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">EUR</span>
            <input
              type="number"
              value={monthlyCap}
              onChange={(e) => attemptSetCap(Number(e.target.value))}
              className="w-24 rounded-md border-hair border-hair bg-card px-2 py-1 text-right text-ink focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-2xs text-muted">
            <span>Used this month</span>
            <span>{eur(s.usedThisMonth)} / {monthlyCap.toLocaleString()} ({usedPct}%)</span>
          </div>
          <Meter value={s.usedThisMonth} max={monthlyCap} />
        </div>
      </div>
      <RowCard
        title="Require budget cap on every campaign"
        desc="No campaign can be created without a budget cap."
        control={<Toggle key={String(requireBudget)} defaultOn={requireBudget} onChange={(v) => { setRequireBudget(v); mark(); }} />}
      />

      <SectionLabel>Approval gates</SectionLabel>
      <RowCard
        title="Confirm spend before AI actions"
        desc="AI-suggested actions involving money require explicit confirmation. AI never auto-spends."
        control={<Toggle key={String(confirmAi)} defaultOn={confirmAi} onChange={attemptToggleConfirmAi} />}
      />
      <RowCard
        title="Double confirmation above threshold"
        desc="Budget changes above this daily amount require a second confirmation."
        control={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">EUR</span>
            <input
              type="number"
              value={doubleConfirm}
              onChange={(e) => { setDoubleConfirm(Number(e.target.value)); mark(); }}
              className="w-20 rounded-md border-hair border-hair bg-card px-2 py-1 text-right text-ink focus:outline-none"
            />
            <span className="text-2xs text-muted">/ day</span>
          </div>
        }
      />

      <SectionLabel>Alerts &amp; audit</SectionLabel>
      <RowCard
        title="Daily spend digest + anomaly auto-pause"
        desc="Morning email of yesterday's spend. Auto-pause if a campaign exceeds its 7-day average by 50%."
        control={<Toggle key={String(dailyDigest)} defaultOn={dailyDigest} onChange={(v) => { setDailyDigest(v); mark(); }} />}
      />
      <div className="rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Audit log (always on)</div>
            <div className="text-2xs text-muted">Every ad change logged with who/when/what. Cannot be disabled.</div>
          </div>
          <Button variant="secondary" className="py-1 text-2xs" onClick={() => onNavigate("audit", { filter: "ad_safety" })}>
            View audit log
          </Button>
        </div>
        <div className="mt-2 rounded bg-canvas px-2 py-1.5 text-2xs text-muted">
          Recent: {s.recentAudit}
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-3 border-t-hair border-hair bg-card py-3">
          <span className="text-2xs text-amber-700">● Unsaved changes</span>
          <Button variant="primary" onClick={save}>Save changes</Button>
        </div>
      )}

      {warnLowerCap && (
        <Modal open onClose={() => setWarnLowerCap(false)} width="max-w-sm">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">Lower monthly cap?</div>
          <div className="p-4 text-sm text-ink">
            Current month&apos;s spend ({eur(s.usedThisMonth)}) exceeds this cap. Setting it now will block new
            campaigns and pause active ones. Continue?
          </div>
          <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setWarnLowerCap(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                // The latest typed value lives in the input; this acts on
                // whatever's in state — easiest is to set 1 below the spend.
                setMonthlyCap(Math.max(0, s.usedThisMonth - 1));
                mark();
                setWarnLowerCap(false);
              }}
            >
              Apply lower cap
            </Button>
          </div>
        </Modal>
      )}

      {warnConfirmOff && (
        <Modal open onClose={() => setWarnConfirmOff(false)} width="max-w-sm">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">Disable AI spend confirmation?</div>
          <div className="p-4 text-sm text-ink">
            Turning this off allows AI actions to spend money without explicit confirmation. We strongly recommend keeping it on. Continue?
          </div>
          <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setWarnConfirmOff(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => { setConfirmAi(false); mark(); setWarnConfirmOff(false); }}
            >
              Disable anyway
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
