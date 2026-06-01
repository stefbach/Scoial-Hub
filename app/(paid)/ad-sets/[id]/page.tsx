"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { MultiLineChart, type ChartSeries } from "@/components/charts/MultiLineChart";
import { AdSetModal } from "@/components/paid/AdSetModal";
import { AdDetailModal } from "@/components/paid/AdDetailModal";
import { CreateAdModal } from "@/components/paid/CreateAdModal";
import {
  deleteAdSet,
  duplicateAdSet,
  findAdSet,
  hydrateCampaigns,
  toggleAdSet,
  toggleAd,
} from "@/lib/campaign-store";
import { eur } from "@/lib/format";
import type { Ad } from "@/lib/types";

type MetricId = "spend" | "impressions" | "clicks" | "conversions" | "ctr" | "cpc";

const METRICS: { id: MetricId; label: string; color: string; dashed?: boolean }[] = [
  { id: "spend", label: "Spend", color: "#2563eb" },
  { id: "conversions", label: "Conversions", color: "#166534", dashed: true },
  { id: "impressions", label: "Impressions", color: "#d62976" },
  { id: "clicks", label: "Clicks", color: "#7c3aed" },
  { id: "ctr", label: "CTR", color: "#ea580c" },
  { id: "cpc", label: "CPC", color: "#0a66c2" },
];

const GOAL_LABEL = {
  conversions: "Conversions",
  link_clicks: "Link clicks",
  reach: "Reach",
  impressions: "Impressions",
} as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "No end date";
  return format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
}

export default function AdSetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { company } = useCompany();
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    hydrateCampaigns(company.id);
    refresh();
  }, [company.id]);

  const found = findAdSet(company.id, params.id);

  const [activeMetrics, setActiveMetrics] = useState<MetricId[]>(["spend", "conversions"]);
  const [editOpen, setEditOpen] = useState(false);
  const [newAdOpen, setNewAdOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openAd, setOpenAd] = useState<Ad | null>(null);

  const series: ChartSeries[] = useMemo(() => {
    if (!found?.adSet.series) return [];
    return activeMetrics.map((id) => {
      const meta = METRICS.find((m) => m.id === id)!;
      return {
        id,
        label: meta.label,
        color: meta.color,
        dashed: meta.dashed,
        data: found.adSet.series![id],
      };
    });
  }, [found?.adSet.series, activeMetrics]);

  if (!found) {
    return (
      <div>
        <Breadcrumb trail={[{ href: "/campaigns", label: "Campaigns" }, { label: "Not found" }]} />
        <div className="card px-3 py-8 text-center text-sm text-muted">
          Ad set not found.{" "}
          <Link href="/campaigns" className="text-ai-text underline">
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const { adSet, campaign } = found;
  const ads = (campaign.ads ?? []).filter((a) => a.adSetId === adSet.id);
  const goal = GOAL_LABEL[adSet.optimizationGoal ?? "conversions"];
  const enabled = adSet.enabled ?? adSet.status === "active";

  const toggleMetric = (id: MetricId) =>
    setActiveMetrics((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <Breadcrumb
        trail={[
          { href: "/campaigns", label: "Campaigns" },
          { href: `/campaigns/${campaign.id}`, label: campaign.name },
          { label: adSet.name },
        ]}
      />

      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">{adSet.name}</h1>
            <StatusBadge tone={enabled ? "green" : "gray"}>
              {enabled ? "Active" : "Paused"}
            </StatusBadge>
            <StatusBadge tone="blue">{adSet.placement}</StatusBadge>
          </div>
          <div className="mt-1 text-2xs text-muted">
            Audience: <span className="text-ink">{adSet.audienceName ?? "—"}</span>
            {adSet.audienceReach ? ` (${adSet.audienceReach} reach)` : ""}
            {" · "}
            {adSet.budgetType === "lifetime"
              ? `Lifetime budget ${eur(adSet.lifetimeBudget ?? 0)}`
              : `Daily budget ${eur(adSet.dailyBudget)}`}
            {" · "}Optimization: {goal}
            {" · "}Started {fmtDate(adSet.startDate)} · {fmtDate(adSet.endDate ?? null)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Toggle
            key={String(enabled)}
            defaultOn={enabled}
            onChange={() => {
              toggleAdSet(company.id, adSet.id);
              refresh();
            }}
          />
          <Button variant="secondary" onClick={() => setEditOpen(true)}>Edit</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const copy = duplicateAdSet(company.id, adSet.id);
              if (copy) router.push(`/ad-sets/${copy.id}`);
            }}
          >
            Duplicate
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <MetricCard label="Spend" value={eur(adSet.spend ?? 0)} />
        <MetricCard label="Impressions" value={(adSet.impressions ?? 0).toLocaleString()} />
        <MetricCard label="Clicks" value={(adSet.clicks ?? 0).toLocaleString()} />
        <MetricCard label="Conversions" value={String(adSet.conversions ?? 0)} />
      </div>

      {/* Chart */}
      <div className="card mb-5 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-ink">Performance — last 30 days</div>
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((m) => {
              const on = activeMetrics.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMetric(m.id)}
                  className={`rounded-md px-2.5 py-1 text-2xs font-medium ${
                    on
                      ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                      : "border-hair border-hair bg-card text-muted"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <MultiLineChart series={series} />
      </div>

      {/* Ads */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Ads ({ads.length})</h2>
        <Button variant="primary" onClick={() => setNewAdOpen(true)}>+ New ad</Button>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {ads.length === 0 ? (
          <div className="col-span-2 card px-3 py-8 text-center text-sm text-muted">
            No ads yet.
          </div>
        ) : (
          ads.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              onClick={() => setOpenAd(ad)}
              onToggle={() => {
                toggleAd(company.id, ad.id);
                refresh();
              }}
            />
          ))
        )}
      </div>

      {editOpen && (
        <AdSetModal
          campaignId={campaign.id}
          adSet={adSet}
          onClose={() => setEditOpen(false)}
          onSaved={refresh}
        />
      )}

      <CreateAdModal
        open={newAdOpen}
        onClose={() => setNewAdOpen(false)}
        lockedCampaignId={campaign.id}
        lockedAdSetId={adSet.id}
      />

      <AdDetailModal
        ad={openAd}
        context={{
          campaignId: campaign.id,
          campaignName: campaign.name,
          adSetId: adSet.id,
          adSetName: adSet.name,
        }}
        onClose={() => setOpenAd(null)}
        onChanged={refresh}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="absolute inset-0" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-50 w-full max-w-sm rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">
              Delete &ldquo;{adSet.name}&rdquo;? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteAdSet(company.id, adSet.id);
                  router.push(`/campaigns/${campaign.id}`);
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

function AdCard({
  ad,
  onClick,
  onToggle,
}: {
  ad: Ad;
  onClick: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="card cursor-pointer overflow-hidden transition-shadow hover:shadow-sm"
    >
      <div className={`relative flex h-32 items-center justify-center ${ad.thumb}`}>
        {ad.source === "ai_generated" && (
          <span className="absolute right-2 top-2 rounded bg-ai-visual px-2 py-0.5 text-2xs font-medium text-white">
            AI
          </span>
        )}
        <ImageIcon />
      </div>
      <div className="p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink">{ad.name}</span>
          <StatusBadge tone={ad.status === "active" ? "green" : "gray"}>
            {ad.status === "active" ? "Active" : "Paused"}
          </StatusBadge>
        </div>
        <p className="line-clamp-2 text-2xs text-muted">
          <span className="font-medium text-ink">{ad.headline}</span> — {ad.bodyText}
        </p>
        <div className="mt-2 flex items-center justify-between text-2xs">
          <div className="flex gap-3">
            <span><span className="text-muted">Spend</span> <span className="font-medium text-ink">{eur(ad.spend)}</span></span>
            <span><span className="text-muted">CTR</span> <span className="font-medium text-green-600">{ad.ctr}</span></span>
            <span><span className="text-muted">Conv.</span> <span className="font-medium text-ink">{ad.conversions}</span></span>
          </div>
          <span onClick={(e) => e.stopPropagation()}>
            <Toggle key={ad.status} defaultOn={ad.status === "active"} onChange={onToggle} />
          </span>
        </div>
      </div>
    </div>
  );
}

function ImageIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-muted">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 17l-5-5-9 9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
