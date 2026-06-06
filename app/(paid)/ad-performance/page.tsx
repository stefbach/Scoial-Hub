"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { MultiLineChart, type ChartSeries } from "@/components/charts/MultiLineChart";
import { AdDetailModal } from "@/components/paid/AdDetailModal";
import { AdSetModal } from "@/components/paid/AdSetModal";
import { hydrateCampaigns } from "@/lib/campaign-store";
import { MetaAdAccountsPanel } from "@/components/ads/MetaAdAccountsPanel";
import { AdStrategyBrain } from "@/components/ads/AdStrategyBrain";
import { downloadFile } from "@/lib/history-store";
import { eur } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Ad, AdSet, Campaign, CampaignSeries } from "@/lib/types";

type RangeId = "7d" | "30d" | "90d" | "1y" | "all" | "custom";

type MetricId = "spend" | "impressions" | "clicks" | "conversions" | "ctr" | "cpc";

const METRICS: Record<
  MetricId,
  { label: string; color: string; dashed?: boolean; format: (n: number) => string }
> = {
  spend: { label: "Spend", color: "#2563eb", format: (n) => eur(n) },
  conversions: { label: "Conversions", color: "#166534", dashed: true, format: (n) => `${n}` },
  impressions: { label: "Impressions", color: "#d62976", format: (n) => n.toLocaleString() },
  clicks: { label: "Clicks", color: "#7c3aed", format: (n) => n.toLocaleString() },
  ctr: { label: "CTR", color: "#ea580c", format: (n) => `${n.toFixed(2)}%` },
  cpc: { label: "CPC", color: "#0a66c2", format: (n) => eur(n, { decimals: true }) },
};

type PlatformFilter = "all" | "facebook" | "instagram";
type StatusFilter = "all" | "active" | "paused";
type SortDir = "desc" | "asc" | "off";
type SortKey = "spend" | "ctr" | "cpc" | "conversions";

// "Now" is dynamic so date-range filters stay correct over time.
function nowDate(): Date {
  return new Date();
}

function rangeWindow(range: RangeId, customFrom: Date | null, customTo: Date | null) {
  if (range === "all") return { days: 365, start: null as Date | null, end: null as Date | null };
  if (range === "custom") {
    if (!customFrom) return { days: 30, start: null, end: null };
    const end = customTo ?? nowDate();
    const days = Math.max(1, Math.round((end.getTime() - customFrom.getTime()) / 86400000));
    return { days, start: customFrom, end };
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  return { days, start: null, end: null };
}

function platformFromFormat(fmt?: string): "facebook" | "instagram" {
  return fmt?.startsWith("IG") ? "instagram" : "facebook";
}

interface AdRow {
  ad: Ad;
  adSet?: AdSet;
  campaign: Campaign;
  platform: "facebook" | "instagram";
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

function buildAdRows(campaigns: Campaign[], days: number): AdRow[] {
  const factor = days / 30;
  return campaigns.flatMap((c) => {
    return (c.ads ?? []).map((ad): AdRow => {
      const baseImpr = Math.round(ad.spend * 50);
      const baseClicks = Math.round(baseImpr * 0.025);
      const ctrNum = parseFloat(ad.ctr) || 0;
      const cpcNum = baseClicks > 0 ? Number((ad.spend / baseClicks).toFixed(2)) : 0;
      const cpa = ad.conversions > 0 ? Number((ad.spend / ad.conversions).toFixed(2)) : 0;
      const adSet = c.adSets.find((s) => s.id === ad.adSetId);
      return {
        ad,
        adSet,
        campaign: c,
        platform: platformFromFormat(ad.format),
        spend: Math.round(ad.spend * factor),
        impressions: Math.round(baseImpr * factor),
        clicks: Math.round(baseClicks * factor),
        conversions: Math.round(ad.conversions * factor),
        ctr: ctrNum,
        cpc: cpcNum,
        cpa,
      };
    });
  });
}

function sliceSeries(s: number[] | undefined, days: number): number[] {
  if (!s || !s.length) return [];
  if (days >= s.length) return s;
  return s.slice(-days);
}

function aggregateSeries(rows: AdRow[], days: number): CampaignSeries {
  const out: CampaignSeries = {
    spend: Array(days).fill(0),
    impressions: Array(days).fill(0),
    clicks: Array(days).fill(0),
    conversions: Array(days).fill(0),
    ctr: Array(days).fill(0),
    cpc: Array(days).fill(0),
  };
  const seenCampaigns = new Set<string>();
  const campaigns: Campaign[] = [];
  for (const r of rows) {
    if (!seenCampaigns.has(r.campaign.id)) {
      seenCampaigns.add(r.campaign.id);
      campaigns.push(r.campaign);
    }
  }
  for (const c of campaigns) {
    const s = c.series;
    if (!s) continue;
    const spend = sliceSeries(s.spend, days);
    const impressions = sliceSeries(s.impressions, days);
    const clicks = sliceSeries(s.clicks, days);
    const conversions = sliceSeries(s.conversions, days);
    for (let i = 0; i < days; i++) {
      out.spend[i] += spend[i] ?? 0;
      out.impressions[i] += impressions[i] ?? 0;
      out.clicks[i] += clicks[i] ?? 0;
      out.conversions[i] += conversions[i] ?? 0;
    }
  }
  for (let i = 0; i < days; i++) {
    const im = out.impressions[i];
    const cl = out.clicks[i];
    out.ctr[i] = im > 0 ? Number(((cl / im) * 100).toFixed(2)) : 0;
    out.cpc[i] = cl > 0 ? Number((out.spend[i] / cl).toFixed(2)) : 0;
  }
  return out;
}

function trend(curr: number, prev: number): string {
  if (prev <= 0) return "UP 0%";
  const pct = Math.round(((curr - prev) / prev) * 100);
  return pct >= 0 ? `UP ${pct}%` : `DN ${Math.abs(pct)}%`;
}

export default function AdPerformancePage() {
  return (
    <Suspense fallback={null}>
      <AdPerformanceContent />
    </Suspense>
  );
}

function AdPerformanceContent() {
  const { company, data } = useCompany();
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // ── Totaux RÉELS Meta (Marketing API) pour les KPI ─────────────────
  // Remplacent l'estimation démo dès qu'un compte pub Meta est connecté.
  const [realMeta, setRealMeta] = useState<
    { spend: number; impressions: number; reach: number; clicks: number; conversions: number; cpc: number; count: number } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/meta/adaccounts?companyId=${encodeURIComponent(company.id)}&datePreset=maximum`);
        if (!r.ok) return;
        const d = await r.json();
        const camps = d?.data?.campaigns as
          | Array<{ spend: number; impressions: number; reach: number; clicks: number; conversions: number }>
          | undefined;
        if (!cancelled && Array.isArray(camps) && camps.length > 0) {
          const tot = camps.reduce(
            (a, c) => ({
              spend: a.spend + (c.spend || 0),
              impressions: a.impressions + (c.impressions || 0),
              reach: a.reach + (c.reach || 0),
              clicks: a.clicks + (c.clicks || 0),
              conversions: a.conversions + (c.conversions || 0),
            }),
            { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0 }
          );
          setRealMeta({ ...tot, cpc: tot.clicks ? Number((tot.spend / tot.clicks).toFixed(2)) : 0, count: camps.length });
        }
      } catch {
        /* silencieux — on garde l'estimation démo */
      }
    })();
    return () => { cancelled = true; };
  }, [company.id]);

  const RANGE_LABEL: Record<RangeId, string> = {
    "7d": t("7 derniers jours", "Last 7 days"),
    "30d": t("30 derniers jours", "Last 30 days"),
    "90d": t("90 derniers jours", "Last 90 days"),
    "1y": t("Année écoulée", "Last year"),
    all: t("Tout le temps", "All time"),
    custom: t("Période personnalisée", "Custom range"),
  };
  const PLATFORM_LABEL: Record<PlatformFilter, string> = {
    all: t("Tous", "All"),
    facebook: "Facebook",
    instagram: "Instagram",
  };
  const STATUS_LABEL: Record<StatusFilter, string> = {
    all: t("Tous", "All"),
    active: t("Actif", "Active"),
    paused: t("En pause", "Paused"),
  };

  // Hydration is idempotent — call synchronously so the first render has
  // ads available (otherwise the table body is empty until the effect runs).
  hydrateCampaigns(company.id);

  // ── URL-driven state ──────────────────────────────────────────────
  const rangeParam = params.get("range") as RangeId | null;
  const initialRange: RangeId = rangeParam && RANGE_LABEL[rangeParam] ? rangeParam : "30d";
  const [range, setRange] = useState<RangeId>(initialRange);
  const [customFrom, setCustomFrom] = useState<Date | null>(
    params.get("from") ? new Date(`${params.get("from")}T00:00:00`) : null
  );
  const [customTo, setCustomTo] = useState<Date | null>(
    params.get("to") ? new Date(`${params.get("to")}T00:00:00`) : null
  );

  const focusParam = params.get("focus") as MetricId | null;
  const [focus, setFocus] = useState<MetricId | null>(
    focusParam && METRICS[focusParam] ? focusParam : null
  );

  const initialChips: MetricId[] = focus ? [focus] : ["spend", "conversions"];
  const [chips, setChips] = useState<Set<MetricId>>(new Set(initialChips));

  const initialCampaign = params.get("campaign") ?? "all";
  const initialPlatform = (params.get("platform") as PlatformFilter | null) ?? "all";
  const initialStatus = (params.get("status") as StatusFilter | null) ?? "all";
  const [campaignFilter, setCampaignFilter] = useState<string>(initialCampaign);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(initialPlatform);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [search, setSearch] = useState(params.get("q") ?? "");

  const sortParam = (params.get("sort") as SortKey | null) ?? "spend";
  const sortDirParam = (params.get("dir") as SortDir | null) ?? "desc";
  const [sortKey, setSortKey] = useState<SortKey>(
    sortParam === "ctr" || sortParam === "cpc" || sortParam === "conversions" ? sortParam : "spend"
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    sortDirParam === "asc" || sortDirParam === "off" ? sortDirParam : "desc"
  );

  // Keep URL in sync.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (range !== "30d") qs.set("range", range);
    if (range === "custom") {
      if (customFrom) qs.set("from", format(customFrom, "yyyy-MM-dd"));
      if (customTo) qs.set("to", format(customTo, "yyyy-MM-dd"));
    }
    if (focus) qs.set("focus", focus);
    if (campaignFilter !== "all") qs.set("campaign", campaignFilter);
    if (platformFilter !== "all") qs.set("platform", platformFilter);
    if (statusFilter !== "all") qs.set("status", statusFilter);
    if (search.trim()) qs.set("q", search.trim());
    if (sortKey !== "spend" || sortDir !== "desc") {
      qs.set("sort", sortKey);
      qs.set("dir", sortDir);
    }
    const s = qs.toString();
    router.replace(s ? `/ad-performance?${s}` : "/ad-performance");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo, focus, campaignFilter, platformFilter, statusFilter, search, sortKey, sortDir]);

  // ── Derived data ──────────────────────────────────────────────────
  const { days } = rangeWindow(range, customFrom, customTo);
  const allRows = useMemo(
    () => buildAdRows(data.campaigns.list, days),
    [data.campaigns.list, days]
  );

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (campaignFilter !== "all" && r.campaign.id !== campaignFilter) return false;
      if (platformFilter !== "all" && r.platform !== platformFilter) return false;
      if (statusFilter !== "all" && r.ad.status !== statusFilter) return false;
      if (search.trim() && !r.ad.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allRows, campaignFilter, platformFilter, statusFilter, search]);

  const totalSpend = allRows.reduce((s, r) => s + r.spend, 0);
  const totalImpressions = allRows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = allRows.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = allRows.reduce((s, r) => s + r.conversions, 0);
  const avgCpc = totalClicks > 0 ? Number((totalSpend / totalClicks).toFixed(2)) : 0;

  const prevSpend = Math.max(1, Math.round(totalSpend * 0.88));
  const prevImpressions = Math.max(1, Math.round(totalImpressions * 0.92));
  const prevClicks = Math.max(1, Math.round(totalClicks * 0.85));
  const prevConversions = Math.max(1, Math.round(totalConversions * 0.78));
  const prevCpc = Math.max(0.01, Number((avgCpc * 1.03).toFixed(2)));

  const series = useMemo(() => aggregateSeries(allRows, days), [allRows, days]);

  const activeChips: MetricId[] = useMemo(() => {
    if (focus) return [focus];
    return Array.from(chips);
  }, [focus, chips]);

  const chartSeries: ChartSeries[] = useMemo(() => {
    return activeChips.map((id) => {
      const meta = METRICS[id];
      return {
        id,
        label: meta.label,
        color: meta.color,
        dashed: meta.dashed,
        format: meta.format,
        data: series[id],
      };
    });
  }, [activeChips, series]);

  const tableSortKey: SortKey = focus
    ? focus === "impressions" || focus === "clicks"
      ? "spend"
      : (focus as SortKey)
    : sortKey;
  const tableSortDir: SortDir = focus ? "desc" : sortDir;

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    if (tableSortDir === "off") return rows;
    const key = tableSortKey;
    rows.sort((a, b) => {
      const av = a[key] as number;
      const bv = b[key] as number;
      return tableSortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [filteredRows, tableSortKey, tableSortDir]);

  const topPerformer = useMemo(() => {
    const candidates = [...allRows];
    candidates.sort((a, b) => {
      const cpaA = a.conversions > 0 ? a.spend / a.conversions : Infinity;
      const cpaB = b.conversions > 0 ? b.spend / b.conversions : Infinity;
      return cpaA - cpaB;
    });
    return candidates[0];
  }, [allRows]);

  const [openAd, setOpenAd] = useState<AdRow | null>(null);
  const [editAdSet, setEditAdSet] = useState<{ adSet: AdSet; campaignId: string } | null>(null);

  const toggleChip = (id: MetricId) => {
    if (focus) setFocus(null);
    setChips((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFocus = (id: MetricId) => {
    if (focus === id) {
      setFocus(null);
      setChips(new Set(["spend", "conversions"]));
    } else {
      setFocus(id);
      setChips(new Set([id]));
    }
  };

  const onSort = (key: SortKey) => {
    if (focus) return;
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    setSortDir((d) => (d === "desc" ? "asc" : d === "asc" ? "off" : "desc"));
  };

  const exportRows = (kind: "csv" | "json") => {
    const periodStart = format(nowDate(), "yyyy-MM-dd");
    const periodEnd = format(nowDate(), "yyyy-MM-dd");
    const rows = sortedRows.map((r) => ({
      ad_name: r.ad.name,
      ad_set_name: r.adSet?.name ?? r.ad.adSetName,
      campaign_name: r.campaign.name,
      platform: r.platform,
      status: r.ad.status,
      spend: r.spend,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      cpc: r.cpc,
      conversions: r.conversions,
      cpa: r.cpa,
      period_start: periodStart,
      period_end: periodEnd,
    }));
    const today = format(new Date(), "yyyy-MM-dd");
    const file = `social-hub-ad-performance-${company.id}-${today}.${kind === "csv" ? "csv" : "json"}`;
    if (kind === "csv") {
      const columns = Object.keys(rows[0] ?? {
        ad_name: "", ad_set_name: "", campaign_name: "", platform: "", status: "",
        spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, conversions: 0, cpa: 0,
        period_start: "", period_end: "",
      });
      const esc = (v: unknown) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
      downloadFile(file, csv, "text/csv");
    } else {
      downloadFile(file, JSON.stringify(rows, null, 2), "application/json");
    }
  };

  // Vrais totaux Meta présents ?
  const hasRealMeta = !!realMeta && realMeta.count > 0;
  // True when no campaign data exists at all (ni démo, ni réel).
  const hasNoData = data.campaigns.list.length === 0 && !hasRealMeta;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t("Performance des publicités", "Ad Performance")}
        actions={
          <>
            <Dropdown
              align="right"
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas ${range !== "30d" ? "border-primary-400 bg-primary-50 font-medium text-primary-700" : "border-hair bg-card"}`}
                >
                  {RANGE_LABEL[range]}
                  <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0 text-muted">
                    <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
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
                  disabled={hasNoData}
                  className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-card px-3 py-1.5 text-sm text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("Exporter", "Export")}
                  <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0 text-muted">
                    <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
              )}
            >
              {(close) => (
                <>
                  <DropdownItem onClick={() => { exportRows("csv"); close(); }}>{t("Exporter en CSV", "Export as CSV")}</DropdownItem>
                  <DropdownItem onClick={() => { exportRows("json"); close(); }}>{t("Exporter en JSON", "Export as JSON")}</DropdownItem>
                </>
              )}
            </Dropdown>
          </>
        }
      />

      {/* Accès aux comptes publicitaires Meta présents + cerveau IA */}
      <div className="mb-6 space-y-4">
        <MetaAdAccountsPanel />
        <AdStrategyBrain />
      </div>

      {range === "custom" && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-hair bg-card px-4 py-2.5">
          <span className="text-2xs font-medium text-muted">{t("Du", "From")}</span>
          <div className="w-40">
            <DatePicker value={customFrom ?? nowDate()} onChange={setCustomFrom} />
          </div>
          <span className="text-2xs font-medium text-muted">{t("au", "to")}</span>
          <div className="w-40">
            <DatePicker value={customTo ?? nowDate()} onChange={setCustomTo} />
          </div>
        </div>
      )}

      {/* Empty state — no campaigns / no ad data yet */}
      {hasNoData && (
        <div className="mb-6 flex flex-col items-center justify-center rounded-xl border border-hair bg-card px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-canvas">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-muted">
              <rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <h3 className="mb-1 text-sm font-semibold text-ink">
            {t("Pas encore de données publicitaires", "No ad data yet")}
          </h3>
          <p className="max-w-sm text-xs text-muted">
            {t(
              "Les statistiques apparaîtront dès vos premières campagnes. Créez une campagne pour commencer.",
              "Stats will appear once your first campaigns run. Create a campaign to get started."
            )}
          </p>
          <a
            href="/campaigns"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {t("Créer une campagne", "Create a campaign")}
          </a>
        </div>
      )}

      {/* Bandeau : KPI réels (Meta) si compte connecté ; sinon estimation démo. */}
      {!hasNoData && (
        hasRealMeta ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-success-100 bg-success-50 px-4 py-2.5">
            <span className="mt-0.5 shrink-0 rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success-700">
              {t("Réel · Meta", "Real · Meta")}
            </span>
            <p className="text-2xs leading-relaxed text-success-700">
              {t(
                "Les indicateurs ci-dessous proviennent de votre compte Meta Ads (durée de vie). Le graphique temporel et le tableau par publicité plus bas restent une modélisation de démonstration.",
                "The KPIs below come from your Meta Ads account (lifetime). The time chart and per-ad table further down are still a demo model."
              )}
            </p>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning-100 bg-warning-50 px-4 py-2.5">
            <span className="mt-0.5 shrink-0 rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
              {t("Estimation · démo", "Estimate · demo")}
            </span>
            <p className="text-2xs leading-relaxed text-warning-700">
              {t(
                "Impressions, clics, CTR, CPC et tendances sont estimés à partir du budget — ce ne sont pas encore des chiffres réels de la régie publicitaire. Connectez votre compte Meta Ads pour des données réelles.",
                "Impressions, clicks, CTR, CPC and trends are estimated from budget — these are not yet real figures from the ad platform. Connect your Meta Ads account for real data."
              )}
            </p>
          </div>
        )
      )}

      {/* Metric cards — clickable focus */}
      {!hasNoData && (
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label={t("Dépenses", "Spend")}
          value={eur(hasRealMeta ? realMeta!.spend : totalSpend)}
          sub={hasRealMeta ? t("réel · Meta", "real · Meta") : undefined}
          trend={hasRealMeta ? undefined : trend(totalSpend, prevSpend)}
          active={focus === "spend"}
          onClick={() => handleFocus("spend")}
        />
        <MetricCard
          label={t("Impressions", "Impressions")}
          value={(hasRealMeta ? realMeta!.impressions : totalImpressions).toLocaleString()}
          sub={hasRealMeta ? t("réel · Meta", "real · Meta") : undefined}
          trend={hasRealMeta ? undefined : trend(totalImpressions, prevImpressions)}
          active={focus === "impressions"}
          onClick={() => handleFocus("impressions")}
        />
        <MetricCard
          label={t("Clics", "Clicks")}
          value={(hasRealMeta ? realMeta!.clicks : totalClicks).toLocaleString()}
          sub={hasRealMeta ? t("réel · Meta", "real · Meta") : undefined}
          trend={hasRealMeta ? undefined : trend(totalClicks, prevClicks)}
          active={focus === "clicks"}
          onClick={() => handleFocus("clicks")}
        />
        <MetricCard
          label={t("Conversions", "Conversions")}
          value={String(hasRealMeta ? realMeta!.conversions : totalConversions)}
          sub={hasRealMeta ? t("réel · Meta", "real · Meta") : undefined}
          trend={hasRealMeta ? undefined : trend(totalConversions, prevConversions)}
          active={focus === "conversions"}
          onClick={() => handleFocus("conversions")}
        />
        <MetricCard
          label={t("CPC moyen", "Avg. CPC")}
          value={eur(hasRealMeta ? realMeta!.cpc : avgCpc, { decimals: true })}
          sub={hasRealMeta ? t("réel · Meta", "real · Meta") : undefined}
          trend={hasRealMeta ? undefined : trend(prevCpc, avgCpc)}
          active={focus === "cpc"}
          onClick={() => handleFocus("cpc")}
        />
      </div>
      )}

      {/* Chart — only when data exists */}
      {!hasNoData && (
        <div className="card mb-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair bg-canvas/50 px-5 py-3.5">
            <div className="text-sm font-semibold text-ink">{t("Dépenses & conversions dans le temps", "Spend & conversions over time")}</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(METRICS) as MetricId[]).map((id) => {
                const on = activeChips.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleChip(id)}
                    className={`rounded-md px-2.5 py-1 text-2xs font-medium transition-colors ${
                      on
                        ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                        : "border border-hair bg-card text-muted hover:bg-canvas"
                    }`}
                  >
                    {METRICS[id].label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-5">
            <MultiLineChart series={chartSeries} />
          </div>
        </div>
      )}

      {/* Top performing ads — filter bar + table — only when data exists */}
      {!hasNoData && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t("Meilleures publicités", "Top performing ads")}</h2>
            <span className="text-2xs text-muted">{sortedRows.length} {t("pubs", "ads")}</span>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Rechercher des publicités…", "Search ads…")}
                className="input pl-9"
              />
            </div>
            <Dropdown
              align="right"
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs text-ink transition-colors hover:bg-canvas ${campaignFilter !== "all" ? "border-primary-400 bg-primary-50 font-medium text-primary-700" : "border-hair bg-card"}`}
                >
                  {t("Campagne", "Campaign")}:{" "}
                  <span className="font-semibold">
                    {campaignFilter === "all"
                      ? t("Toutes", "All")
                      : data.campaigns.list.find((c) => c.id === campaignFilter)?.name ?? t("Toutes", "All")}
                  </span>
                </button>
              )}
            >
              {(close) => (
                <>
                  <DropdownItem
                    active={campaignFilter === "all"}
                    onClick={() => { setCampaignFilter("all"); close(); }}
                  >
                    {t("Toutes", "All")}
                  </DropdownItem>
                  {data.campaigns.list.map((c) => (
                    <DropdownItem
                      key={c.id}
                      active={campaignFilter === c.id}
                      onClick={() => { setCampaignFilter(c.id); close(); }}
                    >
                      {c.name}
                    </DropdownItem>
                  ))}
                </>
              )}
            </Dropdown>
            <Dropdown
              align="right"
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs text-ink transition-colors hover:bg-canvas ${platformFilter !== "all" ? "border-primary-400 bg-primary-50 font-medium text-primary-700" : "border-hair bg-card"}`}
                >
                  {t("Plateforme", "Platform")}: <span className="font-semibold">{PLATFORM_LABEL[platformFilter]}</span>
                </button>
              )}
            >
              {(close) =>
                (["all", "facebook", "instagram"] as PlatformFilter[]).map((p) => (
                  <DropdownItem
                    key={p}
                    active={p === platformFilter}
                    onClick={() => { setPlatformFilter(p); close(); }}
                  >
                    {PLATFORM_LABEL[p]}
                  </DropdownItem>
                ))
              }
            </Dropdown>
            <Dropdown
              align="right"
              trigger={(open, toggle) => (
                <button
                  onClick={toggle}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs text-ink transition-colors hover:bg-canvas ${statusFilter !== "all" ? "border-primary-400 bg-primary-50 font-medium text-primary-700" : "border-hair bg-card"}`}
                >
                  {t("Statut", "Status")}: <span className="font-semibold">{STATUS_LABEL[statusFilter]}</span>
                </button>
              )}
            >
              {(close) =>
                (["all", "active", "paused"] as StatusFilter[]).map((s) => (
                  <DropdownItem
                    key={s}
                    active={s === statusFilter}
                    onClick={() => { setStatusFilter(s); close(); }}
                  >
                    {STATUS_LABEL[s]}
                  </DropdownItem>
                ))
              }
            </Dropdown>
          </div>

          <div className="card mb-5 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-hair bg-canvas/50 text-left">
                  <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Publicité", "Ad")}</th>
                  <SortHeader label={t("Dépenses", "Spend")} col="spend" tableSortKey={tableSortKey} tableSortDir={tableSortDir} onSort={onSort} />
                  <SortHeader label="CTR" col="ctr" tableSortKey={tableSortKey} tableSortDir={tableSortDir} onSort={onSort} />
                  <SortHeader label="CPC" col="cpc" tableSortKey={tableSortKey} tableSortDir={tableSortDir} onSort={onSort} />
                  <SortHeader label={t("Conv.", "Conv.")} col="conversions" tableSortKey={tableSortKey} tableSortDir={tableSortDir} onSort={onSort} />
                  <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Statut", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                      {t("Aucune publicité ne correspond à ces filtres.", "No ads match these filters.")}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r) => (
                    <tr
                      key={r.ad.id}
                      onClick={() => setOpenAd(r)}
                      className="cursor-pointer transition-colors hover:bg-canvas/70"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-ink">{r.ad.name}</div>
                        <div className="mt-0.5 text-2xs text-muted">
                          {r.campaign.name} · {r.adSet?.name ?? r.ad.adSetName}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-ink">{eur(r.spend)}</td>
                      <td className="px-5 py-3.5 tabular-nums font-medium text-success-600">{r.ctr.toFixed(2)}%</td>
                      <td className="px-5 py-3.5 tabular-nums text-ink">{eur(r.cpc, { decimals: true })}</td>
                      <td className="px-5 py-3.5 tabular-nums text-ink">{r.conversions}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-medium ${
                            r.ad.status === "active"
                              ? "bg-success-50 text-success-700"
                              : "bg-canvas text-muted"
                          }`}
                        >
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                            r.ad.status === "active" ? "bg-success-500" : "bg-muted/40"
                          }`} />
                          {r.ad.status === "active" ? t("Actif", "Active") : t("En pause", "Paused")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* AI insight + actions */}
          {topPerformer && (
            <div className="rounded-xl border border-ai-text/20 bg-ai-textbg px-5 py-4 text-xs text-ai-text">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-ai-visual">
                  <SparkleIcon />
                </span>
                <div className="flex-1">
                  <span className="font-semibold">{t("Insight IA :", "AI insight:")}</span>{" "}
                  <span className="mr-1 rounded bg-warning-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning-700">
                    {t("estimation", "estimate")}
                  </span>{" "}
                  &ldquo;{topPerformer.ad.name}&rdquo; {t("est votre meilleure publicité à", "is your best performer at")}{" "}
                  {eur(topPerformer.conversions > 0 ? Number((topPerformer.spend / topPerformer.conversions).toFixed(2)) : 0, { decimals: true })}{" "}
                  {t("par conversion. Envisagez d'augmenter son budget de 30 %, ou testez des messages similaires dans d'autres campagnes.", "per conversion. Consider increasing its budget by 30%, or testing similar messaging in other campaigns.")}
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() =>
                        topPerformer.adSet &&
                        setEditAdSet({ adSet: topPerformer.adSet, campaignId: topPerformer.campaign.id })
                      }
                      disabled={!topPerformer.adSet}
                      className="rounded-md bg-page px-3 py-1.5 text-2xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("Augmenter le budget", "Increase budget")}
                    </button>
                    <button
                      onClick={() => setOpenAd(topPerformer)}
                      className="rounded-md border border-ai-text/30 bg-card px-3 py-1.5 text-2xs font-medium text-ai-text hover:bg-white"
                    >
                      {t("Générer des publicités similaires", "Generate similar ads")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <AdDetailModal
        ad={openAd?.ad ?? null}
        context={
          openAd
            ? {
                campaignId: openAd.campaign.id,
                campaignName: openAd.campaign.name,
                adSetId: openAd.ad.adSetId,
                adSetName: openAd.adSet?.name ?? openAd.ad.adSetName,
              }
            : undefined
        }
        onClose={() => setOpenAd(null)}
        onChanged={refresh}
      />

      {editAdSet && (
        <AdSetModal
          campaignId={editAdSet.campaignId}
          adSet={editAdSet.adSet}
          onClose={() => setEditAdSet(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function SortHeader({
  label,
  col,
  tableSortKey,
  tableSortDir,
  onSort,
}: {
  label: string;
  col: SortKey;
  tableSortKey: SortKey;
  tableSortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = tableSortKey === col && tableSortDir !== "off";
  return (
    <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 transition-colors ${active ? "text-ink" : "hover:text-ink"}`}
      >
        {label}
        {active && (
          <span aria-hidden="true" className="text-[10px]">{tableSortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </button>
    </th>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
