import { COMPANY_DATA } from "./mock-data";
import type { Ad, Campaign, CampaignSeries } from "./types";

// Deterministic pseudo-random series from a string seed so the chart is
// stable across renders. Frontend-only, no real analytics.
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
  return h;
}

function rand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}

export function buildCampaignSeries(campaignId: string, totalSpend: number, totalConv: number): CampaignSeries {
  const r = rand(hashSeed(campaignId));
  const days = 30;
  const spend: number[] = [];
  const conversions: number[] = [];
  const impressions: number[] = [];
  const clicks: number[] = [];
  const ctr: number[] = [];
  const cpc: number[] = [];

  // Weighted daily values that roughly sum to totals.
  const spendDaily = totalSpend / days;
  const convDaily = totalConv / days;
  for (let i = 0; i < days; i++) {
    const ramp = 0.6 + (i / days) * 0.9; // grow slightly
    const noise = 0.7 + r() * 0.6; // 0.7 .. 1.3
    const sp = Math.max(1, Math.round(spendDaily * ramp * noise));
    const cv = Math.max(0, Math.round(convDaily * ramp * noise));
    const im = Math.round(sp * (40 + r() * 30));
    const cl = Math.round(im * (0.02 + r() * 0.03));
    spend.push(sp);
    conversions.push(cv);
    impressions.push(im);
    clicks.push(cl);
    ctr.push(Number(((cl / Math.max(1, im)) * 100).toFixed(2)));
    cpc.push(Number((sp / Math.max(1, cl)).toFixed(2)));
  }
  return { spend, impressions, clicks, conversions, ctr, cpc };
}

// Ensure each campaign has detail fields populated. Idempotent — only fills gaps.
export function hydrateCampaigns(companyId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => {
    if (c.series && c.ads) return c;

    const impressions = c.impressions ?? Math.round(c.spend * 50);
    const clicks = c.clicks ?? Math.round(impressions * 0.025);
    const conv = parseInt(c.metricsValue.match(/(\d+)\s*conv|(\d+)\s*leads/i)?.[1] ?? "0", 10) || Math.max(1, Math.round(c.spend / 18));

    const series = c.series ?? buildCampaignSeries(c.id, c.spend, conv);

    // Build ads from the campaign's ad sets if not already present.
    const ads: Ad[] = c.ads ?? c.adSets.flatMap((set) => {
      const tints = ["bg-[#eef4fe]", "bg-[#fdeef5]", "bg-canvas", "bg-amber-50"];
      return Array.from({ length: set.ads }, (_, i) => {
        const id = `${set.id}-ad${i + 1}`;
        const r2 = rand(hashSeed(id));
        const adSpend = Math.round((c.spend / Math.max(1, c.adSets.reduce((s, x) => s + x.ads, 0))) * (0.7 + r2() * 0.6));
        const adConv = Math.max(0, Math.round((conv / Math.max(1, c.adSets.reduce((s, x) => s + x.ads, 0))) * (0.6 + r2() * 0.8)));
        return {
          id,
          campaignId: c.id,
          adSetId: set.id,
          adSetName: set.name,
          name: `${set.name.split(" ").slice(0, 3).join(" ")} — Ad ${i + 1}`,
          thumb: tints[(i + Number(id.length)) % tints.length],
          spend: adSpend,
          ctr: `${(2 + r2() * 2).toFixed(2)}%`,
          conversions: adConv,
          status: "active" as const,
        };
      });
    });

    return {
      ...c,
      dailyBudget: c.dailyBudget ?? Math.max(20, Math.round(c.budget / 50)),
      lifetimeBudget: c.lifetimeBudget ?? c.budget,
      startDate: c.startDate ?? "2026-05-12",
      endDate: c.endDate ?? null,
      impressions,
      clicks,
      spendTrend: c.spendTrend ?? "UP 12%",
      impressionsTrend: c.impressionsTrend ?? "UP 8%",
      clicksTrend: c.clicksTrend ?? "UP 15%",
      conversionsTrend: c.conversionsTrend ?? "UP 22%",
      series,
      ads,
      adSets: c.adSets.map((s) => ({ enabled: true, ...s })),
    };
  });
}

export function findCampaign(companyId: string, campaignId: string) {
  hydrateCampaigns(companyId);
  return COMPANY_DATA[companyId]?.campaigns.list.find((c) => c.id === campaignId);
}

export function updateCampaign(companyId: string, campaignId: string, patch: Partial<Campaign>) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) =>
    c.id === campaignId ? { ...c, ...patch } : c
  );
}

export function deleteCampaign(companyId: string, campaignId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.filter((c) => c.id !== campaignId);
}

export function duplicateCampaign(companyId: string, campaignId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return undefined;
  const orig = data.campaigns.list.find((c) => c.id === campaignId);
  if (!orig) return undefined;
  const copy: Campaign = {
    ...orig,
    id: `cmp-${Date.now()}`,
    name: `${orig.name} (copy)`,
    spend: 0,
    enabled: false,
    status: "paused",
    series: undefined,
    ads: undefined,
  };
  data.campaigns.list = [copy, ...data.campaigns.list];
  return copy;
}

export function toggleCampaign(companyId: string, campaignId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => {
    if (c.id !== campaignId) return c;
    const enabled = !c.enabled;
    return { ...c, enabled, status: enabled ? "active" : "paused" };
  });
}

export function findAdSet(companyId: string, adSetId: string) {
  hydrateCampaigns(companyId);
  for (const c of COMPANY_DATA[companyId]?.campaigns.list ?? []) {
    const found = c.adSets.find((s) => s.id === adSetId);
    if (found) return { adSet: found, campaign: c };
  }
  return null;
}
