"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { CreateAdModal } from "@/components/paid/CreateAdModal";
import { NewCampaignModal } from "@/components/paid/NewCampaignModal";
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
  const { data } = useCompany();
  const c = data.campaigns;
  const params = useSearchParams();
  const [adModal, setAdModal] = useState(false);
  const [campaignModal, setCampaignModal] = useState(params.get("new") === "true");
  const [expanded, setExpanded] = useState<string | null>(c.list[0]?.id ?? null);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        actions={
          <>
            <Button variant="secondary" onClick={() => setAdModal(true)}>New ad</Button>
            <Button variant="primary" onClick={() => setCampaignModal(true)}>New campaign</Button>
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
            onToggle={() => setExpanded((e) => (e === camp.id ? null : camp.id))}
          />
        ))}
      </div>

      <CreateAdModal open={adModal} onClose={() => setAdModal(false)} />
      <NewCampaignModal open={campaignModal} onClose={() => setCampaignModal(false)} />
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
  onToggle,
}: {
  camp: Campaign;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? "Collapse campaign" : "Expand campaign"}
          className="flex flex-1 cursor-pointer items-start gap-2 text-left"
        >
          <span
            className={`mt-0.5 inline-block text-muted transition-transform ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            ▸
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{camp.name}</span>
              <StatusBadge tone="green">Active</StatusBadge>
              <span className="rounded bg-ai-textbg px-1.5 py-0.5 text-2xs text-ai-text">
                {camp.platforms.join(" + ")}{camp.platforms.length === 1 ? " only" : ""}
              </span>
            </div>
            <div className="mt-0.5 text-2xs text-muted">
              {camp.objective}   {eur(camp.spend)}/{camp.budget.toLocaleString()}   {camp.metricsLabel}   {camp.metricsValue}
              {camp.cplLabel ? `   ${camp.cplLabel}` : ""}
            </div>
          </div>
        </button>
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle defaultOn={camp.enabled} />
        </div>
      </div>

      {open && (
        <div className="ml-5 mt-2">
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
                    <div className="text-xs font-medium text-ink">{set.name}</div>
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
