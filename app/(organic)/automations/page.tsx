"use client";

import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import type { Automation } from "@/lib/types";

const STATUS: Record<Automation["status"], { label: string; tone: "green" | "amber" | "gray" }> = {
  active: { label: "Active", tone: "green" },
  library_low: { label: "Library low", tone: "amber" },
  paused: { label: "Paused", tone: "gray" },
};

export default function AutomationsPage() {
  const { data } = useCompany();
  const a = data.automations;

  return (
    <div>
      <PageHeader title="Automations" actions={<Button variant="primary">New automation</Button>} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="metric-strip">
          <div className="text-2xs text-muted">Active</div>
          <div className="mt-1 text-xl font-semibold text-ink">{a.active}</div>
        </div>
        <div className="metric-strip">
          <div className="text-2xs text-muted">Paused</div>
          <div className="mt-1 text-xl font-semibold text-ink">{a.paused}</div>
        </div>
        <div className="metric-strip">
          <div className="text-2xs text-muted">Posts this week</div>
          <div className="mt-1 text-xl font-semibold text-ink">{a.postsThisWeek}</div>
        </div>
      </div>

      <div className="card divide-y divide-hair">
        {a.rules.map((rule) => {
          const st = STATUS[rule.status];
          return (
            <div key={rule.id} className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{rule.name}</span>
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                  </div>
                  <div className="mt-0.5 text-2xs text-muted">
                    {rule.account} · {rule.schedule}
                    {rule.libraryNote ? ` · ${rule.libraryNote}` : ""}
                    {rule.pausedSince ? ` · ${rule.pausedSince}` : ""}
                  </div>
                  {(rule.next || rule.last || rule.publishedCount != null) && (
                    <div className="mt-0.5 text-2xs text-muted">
                      {rule.next && `Next: ${rule.next}`}
                      {rule.last && `   Last: ${rule.last}`}
                      {rule.publishedCount != null && `   ${rule.publishedCount} published`}
                    </div>
                  )}
                </div>
                <Toggle defaultOn={rule.enabled} />
              </div>
              {rule.warning && (
                <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 px-3 py-2">
                  <span className="text-2xs text-amber-700">{rule.warning}</span>
                  <Button variant="secondary" className="py-1 text-2xs">
                    Add templates
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
