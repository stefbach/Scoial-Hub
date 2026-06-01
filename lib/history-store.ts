import { COMPANY_DATA } from "./mock-data";
import type { HistoryItem } from "./types";

export function deleteHistoryItem(companyId: string, id: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.history = data.history.filter((h) => h.id !== id);
}

export function findHistoryItem(companyId: string, id: string) {
  return COMPANY_DATA[companyId]?.history.find((h) => h.id === id);
}

const CSV_COLUMNS = [
  "platform",
  "post_body",
  "source",
  "scheduled_at",
  "published_at",
  "status",
  "reactions",
  "comments",
  "shares",
  "link_clicks",
  "error_message",
] as const;

function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(item: HistoryItem) {
  const errorMsg = item.error
    ? `${item.error.title} — ${item.error.detail}`
    : "";
  return [
    item.platform,
    item.fullBody ?? item.body,
    item.source,
    item.scheduledAt ?? "",
    item.publishedAt ?? "",
    item.status,
    item.metrics?.reactions ?? "",
    item.metrics?.comments ?? "",
    item.metrics?.shares ?? "",
    item.metrics?.linkClicks ?? "",
    errorMsg,
  ]
    .map((v) => escapeCsv(String(v)))
    .join(",");
}

export function toCsv(items: HistoryItem[]) {
  return [CSV_COLUMNS.join(","), ...items.map(toCsvRow)].join("\n");
}

export function toJson(items: HistoryItem[]) {
  return JSON.stringify(
    items.map((i) => ({
      id: i.id,
      platform: i.platform,
      post_body: i.fullBody ?? i.body,
      source: i.source,
      automation_name: i.automationName ?? null,
      scheduled_at: i.scheduledAt ?? null,
      published_at: i.publishedAt ?? null,
      status: i.status,
      reactions: i.metrics?.reactions ?? null,
      comments: i.metrics?.comments ?? null,
      shares: i.metrics?.shares ?? null,
      link_clicks: i.metrics?.linkClicks ?? null,
      external_url: i.externalUrl ?? null,
      error_title: i.error?.title ?? null,
      error_detail: i.error?.detail ?? null,
    })),
    null,
    2
  );
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
