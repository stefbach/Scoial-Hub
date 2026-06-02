"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { HistoryDetailModal } from "@/components/organic/HistoryDetailModal";
import {
  deleteHistoryItem,
  downloadFile,
  toCsv,
  toJson,
} from "@/lib/history-store";
import type { HistoryItem } from "@/lib/types";

type RangeId = "7d" | "30d" | "90d" | "1y" | "all" | "custom";

const RANGE_LABEL: Record<RangeId, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
  all: "All time",
  custom: "Custom range",
};

// Anchor "now" to a fixed point matching the seed dates so filtering looks
// natural even months after these mock items were authored.
const NOW = new Date("2026-05-30T00:00:00");

function rangeStart(r: RangeId, customFrom?: Date | null): Date | null {
  const d = new Date(NOW);
  if (r === "7d") d.setDate(d.getDate() - 7);
  else if (r === "30d") d.setDate(d.getDate() - 30);
  else if (r === "90d") d.setDate(d.getDate() - 90);
  else if (r === "1y") d.setFullYear(d.getFullYear() - 1);
  else if (r === "custom") return customFrom ?? null;
  else return null;
  return d;
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryContent() {
  const { company, data } = useCompany();
  const router = useRouter();
  const params = useSearchParams();

  const tabParam = params.get("tab");
  const defaultActiveId =
    tabParam === "published" ? "pub" : tabParam === "failed" ? "fail" : "all";

  const rangeParam = params.get("range") as RangeId | null;
  const initialRange: RangeId =
    rangeParam && RANGE_LABEL[rangeParam] ? rangeParam : "30d";
  const [range, setRange] = useState<RangeId>(initialRange);
  const [customFrom, setCustomFrom] = useState<Date | null>(
    params.get("from") ? new Date(`${params.get("from")}T00:00:00`) : null
  );
  const [customTo, setCustomTo] = useState<Date | null>(
    params.get("to") ? new Date(`${params.get("to")}T00:00:00`) : null
  );

  const [search, setSearch] = useState("");
  const [openPost, setOpenPost] = useState<HistoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HistoryItem | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // Keep URL in sync with the range selection.
  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    if (range === "30d") next.delete("range");
    else next.set("range", range);
    if (range === "custom") {
      if (customFrom) next.set("from", format(customFrom, "yyyy-MM-dd"));
      if (customTo) next.set("to", format(customTo, "yyyy-MM-dd"));
    } else {
      next.delete("from");
      next.delete("to");
    }
    const qs = next.toString();
    router.replace(qs ? `/history?${qs}` : "/history");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo]);

  const start = rangeStart(range, customFrom);
  const end = range === "custom" ? customTo : null;

  const inRange = (i: HistoryItem) => {
    const ts = i.publishedAt ?? i.scheduledAt;
    if (!ts) return true;
    const t = new Date(ts);
    if (start && t < start) return false;
    if (end && t > end) return false;
    return true;
  };

  const matchSearch = (i: HistoryItem) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (i.fullBody ?? i.body).toLowerCase().includes(q) ||
      (i.automationName ?? "").toLowerCase().includes(q)
    );
  };

  const baseFiltered = useMemo(
    () => data.history.filter((i) => inRange(i) && matchSearch(i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.history, range, customFrom, customTo, search]
  );

  const allItems = baseFiltered;
  const published = baseFiltered.filter((i) => i.status === "published");
  const failed = baseFiltered.filter((i) => i.status === "failed");

  // What's actually visible right now depends on which tab is rendered;
  // for export, derive from the URL's tab param.
  const tabItems =
    tabParam === "published"
      ? published
      : tabParam === "failed"
      ? failed
      : allItems;

  const onExport = (kind: "csv" | "json") => {
    const today = format(new Date(), "yyyy-MM-dd");
    const ext = kind === "csv" ? "csv" : "json";
    const content = kind === "csv" ? toCsv(tabItems) : toJson(tabItems);
    const mime = kind === "csv" ? "text/csv" : "application/json";
    downloadFile(`social-hub-history-${company.id}-${today}.${ext}`, content, mime);
  };

  const filterBar = (
    <div className="mb-4 space-y-2.5">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search post history…"
        className="input"
      />
      {range === "custom" && (
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted">From</span>
          <div className="w-40">
            <DatePicker value={customFrom ?? NOW} onChange={setCustomFrom} />
          </div>
          <span className="text-2xs text-muted">to</span>
          <div className="w-40">
            <DatePicker value={customTo ?? NOW} onChange={setCustomTo} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="History"
        actions={
          <>
            <Dropdown
              align="right"
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  className="rounded-lg border border-hair bg-card px-3 py-1.5 text-sm font-medium text-ink shadow-xs hover:bg-canvas transition-colors"
                >
                  {RANGE_LABEL[range]}
                </button>
              )}
            >
              {(close) =>
                (Object.keys(RANGE_LABEL) as RangeId[]).map((r) => (
                  <DropdownItem
                    key={r}
                    active={r === range}
                    onClick={() => {
                      setRange(r);
                      close();
                    }}
                  >
                    {RANGE_LABEL[r]}
                  </DropdownItem>
                ))
              }
            </Dropdown>

            <Dropdown
              align="right"
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  className="rounded-lg border border-hair bg-card px-3 py-1.5 text-sm font-medium text-ink shadow-xs hover:bg-canvas transition-colors"
                >
                  Export
                </button>
              )}
            >
              {(close) => (
                <>
                  <DropdownItem onClick={() => { onExport("csv"); close(); }}>
                    Export as CSV
                  </DropdownItem>
                  <DropdownItem onClick={() => { onExport("json"); close(); }}>
                    Export as JSON
                  </DropdownItem>
                </>
              )}
            </Dropdown>
          </>
        }
      />

      <Tabs
        defaultActiveId={defaultActiveId}
        tabs={[
          {
            id: "all",
            label: `All (${allItems.length})`,
            content: (
              <>
                {filterBar}
                <List items={allItems} onOpen={setOpenPost} />
              </>
            ),
          },
          {
            id: "pub",
            label: `Published (${published.length})`,
            content: (
              <>
                {filterBar}
                <List items={published} onOpen={setOpenPost} />
              </>
            ),
          },
          {
            id: "fail",
            label: `Failed (${failed.length})`,
            content: (
              <>
                {filterBar}
                <List items={failed} onOpen={setOpenPost} />
              </>
            ),
          },
        ]}
      />

      <HistoryDetailModal
        post={openPost}
        onClose={() => setOpenPost(null)}
        onDelete={(id) => {
          const item = data.history.find((h) => h.id === id);
          if (item) setConfirmDelete(item);
        }}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-50 w-full max-w-sm animate-slide-up rounded-xl border border-hair bg-card p-5 shadow-xl">
            <p className="text-sm leading-relaxed text-ink">
              Delete this post from history? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteHistoryItem(company.id, confirmDelete.id);
                  setConfirmDelete(null);
                  setOpenPost(null);
                  refresh();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function List({
  items,
  onOpen,
}: {
  items: HistoryItem[];
  onOpen: (i: HistoryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-4 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-2xl shadow-xs">
          📋
        </span>
        <div>
          <p className="text-sm font-medium text-ink">No posts match these filters</p>
          <p className="mt-0.5 text-2xs text-muted">
            Try changing the date range or clearing the search.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="card divide-y divide-hair overflow-hidden">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onOpen(item)}
          className={`block w-full cursor-pointer text-left transition-colors hover:bg-canvas ${
            item.status === "failed" ? "bg-danger-50/40" : ""
          }`}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <PlatformTag platform={item.platform} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">{item.body}</div>
              <div className="mt-0.5 text-2xs text-muted">
                {item.when} · {item.source}
                {item.stats ? ` · ${item.stats}` : ""}
              </div>
            </div>
            {item.status === "published" ? (
              <StatusBadge tone="green">Published</StatusBadge>
            ) : (
              <StatusBadge tone="red">Failed</StatusBadge>
            )}
          </div>
          {item.error && (
            <div
              className="mx-4 mb-3 flex items-center justify-between rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="text-2xs font-semibold text-danger-700">{item.error.title}</div>
                <div className="text-2xs text-muted">{item.error.detail}</div>
              </div>
              <span onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" className="py-1 text-2xs">
                  Retry
                </Button>
              </span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
