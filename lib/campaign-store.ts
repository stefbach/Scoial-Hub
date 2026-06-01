import { COMPANY_DATA } from "./mock-data";
import type { Ad, AdSet, Campaign, CampaignSeries } from "./types";

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

const AI_MODELS = ["Flux 2 Pro", "Ideogram v3", "GPT Image Mini"];
const FORMATS = [
  { format: "FB Feed · 1.91:1", dimensions: "1200 × 628" },
  { format: "IG Feed · 1:1", dimensions: "1080 × 1080" },
  { format: "IG Stories · 9:16", dimensions: "1080 × 1920" },
];

// Ensure each campaign has detail fields populated. Idempotent — only fills gaps.
export function hydrateCampaigns(companyId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => {
    if (c.series && c.ads && c.adSets.every((s) => s.series)) return c;

    const impressions = c.impressions ?? Math.round(c.spend * 50);
    const clicks = c.clicks ?? Math.round(impressions * 0.025);
    const conv = parseInt(c.metricsValue.match(/(\d+)\s*conv|(\d+)\s*leads/i)?.[1] ?? "0", 10) || Math.max(1, Math.round(c.spend / 18));

    const series = c.series ?? buildCampaignSeries(c.id, c.spend, conv);

    // Roll up ads from the campaign's ad sets if not already present.
    const totalAdsAcrossSets = Math.max(1, c.adSets.reduce((s, x) => s + x.ads, 0));
    const audienceList = data.audiences.list;

    const ads: Ad[] = c.ads ?? c.adSets.flatMap((set) => {
      const tints = ["bg-[#eef4fe]", "bg-[#fdeef5]", "bg-canvas", "bg-amber-50"];
      return Array.from({ length: set.ads }, (_, i) => {
        const id = `${set.id}-ad${i + 1}`;
        const r2 = rand(hashSeed(id));
        const adSpend = Math.round((c.spend / totalAdsAcrossSets) * (0.7 + r2() * 0.6));
        const adConv = Math.max(0, Math.round((conv / totalAdsAcrossSets) * (0.6 + r2() * 0.8)));
        const fmt = FORMATS[Math.floor(r2() * FORMATS.length)];
        const isAi = r2() > 0.25; // most are AI-generated; ~25% manual uploads
        const shortName = set.name.split(" ").slice(0, 3).join(" ");
        return {
          id,
          campaignId: c.id,
          adSetId: set.id,
          adSetName: set.name,
          name: `${shortName} — Ad ${i + 1}`,
          thumb: tints[(i + Number(id.length)) % tints.length],
          spend: adSpend,
          ctr: `${(2 + r2() * 2).toFixed(2)}%`,
          conversions: adConv,
          status: "active" as const,
          headline:
            i === 0
              ? "Reclaim your energy this January"
              : `Take the first step — ${shortName}`,
          bodyText:
            "Our supervised program helps reset your metabolism with personalized care. Free initial consultation this month.",
          cta: "Book now",
          destinationUrl: `${companyId}.example.com/${c.id}`,
          source: isAi ? "ai_generated" : "uploaded",
          aiModel: isAi ? AI_MODELS[Math.floor(r2() * AI_MODELS.length)] : undefined,
          format: fmt.format,
          dimensions: fmt.dimensions,
          createdAt: c.startDate ?? "2026-05-12",
          createdBy: "Younes",
          metaAdId: `act_${1200000 + Math.floor(r2() * 999999)}`,
          metaAdSetId: `adset_${800000 + Math.floor(r2() * 999999)}`,
          lastSyncedAt: "2026-05-30T06:00:00",
        };
      });
    });

    // Per-ad-set detail fields + series. Allocate the campaign's spend across sets.
    const totalDaily = Math.max(1, c.adSets.reduce((s, x) => s + x.dailyBudget, 0));
    const hydratedAdSets: AdSet[] = c.adSets.map((set, idx) => {
      if (set.series) return set;
      const setAds = ads.filter((a) => a.adSetId === set.id);
      const setSpend = setAds.reduce((s, a) => s + a.spend, 0) || Math.round((c.spend * set.dailyBudget) / totalDaily);
      const setConv = setAds.reduce((s, a) => s + a.conversions, 0);
      const setImpressions = Math.round(setSpend * 50);
      const setClicks = Math.round(setImpressions * 0.025);
      const audience = audienceList[idx % Math.max(1, audienceList.length)];
      return {
        ...set,
        enabled: set.enabled ?? true,
        status: (set.enabled ?? true) ? "active" : "paused",
        audienceId: set.audienceId ?? audience?.id,
        audienceName: set.audienceName ?? audience?.name ?? "Default audience",
        audienceReach: set.audienceReach ?? audience?.reach ?? "—",
        placementMode: set.placementMode ?? "automatic",
        placements: set.placements,
        budgetType: set.budgetType ?? "daily",
        lifetimeBudget: set.lifetimeBudget,
        startDate: set.startDate ?? c.startDate ?? "2026-05-12",
        endDate: set.endDate ?? null,
        optimizationGoal: set.optimizationGoal ?? "conversions",
        spend: setSpend,
        impressions: setImpressions,
        clicks: setClicks,
        conversions: setConv,
        series: set.series ?? buildCampaignSeries(set.id, setSpend, setConv),
      };
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
      adSets: hydratedAdSets,
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

export function addAdSet(companyId: string, campaignId: string, adSet: AdSet) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) =>
    c.id === campaignId ? { ...c, adSets: [adSet, ...c.adSets] } : c
  );
}

export function updateAdSet(
  companyId: string,
  adSetId: string,
  patch: Partial<AdSet>
) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => ({
    ...c,
    adSets: c.adSets.map((s) => (s.id === adSetId ? { ...s, ...patch } : s)),
  }));
}

export function deleteAdSet(companyId: string, adSetId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => ({
    ...c,
    adSets: c.adSets.filter((s) => s.id !== adSetId),
    ads: (c.ads ?? []).filter((a) => a.adSetId !== adSetId),
  }));
}

export function duplicateAdSet(companyId: string, adSetId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return undefined;
  let copy: AdSet | undefined;
  data.campaigns.list = data.campaigns.list.map((c) => {
    const orig = c.adSets.find((s) => s.id === adSetId);
    if (!orig) return c;
    copy = {
      ...orig,
      id: `aset-${Date.now()}`,
      name: `${orig.name} (copy)`,
      enabled: false,
      status: "paused",
      ads: 0,
      spend: 0,
      conversions: 0,
      series: undefined,
    };
    return { ...c, adSets: [copy, ...c.adSets] };
  });
  return copy;
}

export function toggleAdSet(companyId: string, adSetId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => ({
    ...c,
    adSets: c.adSets.map((s) => {
      if (s.id !== adSetId) return s;
      const enabled = !(s.enabled ?? true);
      return { ...s, enabled, status: enabled ? "active" : "paused" };
    }),
  }));
}

export function findAd(companyId: string, adId: string) {
  hydrateCampaigns(companyId);
  for (const c of COMPANY_DATA[companyId]?.campaigns.list ?? []) {
    const ad = (c.ads ?? []).find((a) => a.id === adId);
    if (ad) {
      const adSet = c.adSets.find((s) => s.id === ad.adSetId);
      return { ad, adSet, campaign: c };
    }
  }
  return null;
}

export function updateAd(companyId: string, adId: string, patch: Partial<Ad>) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => ({
    ...c,
    ads: (c.ads ?? []).map((a) => (a.id === adId ? { ...a, ...patch } : a)),
  }));
}

export function deleteAd(companyId: string, adId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => ({
    ...c,
    ads: (c.ads ?? []).filter((a) => a.id !== adId),
  }));
}

export function duplicateAd(companyId: string, adId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return undefined;
  let copy: Ad | undefined;
  data.campaigns.list = data.campaigns.list.map((c) => {
    const orig = (c.ads ?? []).find((a) => a.id === adId);
    if (!orig) return c;
    copy = {
      ...orig,
      id: `ad-${Date.now()}`,
      name: `${orig.name} (copy)`,
      status: "paused",
      spend: 0,
      conversions: 0,
    };
    return { ...c, ads: [copy, ...(c.ads ?? [])] };
  });
  return copy;
}

export function toggleAd(companyId: string, adId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.campaigns.list = data.campaigns.list.map((c) => ({
    ...c,
    ads: (c.ads ?? []).map((a) => {
      if (a.id !== adId) return a;
      return { ...a, status: a.status === "active" ? "paused" : "active" };
    }),
  }));
}
