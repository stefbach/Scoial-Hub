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
import { Modal } from "@/components/ui/Modal";
import {
  deleteAdSet,
  deleteCampaign as deleteCampaignLocal,
  duplicateAdSet,
  duplicateCampaign,
  findCampaign,
  hydrateCampaigns,
  toggleCampaign,
} from "@/lib/campaign-store";
import { eur } from "@/lib/format";
import { useT } from "@/lib/i18n";
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

function fmtDate(iso?: string | null, noEndLabel = "No end date") {
  if (!iso) return noEndLabel;
  return format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { company } = useCompany();
  const t = useT();
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // Bug #19 — fallback API fetch when campaign isn't in the local store
  // (happens for campaigns created via Supabase/IA that aren't in mock-data).
  const [apiCampaign, setApiCampaign] = useState<Campaign | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [apiTick, setApiTick] = useState(0);

  useEffect(() => {
    hydrateCampaigns(company.id);
    refresh();
  }, [company.id]);

  useEffect(() => {
    if (!params.id) return;
    // Try to load from API unconditionally; merge with local store result.
    fetch(`/api/campaigns/${encodeURIComponent(params.id)}`)
      .then((res) => {
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) return null;
        return res.json() as Promise<Campaign>;
      })
      .then((c) => {
        if (c) { setApiCampaign(c); setNotFound(false); }
      })
      .catch(() => {/* silent — local store is the fallback */});
  }, [params.id, apiTick]);

  // Prefer local (hydrated, richer) campaign; fall back to API result.
  const localCampaign = findCampaign(company.id, params.id);
  const campaign: Campaign | undefined = localCampaign ?? apiCampaign ?? undefined;

  // When editing an API-only campaign (not in local store), re-fetch after save
  const refreshAll = () => {
    refresh();
    if (!localCampaign) setApiTick((n) => n + 1);
  };

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

  // Bug #19: show not-found only when the API explicitly returned 404
  // AND the local store has no match (avoids flicker during initial load).
  if (!campaign && notFound) {
    return (
      <div>
        <Breadcrumb trail={[{ href: "/campaigns", label: t("Campagnes", "Campaigns") }, { label: t("Introuvable", "Not found") }]} />
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="text-sm text-muted">{t("Campagne introuvable.", "Campaign not found.")}</div>
          <Link href="/campaigns" className="mt-3 text-sm font-medium text-ai-text hover:underline">
            {t("Retour aux campagnes", "Back to campaigns")}
          </Link>
        </div>
      </div>
    );
  }

  // Still loading — show skeleton-free blank to avoid flicker
  if (!campaign) {
    return (
      <div>
        <Breadcrumb trail={[{ href: "/campaigns", label: t("Campagnes", "Campaigns") }, { label: "…" }]} />
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="text-sm text-muted">{t("Chargement…", "Loading…")}</div>
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
    <div className="animate-fade-in">
      <Breadcrumb
        trail={[
          { href: "/campaigns", label: t("Campagnes", "Campaigns") },
          { label: campaign.name },
        ]}
      />

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{campaign.name}</h1>
            <StatusBadge tone={campaign.enabled ? "green" : "gray"} dot>
              {campaign.enabled ? t("Actif", "Active") : t("En pause", "Paused")}
            </StatusBadge>
            <span className="rounded-md bg-ai-textbg px-2 py-0.5 text-2xs font-medium text-ai-text">
              {campaign.platforms.join(" + ")}
              {campaign.platforms.length === 1 ? t(" seulement", " only") : ""}
            </span>
            <StatusBadge tone="blue">{campaign.objective}</StatusBadge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-muted">
            <span>{t("Budget journalier", "Daily budget")} <span className="font-medium text-ink">{eur(campaign.dailyBudget ?? 0)}</span></span>
            <span className="text-hair">·</span>
            <span>{t("Dépensé", "Spent")} <span className="font-medium text-ink">{eur(campaign.spend)}</span> {t("sur", "of")} {eur(campaign.budget)}</span>
            <span className="text-hair">·</span>
            <span>{t("Démarré le", "Started")} {fmtDate(campaign.startDate, t("Aucune date de début", "No start date"))}</span>
            <span className="text-hair">·</span>
            <span>{fmtDate(campaign.endDate, t("Aucune date de fin", "No end date"))}</span>
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
          <Button variant="secondary" onClick={() => setEditOpen(true)}>{t("Modifier", "Edit")}</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const copy = duplicateCampaign(company.id, campaign.id);
              if (copy) router.push(`/campaigns/${copy.id}`);
            }}
          >
            {t("Dupliquer", "Duplicate")}
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>{t("Supprimer", "Delete")}</Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        <MetricCard label={t("Dépenses", "Spend")} value={eur(campaign.spend)} trend={campaign.spendTrend} />
        <MetricCard label={t("Impressions", "Impressions")} value={(campaign.impressions ?? 0).toLocaleString()} trend={campaign.impressionsTrend} />
        <MetricCard label={t("Clics", "Clicks")} value={(campaign.clicks ?? 0).toLocaleString()} trend={campaign.clicksTrend} />
        <MetricCard
          label={t("Conversions", "Conversions")}
          value={String(parseInt(campaign.metricsValue.match(/(\d+)/)?.[0] ?? "0", 10) || 0)}
          trend={campaign.conversionsTrend}
        />
      </div>

      {/* Chart */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair bg-canvas/50 px-5 py-3.5">
          <div className="text-sm font-semibold text-ink">{t("Performance — 30 derniers jours", "Performance — last 30 days")}</div>
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((m) => {
              const on = activeMetrics.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMetric(m.id)}
                  className={`rounded-md px-2.5 py-1 text-2xs font-medium transition-colors ${
                    on
                      ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                      : "border border-hair bg-card text-muted hover:bg-canvas"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-5">
          <MultiLineChart series={series} />
        </div>
      </div>

      {/* Ad sets */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{t("Ensembles de publicités", "Ad Sets")} ({campaign.adSets.length})</h2>
        <Button variant="primary" onClick={() => setAdSetModal({ open: true })}>
          + {t("Nouvel ensemble", "New ad set")}
        </Button>
      </div>
      <div className="card mb-6 overflow-hidden">
        {campaign.adSets.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted">{t("Aucun ensemble de publicités pour l'instant.", "No ad sets yet.")}</div>
        ) : (
          <div className="divide-y divide-hair">
            {campaign.adSets.map((set) => (
              <div
                key={set.id}
                className="group flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-canvas/70"
              >
                <Link
                  href={`/ad-sets/${set.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="font-medium text-ink hover:underline">{set.name}</div>
                  <div className="mt-0.5 text-2xs text-muted">
                    {set.placement} · {set.targeting}
                  </div>
                </Link>
                <div className="shrink-0 text-2xs tabular-nums text-muted">
                  <span className="font-medium text-ink">{set.ads} {t("pubs", "ads")}</span> · {eur(set.dailyBudget)}/{t("jour", "day")}
                </div>
                <span onClick={(e) => e.stopPropagation()}>
                  <Toggle defaultOn={set.enabled ?? true} />
                </span>
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <IconButton
                    title={t("Modifier", "Edit")}
                    ariaLabel={t("Modifier l'ensemble", "Edit ad set")}
                    onClick={() => setAdSetModal({ open: true, adSet: set })}
                  >
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    title={t("Dupliquer", "Duplicate")}
                    ariaLabel={t("Dupliquer l'ensemble", "Duplicate ad set")}
                    onClick={() => {
                      duplicateAdSet(company.id, set.id);
                      refresh();
                    }}
                  >
                    <CopyIcon />
                  </IconButton>
                  <IconButton
                    title={t("Supprimer", "Delete")}
                    ariaLabel={t("Supprimer l'ensemble", "Delete ad set")}
                    danger
                    onClick={() => setConfirmAdSetDelete(set)}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All ads */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{t("Toutes les publicités de cette campagne", "All Ads in this campaign")} ({totalAds})</h2>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="rounded-md border border-hair bg-card px-3 py-1.5 text-xs text-ink hover:bg-canvas"
            >
              {adFilter === "all"
                ? t("Tous les ensembles", "All ad sets")
                : campaign.adSets.find((s) => s.id === adFilter)?.name ?? t("Ensemble", "Ad set")}
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
                {t("Tous les ensembles", "All ad sets")}
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
      <div className="card mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hair bg-canvas/50 text-left">
              <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Publicité", "Ad")}</th>
              <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Ensemble", "Ad set")}</th>
              <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Dépenses", "Spend")}</th>
              <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">CTR</th>
              <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Conv.", "Conv.")}</th>
              <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Statut", "Status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {filteredAds.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                  {t("Aucune publicité ne correspond à ce filtre.", "No ads match this filter.")}
                </td>
              </tr>
            ) : (
              filteredAds.map((ad) => (
                <tr
                  key={ad.id}
                  onClick={() => setOpenAd(ad)}
                  className="cursor-pointer transition-colors hover:bg-canvas/70"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 shrink-0 rounded-lg ${ad.thumb}`} />
                      <span className="font-medium text-ink">{ad.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-2xs text-muted">{ad.adSetName}</td>
                  <td className="px-5 py-3 tabular-nums text-ink">{eur(ad.spend)}</td>
                  <td className="px-5 py-3 tabular-nums font-medium text-success-600">{ad.ctr}</td>
                  <td className="px-5 py-3 tabular-nums text-ink">{ad.conversions}</td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={ad.status === "active" ? "green" : "gray"} dot>
                      {ad.status === "active" ? t("Actif", "Active") : t("En pause", "Paused")}
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
          onSaved={refreshAll}
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

      <Modal open={!!confirmAdSetDelete} onClose={() => setConfirmAdSetDelete(null)} width="max-w-sm">
        <div className="p-5 sm:p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <TrashIcon />
          </div>
          <h3 className="text-base font-semibold text-ink">{t("Supprimer l'ensemble de publicités", "Delete ad set")}</h3>
          <p className="mt-1.5 text-sm text-muted">
            {t("Supprimer", "Delete")} &ldquo;{confirmAdSetDelete?.name}&rdquo;? {t("Cette action est irréversible.", "This action cannot be undone.")}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmAdSetDelete(null)}>{t("Annuler", "Cancel")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirmAdSetDelete) return;
                deleteAdSet(company.id, confirmAdSetDelete.id);
                setConfirmAdSetDelete(null);
                refresh();
              }}
            >
              {t("Supprimer", "Delete")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} width="max-w-sm">
        <div className="p-5 sm:p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <TrashIcon />
          </div>
          <h3 className="text-base font-semibold text-ink">{t("Supprimer la campagne", "Delete campaign")}</h3>
          <p className="mt-1.5 text-sm text-muted">
            {t("Supprimer", "Delete")} &ldquo;{campaign.name}&rdquo;? {t("Cette action est irréversible.", "This action cannot be undone.")}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>{t("Annuler", "Cancel")}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                // Bug #20: delete via HTTP API (Supabase) then remove locally
                try {
                  await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
                } catch {
                  // Silent — proceed with local deletion
                }
                deleteCampaignLocal(company.id, campaign.id);
                router.push("/campaigns");
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
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        danger
          ? "text-danger-500 hover:bg-danger-50 hover:text-danger-700"
          : "text-muted hover:bg-hair hover:text-ink"
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
