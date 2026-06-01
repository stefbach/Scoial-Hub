"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pills } from "@/components/ui/Tabs";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { useCompany } from "@/lib/company-context";

const OBJECTIVES = [
  { id: "awareness", label: "Awareness" },
  { id: "traffic", label: "Traffic" },
  { id: "engagement", label: "Engagement" },
  { id: "leads", label: "Leads" },
  { id: "sales", label: "Sales" },
  { id: "conversions", label: "Conversions" },
];

export function NewCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { company, data } = useCompany();
  const [startDate, setStartDate] = useState<Date>(new Date("2026-05-27T00:00:00"));
  const [endDate, setEndDate] = useState<Date | null>(null);

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl">
      <div className="border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">New campaign</div>
        <div className="text-2xs text-muted">
          Company: <span className="font-medium text-ink">{company.code}</span>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-4">
        <div className="mb-3">
          <label className="text-2xs font-medium text-muted">Campaign name</label>
          <input
            placeholder="e.g. January Detox Program — Lead Gen"
            className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-2xs font-medium text-muted">Objective</label>
          <Pills options={OBJECTIVES} defaultId="leads" />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-2xs font-medium text-muted">Platforms</label>
          <Pills
            options={[
              { id: "fb", label: "Facebook" },
              { id: "ig", label: "Instagram" },
              { id: "fbig", label: "Facebook + Instagram" },
            ]}
            defaultId="fbig"
            tone="ai"
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-2xs font-medium text-muted">Budget type</label>
            <select className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none">
              <option>Daily budget</option>
              <option>Lifetime budget</option>
            </select>
          </div>
          <div>
            <label className="text-2xs font-medium text-muted">Amount</label>
            <div className="mt-1 flex items-center gap-2 rounded-md border-hair border-hair bg-card px-3 py-2">
              <span className="text-2xs text-muted">EUR</span>
              <input
                defaultValue="40"
                className="w-full bg-transparent text-sm text-ink focus:outline-none"
              />
              <span className="text-2xs text-muted">/ day</span>
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-2xs font-medium text-muted">Start date</label>
            <div className="mt-1">
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
          </div>
          <div>
            <label className="text-2xs font-medium text-muted">End date</label>
            <div className="mt-1 flex items-center gap-2">
              {endDate ? (
                <>
                  <div className="flex-1">
                    <DatePicker value={endDate} onChange={setEndDate} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEndDate(null)}
                    className="rounded-md px-2 py-2 text-2xs text-muted hover:bg-canvas hover:text-ink"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEndDate(startDate)}
                  className="w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-left text-sm text-muted hover:bg-canvas"
                >
                  No end date
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-md border-hair border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-700">
          A budget cap is required on every campaign. Spend stops at {company.code}&apos;s monthly cap of EUR {data.adSafety.monthlyCap.toLocaleString()}.
        </div>
      </div>

      <div className="flex items-center justify-between border-t-hair border-hair px-4 py-3">
        <span className="text-2xs text-muted">
          Safeguards active · Read-only off · EUR {data.adSafety.doubleConfirmThreshold}/day double-confirm
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary">Create campaign</Button>
        </div>
      </div>
    </Modal>
  );
}
