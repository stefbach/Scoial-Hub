"use client";

import { useCompany } from "@/lib/company-context";
import { MetricCard } from "@/components/ui/MetricCard";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { eur } from "@/lib/format";

export default function DashboardPage() {
  const { company, data } = useCompany();
  const d = data.dashboard;

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Good morning, Younes</h1>
          <p className="text-sm text-muted">
            Here&apos;s what&apos;s happening across {company.code} today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">New campaign</Button>
          <Button variant="secondary">New post</Button>
        </div>
      </div>

      <div className="section-label mb-2">Organic</div>
      <div className="mb-5 grid grid-cols-4 gap-3">
        <MetricCard label="Scheduled" value={d.organic.scheduled} />
        <MetricCard label="Published (7d)" value={d.organic.published7d} />
        <MetricCard label="In library" value={d.organic.inLibrary} />
        <MetricCard label="Failed posts" value={d.organic.failed} alert={d.organic.failed > 0} />
      </div>

      <div className="section-label mb-2">Paid Ads</div>
      <div className="mb-6 grid grid-cols-4 gap-3">
        <MetricCard label="Active campaigns" value={d.paid.activeCampaigns} />
        <MetricCard
          label="Spend (MTD)"
          value={eur(d.paid.spendMtd)}
          sub={`of ${eur(d.paid.spendCap)} cap`}
        />
        <MetricCard label="Conversions" value={d.paid.conversions} />
        <MetricCard
          label="AI budget"
          value={`${eur(d.paid.aiBudgetUsed).replace("EUR ", "EUR ")}/${d.paid.aiBudgetCap}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Upcoming posts</h2>
          <div className="card divide-y divide-hair">
            {d.upcomingPosts.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <PlatformTag platform={p.platform} />
                <span className="flex-1 text-ink">{p.title}</span>
                <span className="text-2xs text-muted">{p.when}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Top performing ad</h2>
          <div className="card p-3">
            <div className="mb-3 flex items-center gap-2 text-sm">
              <PlatformTag platform={d.topAd.platform} />
              <span className="font-medium text-ink">{d.topAd.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-2xs text-muted">Spend</div>
                <div className="text-sm font-semibold text-ink">{eur(d.topAd.spend)}</div>
              </div>
              <div>
                <div className="text-2xs text-muted">CTR</div>
                <div className="text-sm font-semibold text-ink">{d.topAd.ctr}</div>
              </div>
              <div>
                <div className="text-2xs text-muted">Conv.</div>
                <div className="text-sm font-semibold text-ink">{d.topAd.conversions}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
