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
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { MultiLineChart, type ChartSeries } from "@/components/charts/MultiLineChart";
import { NewCampaignModal } from "@/components/paid/NewCampaignModal";
import { AdSetModal } from "@/components/paid/AdSetModal";
import { AdDetailModal } from "@/components/paid/AdDetailModal";
import {
  deleteAdSet,
  deleteCampaign,
  duplicateAdSet,
  duplicateCampaign,
  findCampaign,
  hydrateCampaigns,
  toggleCampaign,
} from "@/lib/campaign-store";
import { eur } from "@/lib/format";
import type { Ad, AdSet, Campaign } from "@/lib/types";

type MetricId = "spend" | "impressions" | "clicks" | "conversions" | "ctr" | "cpc";

const METRICS: { id: MetricId; label: string; color: string; dashed?: boolean }[] = [
  { id: "spend", label: "Spend", color: "#2563eb" },
  { id: "conversions", label: "Conversions", color: "#166534", dashed: true },
  { id: "impressions", label: "Impressions", color: "#d62976" },
  { id: "clicks", label: "Clicks", color: "#7c3aed" },
  { id: "ctr", label: "CTR", color: "#ea580c" },
  { id: "cpc", label: "CPC", color: "#0a66c2" },
];

function fmtDate(iso?: string | null) {
  if (!iso) return "No end date";
  return format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
}

function statusLabel(c: Campaign) {
  return c.enabled ? "Active" : "Paused";
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { company } = useCompany();
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    hydrateCampaigns(company.id);
    refresh();
  }, [company.id]);

  const campaign = findCampaign(company.id, params.id);

  const [activeMetrics, setActiveMetrics] = useState<MetricId[]>(["spend", "conversions"]);
  const [adFilter, setAdFilter] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adSetModal, setAdSetModal] = useState<{ open: boolean; adSet?: AdSet }>({ open: false });
  const [confirmAdSetDelete, setConfirmAdSetDelete] = useState<AdSet | null>(null);
  const [openAd, setOpenAd] = useState<Ad | null>(null);

  const series: ChartSeries[] = useMemo(() => {
    if (!campaign?.series) return [];
    return activeMetrics.map((id) => {
      const meta = METRICS.find((m) => m.id === id)!;
      return {
        id,
        label: meta.label,
        color: meta.color,
        dashed: meta.dashed,
        data: campaign.series![id],
      };
    });
  }, [campaign, activeMetrics]);

  if (!campaign) {
    return (
      <div>
        <Breadcrumb trail={[{ href: "/campaigns", label: "Campaigns" }, { label: "Not found" }]} />
        <div className="card px-3 py-8 text-center text-sm text-muted">
          Campaign not found.{" "}
          <Link href="/campaigns" className="text-ai-text underline">
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const totalAds = campaign.ads?.length ?? 0;
  const filteredAds =
    adFilter === "all"
      ? campaign.ads ?? []
      : (campaign.ads ?? []).filter((a) => a.adSetId === adFilter);

  const toggleMetric = (id: MetricId) =>
    setActiveMetrics((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );

  return (
    <div>
      <Breadcrumb
        trail={[
          { href: "/campaigns", label: "Campaigns" },
          { label: campaign.name },
        ]}
      />

      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">{campaign.name}</h1>
            <StatusBadge tone={campaign.enabled ? "green" : "gray"}>
              {statusLabel(campaign)}
            </StatusBadge>
            <span className="rounded bg-ai-textbg px-1.5 py-0.5 text-2xs text-ai-text">
              {campaign.platforms.join(" + ")}
              {campaign.platforms.length === 1 ? " only" : ""}
            </span>
            <StatusBadge tone="blue">{campaign.objective}</StatusBadge>
          </div>
          <div className="mt-1 text-2xs text-muted">
            Daily budget {eur(campaign.dailyBudget ?? 0)} · Total spent {eur(campaign.spend)} of {eur(campaign.budget)} · Started{" "}
            {fmtDate(campaign.startDate)} · {fmtDate(campaign.endDate)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Toggle
            key={String(campaign.enabled)}
            defaultOn={campaign.enabled}
            onChange={() => {
              toggleCampaign(company.id, campaign.id);
              refresh();
            }}
          />
          <Button variant="secondary" onClick={() => setEditOpen(true)}>Edit</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const copy = duplicateCampaign(company.id, campaign.id);
              if (copy) router.push(`/campaigns/${copy.id}`);
            }}
          >
            Duplicate
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <MetricCard label="Spend" value={eur(campaign.spend)} trend={campaign.spendTrend} />
        <MetricCard label="Impressions" value={(campaign.impressions ?? 0).toLocaleString()} trend={campaign.impressionsTrend} />
        <MetricCard label="Clicks" value={(campaign.clicks ?? 0).toLocaleString()} trend={campaign.clicksTrend} />
        <MetricCard
          label="Conversions"
          value={String(parseInt(campaign.metricsValue.match(/(\d+)/)?.[0] ?? "0", 10) || 0)}
          trend={campaign.conversionsTrend}
        />
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

      {/* Ad sets */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Ad Sets ({campaign.adSets.length})</h2>
        <Button variant="primary" onClick={() => setAdSetModal({ open: true })}>
          + New ad set
        </Button>
      </div>
      <div className="card mb-6 divide-y divide-hair">
        {campaign.adSets.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted">No ad sets yet.</div>
        ) : (
          campaign.adSets.map((set) => (
            <div
              key={set.id}
              className="flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <Link
                href={`/ad-sets/${set.id}`}
                className="flex-1 cursor-pointer hover:bg-canvas"
              >
                <div className="font-medium text-ink hover:underline">{set.name}</div>
                <div className="text-2xs text-muted">
                  {set.placement} · {set.targeting}
                </div>
              </Link>
              <div className="text-2xs text-muted">
                {set.ads} ads · {eur(set.dailyBudget)}/day
              </div>
              <span onClick={(e) => e.stopPropagation()}>
                <Toggle defaultOn={set.enabled ?? true} />
              </span>
              <IconButton
                title="Edit"
                ariaLabel="Edit ad set"
                onClick={() => setAdSetModal({ open: true, adSet: set })}
              >
                <PencilIcon />
              </IconButton>
              <IconButton
                title="Duplicate"
                ariaLabel="Duplicate ad set"
                onClick={() => {
                  duplicateAdSet(company.id, set.id);
                  refresh();
                }}
              >
                <CopyIcon />
              </IconButton>
              <IconButton
                title="Delete"
                ariaLabel="Delete ad set"
                danger
                onClick={() => setConfirmAdSetDelete(set)}
              >
                <TrashIcon />
              </IconButton>
            </div>
          ))
        )}
      </div>

      {/* All ads */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">All Ads in this campaign ({totalAds})</h2>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="rounded-md border-hair border-hair bg-card px-3 py-1.5 text-xs text-ink hover:bg-canvas"
            >
              {adFilter === "all"
                ? "All ad sets"
                : campaign.adSets.find((s) => s.id === adFilter)?.name ?? "Ad set"}
            </button>
          )}
        >
          {(close) => (
            <>
              <DropdownItem
                active={adFilter === "all"}
                onClick={() => {
                  setAdFilter("all");
                  close();
                }}
              >
                All ad sets
              </DropdownItem>
              {campaign.adSets.map((set) => (
                <DropdownItem
                  key={set.id}
                  active={adFilter === set.id}
                  onClick={() => {
                    setAdFilter(set.id);
                    close();
                  }}
                >
                  {set.name}
                </DropdownItem>
              ))}
            </>
          )}
        </Dropdown>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="section-label border-b-hair border-hair text-left">
              <th className="px-3 py-2 font-semibold">AD</th>
              <th className="px-3 py-2 font-semibold">AD SET</th>
              <th className="px-3 py-2 font-semibold">SPEND</th>
              <th className="px-3 py-2 font-semibold">CTR</th>
              <th className="px-3 py-2 font-semibold">CONV.</th>
              <th className="px-3 py-2 font-semibold">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {filteredAds.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">
                  No ads match this filter.
                </td>
              </tr>
            ) : (
              filteredAds.map((ad) => (
                <tr
                  key={ad.id}
                  onClick={() => setOpenAd(ad)}
                  className="cursor-pointer transition-colors hover:bg-canvas"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 shrink-0 rounded ${ad.thumb}`} />
                      <span className="text-ink">{ad.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-2xs text-muted">{ad.adSetName}</td>
                  <td className="px-3 py-2.5 text-ink">{eur(ad.spend)}</td>
                  <td className="px-3 py-2.5 text-green-600">{ad.ctr}</td>
                  <td className="px-3 py-2.5 text-ink">{ad.conversions}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge tone={ad.status === "active" ? "green" : "gray"}>
                      {ad.status === "active" ? "Active" : "Paused"}
                    </StatusBadge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <NewCampaignModal
          open
          campaign={campaign}
          onClose={() => setEditOpen(false)}
          onSaved={refresh}
        />
      )}

      {adSetModal.open && (
        <AdSetModal
          campaignId={campaign.id}
          adSet={adSetModal.adSet}
          onClose={() => setAdSetModal({ open: false })}
          onSaved={refresh}
        />
      )}

      <AdDetailModal
        ad={openAd}
        context={
          openAd
            ? {
                campaignId: campaign.id,
                campaignName: campaign.name,
                adSetId: openAd.adSetId,
                adSetName: openAd.adSetName,
              }
            : undefined
        }
        onClose={() => setOpenAd(null)}
        onChanged={refresh}
      />

      {confirmAdSetDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="absolute inset-0" onClick={() => setConfirmAdSetDelete(null)} />
          <div className="relative z-50 w-full max-w-sm rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">
              Delete &ldquo;{confirmAdSetDelete.name}&rdquo;? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmAdSetDelete(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteAdSet(company.id, confirmAdSetDelete.id);
                  setConfirmAdSetDelete(null);
                  refresh();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="absolute inset-0" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-50 w-full max-w-sm rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">
              Delete &ldquo;{campaign.name}&rdquo;? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteCampaign(company.id, campaign.id);
                  router.push("/campaigns");
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

function IconButton({
  title,
  ariaLabel,
  danger,
  onClick,
  children,
}: {
  title: string;
  ariaLabel: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md hover:bg-canvas ${
        danger ? "text-red-600 hover:bg-red-50" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="8" y="8" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
