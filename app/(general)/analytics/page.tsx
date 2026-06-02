"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  ANALYTICS_PLATFORM_SHARE,
  ANALYTICS_SERIES,
  ANALYTICS_SUMMARY,
  COMPANIES,
} from "@/lib/mock-data";
import { MetricCard } from "@/components/ui/MetricCard";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { BarRow } from "@/components/charts/BarRow";
import { MultiLineChart, type ChartSeries } from "@/components/charts/MultiLineChart";
import { downloadFile } from "@/lib/history-store";
import { eur } from "@/lib/format";

type RangeId = "7d" | "30d" | "90d" | "1y" | "all" | "custom";
const RANGE_LABEL: Record<RangeId, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
  all: "All time",
  custom: "Custom range",
};

type MetricId = "engagement" | "postsPublished" | "adSpend" | "conversions";
const METRICS: Record<
  MetricId,
  { label: string; color: string; format: (n: number) => string }
> = {
  engagement: { label: "Engagement", color: "#166534", format: (n) => n.toLocaleString() },
  postsPublished: { label: "Posts published", color: "#2563eb", format: (n) => `${n}` },
  adSpend: { label: "Ad spend", color: "#7c3aed", format: (n) => eur(n) },
  conversions: { label: "Conversions", color: "#ea580c", format: (n) => `${n}` },
};

const COMPANY_COLOR: Record<string, string> = {
  occ: "#1e3a5f",
  tibok: "#6b1f3a",
  cvmi: "#166534",
};

// "Now" anchored to the same point as Ad Performance / History.
const NOW = new Date("2026-05-30T00:00:00");

function rangeDays(range: RangeId, customFrom: Date | null, customTo: Date | null) {
  if (range === "all") return 30;
  if (range === "custom") {
    if (!customFrom) return 30;
    const end = customTo ?? NOW;
    return Math.min(30, Math.max(1, Math.round((end.getTime() - customFrom.getTime()) / 86400000)));
  }
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 30; // mock has 30 days; broaden gracefully
  return 30; // 1y same
}

function sliceWindow<T>(arr: T[], days: number): T[] {
  if (days >= arr.length) return arr.slice();
  return arr.slice(-days);
}

function sum(arr: number[]) {
  return arr.reduce((s, n) => s + n, 0);
}

function trend(curr: number, prev: number): string {
  if (prev <= 0) return "UP 0%";
  const pct = Math.round(((curr - prev) / prev) * 100);
  return pct >= 0 ? `UP ${pct}%` : `DN ${Math.abs(pct)}%`;
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const params = useSearchParams();

  // URL-driven state
  const scopeParam = params.get("scope");
  const initialScope =
    scopeParam && (scopeParam === "all" || COMPANIES.some((c) => c.id === scopeParam))
      ? scopeParam
      : "all";
  const [scope, setScope] = useState(initialScope);
  const [scopeOpen, setScopeOpen] = useState(false);

  const rangeParam = params.get("range") as RangeId | null;
  const initialRange: RangeId = rangeParam && RANGE_LABEL[rangeParam] ? rangeParam : "30d";
  const [range, setRange] = useState<RangeId>(initialRange);
  const [customFrom, setCustomFrom] = useState<Date | null>(
    params.get("from") ? new Date(`${params.get("from")}T00:00:00`) : null
  );
  const [customTo, setCustomTo] = useState<Date | null>(
    params.get("to") ? new Date(`${params.get("to")}T00:00:00`) : null
  );

  const trendMetricParam = params.get("metric") as MetricId | null;
  const [trendMetric, setTrendMetric] = useState<MetricId>(
    trendMetricParam && METRICS[trendMetricParam] ? trendMetricParam : "engagement"
  );

  // Keep URL in sync.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (scope !== "all") qs.set("scope", scope);
    if (range !== "30d") qs.set("range", range);
    if (range === "custom") {
      if (customFrom) qs.set("from", format(customFrom, "yyyy-MM-dd"));
      if (customTo) qs.set("to", format(customTo, "yyyy-MM-dd"));
    }
    if (trendMetric !== "engagement") qs.set("metric", trendMetric);
    const s = qs.toString();
    router.replace(s ? `/analytics?${s}` : "/analytics");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, range, customFrom, customTo, trendMetric]);

  const days = rangeDays(range, customFrom, customTo);

  // Companies in scope.
  const inScope = scope === "all" ? COMPANIES : COMPANIES.filter((c) => c.id === scope);

  // Per-company, in-window series for each metric.
  const inWindow = useMemo(() => {
    const out: Record<string, Record<MetricId, number[]>> = {};
    for (const c of inScope) {
      const s = ANALYTICS_SERIES[c.id];
      out[c.id] = {
        postsPublished: sliceWindow(s.postsPublished, days),
        engagement: sliceWindow(s.engagement, days),
        adSpend: sliceWindow(s.adSpend, days),
        conversions: sliceWindow(s.conversions, days),
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, days]);

  // Overview totals + trend (vs previous equivalent window).
  const totals = useMemo(() => {
    const acc: Record<MetricId, number> = {
      postsPublished: 0, engagement: 0, adSpend: 0, conversions: 0,
    };
    for (const c of inScope) for (const m of Object.keys(METRICS) as MetricId[])
      acc[m] += sum(inWindow[c.id][m]);
    return acc;
  }, [inScope, inWindow]);

  const prevTotals = useMemo(() => {
    const acc: Record<MetricId, number> = {
      postsPublished: 0, engagement: 0, adSpend: 0, conversions: 0,
    };
    for (const c of inScope) {
      const s = ANALYTICS_SERIES[c.id];
      // Previous equivalent window from the same 30 days, falling back to a
      // shrunk version when not enough history.
      const total = s.engagement.length;
      const prevStart = Math.max(0, total - days * 2);
      const prevEnd = Math.max(0, total - days);
      const range = (a: number[]) => a.slice(prevStart, prevEnd);
      acc.postsPublished += sum(range(s.postsPublished));
      acc.engagement += sum(range(s.engagement));
      acc.adSpend += sum(range(s.adSpend));
      acc.conversions += sum(range(s.conversions));
    }
    // If the previous window doesn't exist, fall back to ~80% of current.
    for (const m of Object.keys(acc) as MetricId[]) {
      if (acc[m] === 0) acc[m] = Math.max(1, Math.round(totals[m] * 0.8));
    }
    return acc;
  }, [inScope, totals, days]);

  // Engagement by company within current window.
  const byCompany = useMemo(() => {
    const rows = COMPANIES.map((c) => {
      const visible = scope === "all" || scope === c.id;
      const total = visible ? sum(inWindow[c.id]?.engagement ?? []) : 0;
      return { id: c.id, name: c.code, value: total, visible };
    });
    const max = Math.max(1, ...rows.map((r) => r.value));
    const grandTotal = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map((r) => ({
      ...r,
      max,
      pct: Math.round((r.value / grandTotal) * 100),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inWindow, scope]);

  // Engagement by platform (sum across in-scope companies × share).
  const byPlatform = useMemo(() => {
    let fb = 0, ig = 0;
    for (const c of inScope) {
      const eng = sum(inWindow[c.id]?.engagement ?? []);
      const share = ANALYTICS_PLATFORM_SHARE[c.id];
      fb += eng * share.facebook;
      ig += eng * share.instagram;
    }
    const max = Math.max(1, fb, ig);
    return [
      { name: "Facebook", value: Math.round(fb), max, color: "#1877f2", connected: true, target: "facebook" as const },
      { name: "Instagram", value: Math.round(ig), max, color: "#d62976", connected: true, target: "instagram" as const },
      { name: "LinkedIn", value: 0, max, color: "#0a66c2", connected: false, target: "linkedin" as const },
    ];
  }, [inScope, inWindow]);

  // Trend chart series. When scope is "all" → one line per company.
  // When scoped → a single line for that company.
  const trendSeries: ChartSeries[] = useMemo(() => {
    return inScope.map((c) => ({
      id: c.id,
      label: c.code,
      color: COMPANY_COLOR[c.id] ?? "#1e3a5f",
      data: inWindow[c.id]?.[trendMetric] ?? [],
      format: METRICS[trendMetric].format,
    }));
  }, [inScope, inWindow, trendMetric]);

  // Export.
  const handleExport = (kind: "csv" | "json") => {
    const today = format(new Date(), "yyyy-MM-dd");
    const slug = scope === "all" ? "all-companies" : scope;
    const file = `social-hub-analytics-${slug}-${today}.${kind === "csv" ? "csv" : "json"}`;
    const periodEnd = format(NOW, "yyyy-MM-dd");
    const periodStart = format(new Date(NOW.getTime() - (days - 1) * 86400000), "yyyy-MM-dd");
    const rows = inScope.map((c) => ({
      company: c.code,
      posts_published: sum(inWindow[c.id].postsPublished),
      engagement: sum(inWindow[c.id].engagement),
      ad_spend: sum(inWindow[c.id].adSpend),
      conversions: sum(inWindow[c.id].conversions),
      period_start: periodStart,
      period_end: periodEnd,
    }));
    if (scope === "all" && rows.length > 1) {
      rows.push({
        company: "Total",
        posts_published: rows.reduce((s, r) => s + r.posts_published, 0),
        engagement: rows.reduce((s, r) => s + r.engagement, 0),
        ad_spend: rows.reduce((s, r) => s + r.ad_spend, 0),
        conversions: rows.reduce((s, r) => s + r.conversions, 0),
        period_start: periodStart,
        period_end: periodEnd,
      });
    }
    if (kind === "csv") {
      const columns = ["company", "posts_published", "engagement", "ad_spend", "conversions", "period_start", "period_end"];
      const esc = (v: unknown) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [
        columns.join(","),
        ...rows.map((r) => columns.map((c) => esc((r as Record<string, unknown>)[c])).join(",")),
      ].join("\n");
      downloadFile(file, csv, "text/csv");
    } else {
      downloadFile(file, JSON.stringify(rows, null, 2), "application/json");
    }
  };

  // Helpers
  const goToPlatform = (target: "facebook" | "instagram" | "linkedin") => {
    if (target === "linkedin") router.push("/accounts");
    else router.push(`/ad-performance?platform=${target}`);
  };

  const scopeLabel = scope === "all" ? "All companies" : COMPANIES.find((c) => c.id === scope)?.name ?? "All companies";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight text-ink">Analytics</h1>
          <span aria-hidden="true" className="h-4 w-px shrink-0 rounded-full bg-hair" />
          {/* Scope selector */}
          <div className="relative">
            <button
              onClick={() => setScopeOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-hair bg-card px-3 py-1.5 text-sm shadow-xs transition-colors hover:bg-canvas"
            >
              <span className="text-muted">Scope:</span>
              <span className="font-semibold text-ink">{scopeLabel}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted">
                <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
            {scopeOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setScopeOpen(false)} />
                <div className="absolute left-0 z-20 mt-1.5 w-56 rounded-xl border border-hair bg-card shadow-md">
                  <button
                    onClick={() => { setScope("all"); setScopeOpen(false); }}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-canvas ${
                      scope === "all" ? "font-semibold text-ink" : "text-ink/80"
                    }`}
                  >
                    All companies
                  </button>
                  <div className="mx-2 my-1 border-t border-hair" />
                  {COMPANIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setScope(c.id); setScopeOpen(false); }}
                      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-canvas ${
                        scope === c.id ? "font-semibold text-ink" : "text-ink/80"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
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
                  onClick={() => { setRange(r); close(); }}
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
                <DropdownItem onClick={() => { handleExport("csv"); close(); }}>Export as CSV</DropdownItem>
                <DropdownItem onClick={() => { handleExport("json"); close(); }}>Export as JSON</DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {range === "custom" && (
        <div className="mb-4 flex items-center gap-2">
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

      {/* Overview metrics */}
      <div className="section-label mb-3">Overview</div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Posts published" value={totals.postsPublished} trend={trend(totals.postsPublished, prevTotals.postsPublished)} />
        <MetricCard label="Engagement" value={totals.engagement.toLocaleString()} trend={trend(totals.engagement, prevTotals.engagement)} />
        <MetricCard label="Ad spend" value={eur(totals.adSpend)} trend={trend(totals.adSpend, prevTotals.adSpend)} />
        <MetricCard label="Conversions" value={totals.conversions} trend={trend(totals.conversions, prevTotals.conversions)} />
      </div>

      {/* Trend chart */}
      <div className="card mb-6 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-ink">{METRICS[trendMetric].label} over time</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(METRICS) as MetricId[]).map((m) => {
              const on = trendMetric === m;
              return (
                <button
                  key={m}
                  onClick={() => setTrendMetric(m)}
                  className={`rounded-lg px-2.5 py-1 text-2xs font-medium transition-all ${
                    on
                      ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
                      : "border border-hair bg-card text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  {METRICS[m].label}
                </button>
              );
            })}
          </div>
        </div>
        <MultiLineChart series={trendSeries} />
      </div>

      {/* Bar charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="mb-4 text-sm font-semibold text-ink">Engagement by company</div>
          {byCompany.map((c) => (
            <BarRow
              key={c.id}
              label={c.name}
              value={c.visible ? c.value : 0}
              max={c.max}
              color={COMPANY_COLOR[c.id]}
              caption={
                c.visible
                  ? `${c.value.toLocaleString()} · ${c.pct}%`
                  : "Hidden by scope"
              }
              muted={!c.visible}
              onClick={c.visible ? () => setScope(c.id) : undefined}
              title={c.visible ? `Scope to ${c.name}` : undefined}
            />
          ))}
        </div>
        <div className="card p-4">
          <div className="mb-4 text-sm font-semibold text-ink">Performance by platform</div>
          {byPlatform.map((p) => (
            <BarRow
              key={p.name}
              label={p.name}
              value={p.value}
              max={p.max}
              color={p.color}
              caption={p.connected ? p.value.toLocaleString() : "Not connected"}
              muted={!p.connected}
              onClick={() => goToPlatform(p.target)}
              title={
                p.connected
                  ? `View ${p.name} performance`
                  : "Connect LinkedIn to see performance"
              }
            />
          ))}
        </div>
      </div>

      {/* AI summary */}
      <div className="rounded-xl border border-ai-text/20 bg-ai-textbg px-4 py-3.5 text-xs text-ai-text shadow-xs">
        <span className="font-semibold">AI summary:</span> {ANALYTICS_SUMMARY}
      </div>
    </div>
  );
}
