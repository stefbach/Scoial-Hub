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
import { Modal } from "@/components/ui/Modal";
import {
  deleteAdSet,
  duplicateAdSet,
  findAdSet,
  hydrateCampaigns,
  toggleAdSet,
  toggleAd,
} from "@/lib/campaign-store";
import { eur } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Ad } from "@/lib/types";

type MetricId = "spend" | "impressions" | "clicks" | "conversions" | "ctr" | "cpc";

const METRICS: { id: MetricId; label: string; color: string; dashed?: boolean }[] = [
  { id: "spend", label: "Spend", color: "#60a5fa" },
  { id: "conversions", label: "Conversions", color: "#4ade80", dashed: true },
  { id: "impressions", label: "Impressions", color: "#d62976" },
  { id: "clicks", label: "Clicks", color: "#7c3aed" },
  { id: "ctr", label: "CTR", color: "#ea580c" },
  { id: "cpc", label: "CPC", color: "#38bdf8" },
];

const GOAL_LABEL = {
  conversions: "Conversions",
  link_clicks: "Link clicks",
  reach: "Reach",
  impressions: "Impressions",
} as const;

function fmtDate(iso?: string | null, fallback = "No end date") {
  if (!iso) return fallback;
  return format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
}

export default function AdSetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { company } = useCompany();
  const t = useT();
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

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
        <Breadcrumb trail={[{ href: "/campaigns", label: t("Campagnes", "Campaigns") }, { label: t("Introuvable", "Not found") }]} />
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="text-sm text-muted">{t("Ensemble de publicités introuvable.", "Ad set not found.")}</div>
          <Link href="/campaigns" className="mt-3 text-sm font-medium text-ai-text hover:underline">
            {t("Retour aux campagnes", "Back to campaigns")}
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
    <div className="animate-fade-in">
      <Breadcrumb
        trail={[
          { href: "/campaigns", label: t("Campagnes", "Campaigns") },
          { href: `/campaigns/${campaign.id}`, label: campaign.name },
          { label: adSet.name },
        ]}
      />

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{adSet.name}</h1>
            <StatusBadge tone={enabled ? "green" : "gray"} dot>
              {enabled ? t("Actif", "Active") : t("En pause", "Paused")}
            </StatusBadge>
            <StatusBadge tone="blue">{adSet.placement}</StatusBadge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-muted">
            <span>
              {t("Audience", "Audience")}: <span className="font-medium text-ink">{adSet.audienceName ?? "—"}</span>
              {adSet.audienceReach ? ` (${adSet.audienceReach} ${t("portée", "reach")})` : ""}
            </span>
            <span className="text-hair">·</span>
            <span>
              {adSet.budgetType === "lifetime"
                ? <>{t("Budget total", "Lifetime budget")} <span className="font-medium text-ink">{eur(adSet.lifetimeBudget ?? 0)}</span></>
                : <>{t("Budget journalier", "Daily budget")} <span className="font-medium text-ink">{eur(adSet.dailyBudget)}</span></>
              }
            </span>
            <span className="text-hair">·</span>
            <span>{t("Optimisation", "Optimization")}: <span className="font-medium text-ink">{goal}</span></span>
            <span className="text-hair">·</span>
            <span>{t("Démarré le", "Started")} {fmtDate(adSet.startDate, t("Aucune date de début", "No start date"))}</span>
            <span className="text-hair">·</span>
            <span>{fmtDate(adSet.endDate ?? null, t("Aucune date de fin", "No end date"))}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Toggle
            key={String(enabled)}
            defaultOn={enabled}
            onChange={() => {
              const nextEnabled = !enabled;
              toggleAdSet(company.id, adSet.id);
              refresh();
              // Persistance best-effort (sh_ad_sets) ; no-op si ad set mock.
              fetch(`/api/ad-sets/${encodeURIComponent(adSet.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  enabled: nextEnabled,
                  status: nextEnabled ? "active" : "paused",
                }),
              }).catch(() => {/* silencieux */});
            }}
          />
          <Button variant="secondary" onClick={() => setEditOpen(true)}>{t("Modifier", "Edit")}</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const copy = duplicateAdSet(company.id, adSet.id);
              if (copy) router.push(`/ad-sets/${copy.id}`);
            }}
          >
            {t("Dupliquer", "Duplicate")}
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>{t("Supprimer", "Delete")}</Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        <MetricCard label={t("Dépenses", "Spend")} value={eur(adSet.spend ?? 0)} />
        <MetricCard label={t("Impressions", "Impressions")} value={(adSet.impressions ?? 0).toLocaleString()} />
        <MetricCard label={t("Clics", "Clicks")} value={(adSet.clicks ?? 0).toLocaleString()} />
        <MetricCard label={t("Conversions", "Conversions")} value={String(adSet.conversions ?? 0)} />
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

      {/* Ads */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{t("Publicités", "Ads")} ({ads.length})</h2>
        <Button variant="primary" onClick={() => setNewAdOpen(true)}>+ {t("Nouvelle pub", "New ad")}</Button>
      </div>

      {ads.length === 0 ? (
        <div className="card mb-6 flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-muted">
            <ImageIcon />
          </div>
          <p className="mt-4 text-sm font-medium text-ink">{t("Aucune publicité pour l'instant", "No ads yet")}</p>
          <p className="mt-1 text-sm text-muted">{t("Créez votre première publicité pour cet ensemble.", "Create your first ad for this ad set.")}</p>
          <div className="mt-5">
            <Button variant="primary" onClick={() => setNewAdOpen(true)}>+ {t("Nouvelle pub", "New ad")}</Button>
          </div>
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3">
          {ads.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              onClick={() => setOpenAd(ad)}
              onToggle={() => {
                toggleAd(company.id, ad.id);
                refresh();
              }}
            />
          ))}
        </div>
      )}

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

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} width="max-w-sm">
        <div className="p-5 sm:p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <TrashIcon />
          </div>
          <h3 className="text-base font-semibold text-ink">{t("Supprimer l'ensemble de publicités", "Delete ad set")}</h3>
          <p className="mt-1.5 text-sm text-muted">
            {t("Supprimer", "Delete")} &ldquo;{adSet.name}&rdquo;? {t("Cette action est irréversible.", "This action cannot be undone.")}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>{t("Annuler", "Cancel")}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                // Persiste la suppression (sh_ad_sets) puis retire en local.
                try {
                  await fetch(`/api/ad-sets/${encodeURIComponent(adSet.id)}`, { method: "DELETE" });
                } catch {
                  // Silencieux — on enchaîne sur la suppression locale.
                }
                deleteAdSet(company.id, adSet.id);
                router.push(`/campaigns/${campaign.id}`);
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

/* ── Ad card ──────────────────────────────────────────────────────────── */
function AdCard({
  ad,
  onClick,
  onToggle,
}: {
  ad: Ad;
  onClick: () => void;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <div
      onClick={onClick}
      className="card cursor-pointer overflow-hidden transition-all hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className={`relative flex h-32 items-center justify-center ${ad.thumb}`}>
        {ad.source === "ai_generated" && (
          <span className="absolute right-2 top-2 rounded-md bg-ai-visual px-2 py-0.5 text-2xs font-semibold text-white">
            AI
          </span>
        )}
        <ImageIcon />
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{ad.name}</span>
          <StatusBadge tone={ad.status === "active" ? "green" : "gray"} dot>
            {ad.status === "active" ? t("Actif", "Active") : t("En pause", "Paused")}
          </StatusBadge>
        </div>
        <p className="line-clamp-2 text-2xs text-muted">
          <span className="font-medium text-ink">{ad.headline}</span>
          {ad.bodyText ? <> — {ad.bodyText}</> : null}
        </p>

        {/* Metrics row */}
        <div className="mt-3 flex items-center justify-between border-t border-hair pt-2.5 text-2xs">
          <div className="flex gap-4">
            <span>
              <span className="text-muted">{t("Dépenses", "Spend")}</span>{" "}
              <span className="font-semibold tabular-nums text-ink">{eur(ad.spend)}</span>
            </span>
            <span>
              <span className="text-muted">CTR</span>{" "}
              <span className="font-semibold tabular-nums text-success-600">{ad.ctr}</span>
            </span>
            <span>
              <span className="text-muted">{t("Conv.", "Conv.")}</span>{" "}
              <span className="font-semibold tabular-nums text-ink">{ad.conversions}</span>
            </span>
          </div>
          <span onClick={(e) => e.stopPropagation()}>
            <Toggle key={ad.status} defaultOn={ad.status === "active"} onChange={onToggle} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────────────────── */
function ImageIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-muted/60">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 17l-5-5-9 9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
