"use client";

import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Audience, AudienceType } from "@/lib/types";

const TYPE: Record<AudienceType, { label: string; ring: string; tone: "blue" | "amber" }> = {
  saved: { label: "Saved", ring: "border-l-platform-facebook", tone: "blue" },
  custom: { label: "Custom", ring: "border-l-ai-visual", tone: "blue" },
  lookalike: { label: "Lookalike", ring: "border-l-amber-400", tone: "amber" },
};

export default function AudiencesPage() {
  const { data } = useCompany();
  const a = data.audiences;

  return (
    <div>
      <PageHeader
        title="Audiences"
        actions={
          <>
            <Button variant="secondary">Sync from Meta</Button>
            <Button variant="primary">New audience</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Strip label="Total audiences" value={String(a.total)} />
        <Strip label="In use" value={String(a.inUse)} />
        <Strip label="Combined reach" value={a.combinedReach} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {a.list.map((aud) => (
          <AudienceCard key={aud.id} aud={aud} />
        ))}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ai-visual/40 bg-ai-visualbg/40 p-5 text-center">
          <span className="text-sm font-medium text-ink">Let AI suggest an audience</span>
          <span className="text-2xs text-ai-visual">Describe your target in plain English</span>
        </div>
      </div>
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

function AudienceCard({ aud }: { aud: Audience }) {
  const t = TYPE[aud.type];
  return (
    <div className={`card border-l-4 p-3 ${t.ring}`}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded bg-canvas px-1.5 py-0.5 text-2xs font-medium text-ink">{t.label}</span>
        {aud.inUse > 0 && <StatusBadge tone="green">In use ({aud.inUse})</StatusBadge>}
      </div>
      <div className="text-sm font-semibold text-ink">{aud.name}</div>
      <div className="text-2xs text-muted">{aud.description}</div>
      <div className="text-2xs text-muted">{aud.detail}</div>
      <div className="mt-2 flex items-center justify-between text-2xs text-muted">
        <span>{aud.reach}</span>
        <span>{aud.created}</span>
      </div>
    </div>
  );
}
