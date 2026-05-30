"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TimePicker } from "@/components/ui/DateTimePicker";
import { TagInput } from "@/components/ui/TagInput";
import { Toggle } from "@/components/ui/Toggle";
import { useCompany } from "@/lib/company-context";
import { addAutomation, updateAutomation } from "@/lib/automation-store";
import type { Automation, OnEmptyBehavior, Platform, WeekDay } from "@/lib/types";

const DAY_ORDER: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<WeekDay, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const DAY_LONG: Record<WeekDay, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const ON_EMPTY: { id: OnEmptyBehavior; label: string; disabled?: boolean; title?: string }[] = [
  { id: "pause_and_alert", label: "Pause & alert me" },
  { id: "loop", label: "Loop and reuse posts" },
  {
    id: "auto_generate",
    label: "Auto-generate with AI",
    disabled: true,
    title: "AI generation will be enabled when the backend is connected",
  },
];

// May 25 2026 = Monday — used to project the "Next 3 posts" preview.
const ANCHOR = new Date("2026-05-25T00:00:00");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_IDX: Record<WeekDay, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

function projectNext(days: WeekDay[], n: number) {
  if (!days.length) return [];
  const selectedIdx = new Set(days.map((d) => DAY_IDX[d]));
  const out: string[] = [];
  for (let offset = 0; offset < 60 && out.length < n; offset++) {
    if (selectedIdx.has(offset % 7)) {
      const d = new Date(ANCHOR.getTime() + offset * 86400000);
      out.push(`${DAY_LABEL[DAY_ORDER[d.getDay() === 0 ? 6 : d.getDay() - 1]]} ${d.getDate()} ${MONTHS[d.getMonth()]}`);
    }
  }
  return out;
}

function daysLabel(days: WeekDay[]) {
  if (days.length === 0) return "no days yet";
  if (days.length === 7) return "every day";
  return days.map((d) => DAY_LONG[d]).join(", ");
}

export function AutomationModal({
  automation,
  onClose,
  onSaved,
}: {
  automation?: Automation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { company, data } = useCompany();
  const editing = !!automation;

  const [name, setName] = useState(automation?.name ?? "");
  const [accountId, setAccountId] = useState<string>(
    automation?.socialAccountId ?? data.accounts[0]?.id ?? ""
  );
  const [days, setDays] = useState<WeekDay[]>(automation?.days ?? []);
  const [time, setTime] = useState(automation?.time ?? "09:00");
  const [library, setLibrary] = useState(automation?.libraryName ?? "");
  const [tagFilter, setTagFilter] = useState<string[]>(automation?.tagFilter ?? []);
  const [onEmpty, setOnEmpty] = useState<OnEmptyBehavior>(automation?.onEmpty ?? "pause_and_alert");
  const [activate, setActivate] = useState(automation?.enabled ?? true);

  const account = data.accounts.find((a) => a.id === accountId);

  // When the social account changes, default the library to that account's library.
  useEffect(() => {
    if (!account) return;
    const libName = `${company.code} ${
      account.platform === "facebook" ? "Facebook" : account.platform === "instagram" ? "Instagram" : "LinkedIn"
    } library`;
    if (!editing || !library) setLibrary(libName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const matchingTemplates = useMemo(() => {
    if (!account) return 0;
    return data.library.templates.filter((t) => {
      if (t.platform !== account.platform) return false;
      if (t.status !== "unused") return false;
      if (tagFilter.length === 0) return true;
      return tagFilter.some((tag) => t.tags.includes(tag));
    }).length;
  }, [data.library.templates, account, tagFilter]);

  const platformLabel = account
    ? account.platform === "facebook" ? "Facebook" : account.platform === "instagram" ? "Instagram" : "LinkedIn"
    : "";

  const summary = account
    ? `This automation will publish 1 post on ${company.code} ${platformLabel} ` +
      `every ${daysLabel(days)} at ${time}, pulling from the ${
        tagFilter.length ? tagFilter.join(" / ") + " library" : library || "library"
      }.`
    : "Pick a social account to see the summary.";

  const nextPreview = projectNext(days, 3);

  const handleSubmit = () => {
    if (!account || !name.trim() || days.length === 0) return;
    const id = automation?.id ?? `auto-${Date.now()}`;
    const sortedDays = DAY_ORDER.filter((d) => days.includes(d));
    const platform: Platform = account.platform;
    const baseSchedule = `${sortedDays.map((d) => DAY_LABEL[d]).join(", ")} at ${time}`;
    const status: Automation["status"] = activate ? "active" : "paused";

    const next: Automation = {
      id,
      name: name.trim(),
      account: `${company.code} ${platformLabel}`,
      socialAccountId: accountId,
      platform,
      days: sortedDays,
      time,
      libraryName: library,
      tagFilter,
      onEmpty,
      schedule: baseSchedule,
      status,
      libraryNote: automation?.libraryNote ?? "",
      next: nextPreview[0],
      last: automation?.last,
      publishedCount: automation?.publishedCount ?? 0,
      lastRunAt: automation?.lastRunAt,
      pausedSince: activate ? undefined : automation?.pausedSince ?? "Paused just now",
      warning: automation?.warning,
      enabled: activate,
    };

    if (editing) updateAutomation(company.id, id, next);
    else addAutomation(company.id, next);
    onSaved();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = !!account && !!name.trim() && days.length > 0;

  return (
    <Modal open onClose={onClose} width="max-w-xl">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        {editing ? "Edit automation" : "New automation"}
      </div>

      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
        <div>
          <label className="text-2xs font-medium text-muted">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. OCC Facebook — M/W/F wellness tips"
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <div className="mt-1 text-2xs text-muted">Internal name, not customer-facing</div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">Post to</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {company.code}{" "}
                {a.platform === "facebook" ? "Facebook" : a.platform === "instagram" ? "Instagram" : "LinkedIn"}
              </option>
            ))}
          </select>
          <div className="mt-1 text-2xs text-muted">One automation = one social account</div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">Days</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAY_ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))
                  }
                  className={`rounded-md px-2.5 py-1 text-2xs font-medium ${
                    on
                      ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                      : "border-hair border-hair bg-card text-muted"
                  }`}
                >
                  {DAY_LABEL[d]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">Time</label>
          <div className="mt-1 w-32">
            <TimePicker value={time} onChange={setTime} />
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">Pull from library</label>
          <select
            value={library}
            onChange={(e) => setLibrary(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {account && (
              <option value={`${company.code} ${platformLabel} library`}>
                {company.code} {platformLabel} library
              </option>
            )}
          </select>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">Tag filter (optional)</label>
          <div className="mt-1">
            <TagInput tags={tagFilter} onChange={setTagFilter} placeholder="e.g. wellness" />
          </div>
          <div className="mt-1 text-2xs text-muted">
            {matchingTemplates} template{matchingTemplates === 1 ? "" : "s"} match this filter
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">When library is empty</label>
          <select
            value={onEmpty}
            onChange={(e) => setOnEmpty(e.target.value as OnEmptyBehavior)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {ON_EMPTY.map((o) => (
              <option key={o.id} value={o.id} disabled={o.disabled} title={o.title}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Live summary */}
        <div className="rounded-lg border-hair border-ai-text/20 bg-ai-textbg p-3 text-xs leading-relaxed text-ai-text">
          {summary}
          {nextPreview.length > 0 && (
            <div className="mt-1 text-ink/80">
              Next 3 posts: {nextPreview.join(", ")}.
            </div>
          )}
        </div>

        <label className="flex items-center justify-between rounded-md border-hair border-hair p-3">
          <div>
            <div className="text-sm font-medium text-ink">Activate immediately?</div>
            <div className="text-2xs text-muted">Otherwise the automation starts paused.</div>
          </div>
          <Toggle defaultOn={activate} onChange={setActivate} />
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
          {editing ? "Save changes" : "Create automation"}
        </Button>
      </div>
    </Modal>
  );
}
