"use client";

import { useState } from "react";
import { ANALYTICS, COMPANIES } from "@/lib/mock-data";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import { BarRow } from "@/components/charts/BarRow";
import { eur } from "@/lib/format";

export default function AnalyticsPage() {
  const a = ANALYTICS;
  const [scope, setScope] = useState("all");
  const [open, setOpen] = useState(false);

  const platformMax = Math.max(...a.byPlatform.map((p) => p.value));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink">Analytics</h1>
          <span className="text-hair">|</span>
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md border-hair border-hair bg-card px-3 py-1.5 text-sm"
            >
              <span className="text-muted">Scope:</span>
              <span className="font-semibold text-ink">
                {scope === "all" ? "All companies" : COMPANIES.find((c) => c.id === scope)?.name}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted">
                <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-md border-hair border-hair bg-card shadow-lg">
                  <button
                    onClick={() => { setScope("all"); setOpen(false); }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-canvas"
                  >
                    All companies
                  </button>
                  {COMPANIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setScope(c.id); setOpen(false); }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-canvas"
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
          <Button variant="secondary">Last 30 days</Button>
          <Button variant="secondary">Export</Button>
        </div>
      </div>

      <div className="section-label mb-2">Overview</div>
      <div className="mb-5 grid grid-cols-4 gap-3">
        <MetricCard label="Posts published" value={a.overview.postsPublished} trend={a.overview.postsTrend} />
        <MetricCard label="Engagement" value={a.overview.engagement} trend={a.overview.engagementTrend} />
        <MetricCard label="Ad spend" value={eur(a.overview.adSpend)} trend={a.overview.adSpendTrend} />
        <MetricCard label="Conversions" value={a.overview.conversions} trend={a.overview.conversionsTrend} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold text-ink">Engagement by company</div>
          {a.byCompany.map((c) => (
            <BarRow
              key={c.name}
              label={c.name}
              value={c.value}
              max={a.byCompany[0].value}
              color={c.color}
              caption={`${c.value.toLocaleString()} · ${c.pct}%`}
            />
          ))}
        </div>
        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold text-ink">Performance by platform</div>
          {a.byPlatform.map((p) => (
            <BarRow
              key={p.name}
              label={p.name}
              value={p.value}
              max={platformMax}
              color={p.color}
              caption={p.connected ? p.value.toLocaleString() : "Not connected"}
              muted={!p.connected}
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border-hair border-ai-text/20 bg-ai-textbg px-4 py-3 text-xs text-ai-text">
        <span className="font-semibold">AI summary:</span> {a.summary}
      </div>
    </div>
  );
}
