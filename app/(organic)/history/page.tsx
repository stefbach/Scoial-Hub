"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { HistoryDetailModal } from "@/components/organic/HistoryDetailModal";
import { Modal } from "@/components/ui/Modal";
import {
  deleteHistoryItem,
  downloadFile,
  toCsv,
  toJson,
} from "@/lib/history-store";
import type { HistoryItem } from "@/lib/types";

type RangeId = "7d" | "30d" | "90d" | "1y" | "all" | "custom";

// "Now" is dynamic so the "last 7/30/90 days" filters stay correct over time.
function nowDate(): Date {
  return new Date();
}

function rangeStart(r: RangeId, customFrom?: Date | null): Date | null {
  const d = nowDate();
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
  const t = useT();

  const RANGE_LABEL: Record<RangeId, string> = {
    "7d": t("7 derniers jours", "Last 7 days"),
    "30d": t("30 derniers jours", "Last 30 days"),
    "90d": t("90 derniers jours", "Last 90 days"),
    "1y": t("Dernière année", "Last year"),
    all: t("Tout le temps", "All time"),
    custom: t("Plage personnalisée", "Custom range"),
  };

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
  const refresh = () => setTick((n) => n + 1);

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
    const d = new Date(ts);
    if (start && d < start) return false;
    if (end && d > end) return false;
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
        placeholder={t("Rechercher dans l'historique…", "Search post history…")}
        className="input"
      />
      {range === "custom" && (
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted">{t("Du", "From")}</span>
          <div className="w-40">
            <DatePicker value={customFrom ?? nowDate()} onChange={setCustomFrom} />
          </div>
          <span className="text-2xs text-muted">{t("au", "to")}</span>
          <div className="w-40">
            <DatePicker value={customTo ?? nowDate()} onChange={setCustomTo} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t("Historique", "History")}
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
                  {t("Exporter", "Export")}
                </button>
              )}
            >
              {(close) => (
                <>
                  <DropdownItem onClick={() => { onExport("csv"); close(); }}>
                    {t("Exporter en CSV", "Export as CSV")}
                  </DropdownItem>
                  <DropdownItem onClick={() => { onExport("json"); close(); }}>
                    {t("Exporter en JSON", "Export as JSON")}
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
            label: `${t("Tout", "All")} (${allItems.length})`,
            content: (
              <>
                {filterBar}
                <List items={allItems} onOpen={setOpenPost} />
              </>
            ),
          },
          {
            id: "pub",
            label: `${t("Publiés", "Published")} (${published.length})`,
            content: (
              <>
                {filterBar}
                <List items={published} onOpen={setOpenPost} />
              </>
            ),
          },
          {
            id: "fail",
            label: `${t("Échoués", "Failed")} (${failed.length})`,
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

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        width="max-w-sm"
      >
        <div className="p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-ink">
            {t("Supprimer cette publication de l'historique ? Cette action est irréversible.", "Delete this post from history? This cannot be undone.")}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>{t("Annuler", "Cancel")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirmDelete) return;
                deleteHistoryItem(company.id, confirmDelete.id);
                setConfirmDelete(null);
                setOpenPost(null);
                refresh();
              }}
            >
              {t("Supprimer", "Delete")}
            </Button>
          </div>
        </div>
      </Modal>
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
  const t = useT();
  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-4 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-2xl shadow-xs">
          📋
        </span>
        <div>
          <p className="text-sm font-medium text-ink">{t("Aucune publication ne correspond à ces filtres", "No posts match these filters")}</p>
          <p className="mt-0.5 text-2xs text-muted">
            {t("Essayez de changer la plage de dates ou d'effacer la recherche.", "Try changing the date range or clearing the search.")}
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
              <StatusBadge tone="green">{t("Publié", "Published")}</StatusBadge>
            ) : (
              <StatusBadge tone="red">{t("Échoué", "Failed")}</StatusBadge>
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
                  {t("Réessayer", "Retry")}
                </Button>
              </span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
