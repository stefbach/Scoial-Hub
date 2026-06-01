"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { CreateAdModal } from "@/components/paid/CreateAdModal";
import { NewCampaignModal } from "@/components/paid/NewCampaignModal";
import {
  deleteCampaign,
  hydrateCampaigns,
  toggleCampaign,
} from "@/lib/campaign-store";
import { eur } from "@/lib/format";
import type { Campaign } from "@/lib/types";

export default function CampaignsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignsContent />
    </Suspense>
  );
}

function CampaignsContent() {
  const { company, data } = useCompany();
  const params = useSearchParams();
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // Make sure every campaign has its detail fields ready.
  useEffect(() => {
    hydrateCampaigns(company.id);
    refresh();
  }, [company.id]);

  const c = data.campaigns;
  const [adModal, setAdModal] = useState(false);
  const [campaignModal, setCampaignModal] = useState<{ open: boolean; campaign?: Campaign }>({
    open: params.get("new") === "true",
  });
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);
  const [expanded, setExpanded] = useState<string | null>(c.list[0]?.id ?? null);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        actions={
          <>
            <Button variant="secondary" onClick={() => setAdModal(true)}>New ad</Button>
            <Button variant="primary" onClick={() => setCampaignModal({ open: true })}>
              New campaign
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-4 gap-3">
        <Strip label="Active campaigns" value={String(c.activeCampaigns)} />
        <Strip label="Spend this month" value={eur(c.spendMtd)} />
        <Strip label="Conversions (30d)" value={String(c.conversions)} />
        <Strip label="Avg. CPC" value={eur(c.avgCpc, { decimals: true })} />
      </div>

      <div className="card divide-y divide-hair">
        {c.list.map((camp) => (
          <CampaignRow
            key={camp.id}
            camp={camp}
            open={expanded === camp.id}
            onChevron={() => setExpanded((e) => (e === camp.id ? null : camp.id))}
            onToggleEnabled={() => {
              toggleCampaign(company.id, camp.id);
              refresh();
            }}
            onEdit={() => setCampaignModal({ open: true, campaign: camp })}
            onDelete={() => setConfirmDelete(camp)}
          />
        ))}
      </div>

      <CreateAdModal open={adModal} onClose={() => setAdModal(false)} />
      <NewCampaignModal
        open={campaignModal.open}
        campaign={campaignModal.campaign}
        onClose={() => setCampaignModal({ open: false })}
        onSaved={refresh}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="absolute inset-0" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-50 w-full max-w-sm rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">
              Delete &ldquo;{confirmDelete.name}&rdquo;? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteCampaign(company.id, confirmDelete.id);
                  setConfirmDelete(null);
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

function Strip({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-strip">
      <div className="text-2xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function CampaignRow({
  camp,
  open,
  onChevron,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  camp: Campaign;
  open: boolean;
  onChevron: () => void;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const detailHref = `/campaigns/${camp.id}`;
  const status = camp.enabled ? "Active" : "Paused";
  const statusTone = camp.enabled ? "green" : "gray";

  return (
    <div
      onClick={() => router.push(detailHref)}
      className="cursor-pointer p-3 transition-colors hover:bg-canvas"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChevron();
            }}
            aria-expanded={open}
            aria-label={open ? "Collapse campaign" : "Expand campaign"}
            className="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-muted hover:text-ink"
          >
            <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={detailHref}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-ink hover:underline"
              >
                {camp.name}
              </Link>
              <StatusBadge tone={statusTone}>{status}</StatusBadge>
              <span className="rounded bg-ai-textbg px-1.5 py-0.5 text-2xs text-ai-text">
                {camp.platforms.join(" + ")}
                {camp.platforms.length === 1 ? " only" : ""}
              </span>
            </div>
            <div className="mt-0.5 text-2xs text-muted">
              {camp.objective}   {eur(camp.spend)}/{camp.budget.toLocaleString()}   {camp.metricsLabel}   {camp.metricsValue}
              {camp.cplLabel ? `   ${camp.cplLabel}` : ""}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton title="Edit" ariaLabel="Edit campaign" onClick={onEdit}>
            <PencilIcon />
          </IconButton>
          <IconButton title="Delete" ariaLabel="Delete campaign" danger onClick={onDelete}>
            <TrashIcon />
          </IconButton>
          <span className="ml-1">
            <Toggle key={String(camp.enabled)} defaultOn={camp.enabled} onChange={onToggleEnabled} />
          </span>
        </div>
      </div>

      {open && (
        <div className="ml-7 mt-2" onClick={(e) => e.stopPropagation()}>
          <div className="section-label mb-1">Ad sets ({camp.adSets.length})</div>
          {camp.adSets.length === 0 ? (
            <div className="rounded-md border-hair border-hair bg-canvas px-3 py-3 text-2xs text-muted">
              No ad sets yet.
            </div>
          ) : (
            <div className="space-y-2">
              {camp.adSets.map((set) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between rounded-md border-hair border-hair bg-canvas px-3 py-2"
                >
                  <div>
                    <Link
                      href={`/ad-sets/${set.id}`}
                      className="text-xs font-medium text-ink hover:underline"
                    >
                      {set.name}
                    </Link>
                    <div className="text-2xs text-muted">
                      {set.placement} · {set.targeting}
                    </div>
                  </div>
                  <div className="text-2xs text-muted">
                    {set.ads} ads · {eur(set.dailyBudget)}/day
                  </div>
                </div>
              ))}
            </div>
          )}
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
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
