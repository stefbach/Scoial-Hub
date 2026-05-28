"use client";

import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import { LineChart } from "@/components/charts/LineChart";
import { eur } from "@/lib/format";

export default function AdPerformancePage() {
  const { data } = useCompany();
  const p = data.adPerformance;

  return (
    <div>
      <PageHeader
        title="Ad Performance"
        actions={
          <>
            <Button variant="secondary">Last 30 days</Button>
            <Button variant="secondary">Export</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-5 gap-3">
        <MetricCard label="Spend" value={eur(p.spend)} trend={p.spendTrend} />
        <MetricCard label="Impressions" value={p.impressions} trend={p.impressionsTrend} />
        <MetricCard label="Clicks" value={p.clicks} trend={p.clicksTrend} />
        <MetricCard label="Conversions" value={p.conversions} trend={p.conversionsTrend} />
        <MetricCard label="Avg. CPC" value={eur(p.avgCpc, { decimals: true })} trend={p.avgCpcTrend} />
      </div>

      <div className="card mb-4 p-4">
        <div className="mb-3 text-sm font-semibold text-ink">Spend &amp; conversions over time</div>
        <LineChart spend={p.series.spend} conversions={p.series.conversions} />
      </div>

      <div className="mb-4">
        <div className="mb-2 text-sm font-semibold text-ink">Top performing ads</div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="section-label border-b-hair border-hair text-left">
                <th className="px-3 py-2 font-semibold">AD</th>
                <th className="px-3 py-2 font-semibold">SPEND</th>
                <th className="px-3 py-2 font-semibold">CTR</th>
                <th className="px-3 py-2 font-semibold">CPC</th>
                <th className="px-3 py-2 font-semibold">CONV.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {p.topAds.map((ad) => (
                <tr key={ad.name}>
                  <td className="px-3 py-2.5">
                    <div className="text-ink">{ad.name}</div>
                    <div className="text-2xs text-muted">{ad.context}</div>
                  </td>
                  <td className="px-3 py-2.5 text-ink">{eur(ad.spend)}</td>
                  <td className="px-3 py-2.5 text-green-600">{ad.ctr}</td>
                  <td className="px-3 py-2.5 text-ink">{eur(ad.cpc, { decimals: true })}</td>
                  <td className="px-3 py-2.5 text-ink">{ad.conv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border-hair border-ai-text/20 bg-ai-textbg px-4 py-3 text-xs text-ai-text">
        <span className="font-semibold">AI insight:</span> {p.insight}
      </div>
    </div>
  );
}
