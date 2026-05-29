export type Platform = "facebook" | "instagram" | "linkedin";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type PostSource = "automation" | "manual";

export interface Company {
  id: string;
  code: string; // OCC, TI, CV
  name: string;
  brandVoice: string;
  accent: string; // tailwind-friendly hex for the avatar chip
}

export interface SocialAccount {
  id: string;
  platform: Platform;
  accountName: string;
  status: "active" | "expired" | "revoked";
}

export interface DashboardData {
  organic: {
    scheduled: number;
    published7d: number;
    inLibrary: number;
    failed: number;
  };
  paid: {
    activeCampaigns: number;
    spendMtd: number;
    spendCap: number;
    conversions: number;
    aiBudgetUsed: number;
    aiBudgetCap: number;
  };
  upcomingPosts: {
    platform: Platform;
    title: string;
    when: string;
  }[];
  topAd: {
    platform: Platform;
    name: string;
    spend: number;
    ctr: string;
    conversions: number;
  };
}

export interface ScheduledPost {
  id: string;
  platform: Platform;
  title: string;
  date: string; // ISO date
  time: string; // HH:mm
  source: PostSource;
  needsReview?: boolean;
  status?: "scheduled" | "draft"; // defaults to "scheduled" when omitted
  body?: string; // full post text, used to resume editing a draft
}

export interface Template {
  id: string;
  platform: Platform;
  tag: string;
  body: string;
  media:
    | { kind: "image"; ready: true }
    | { kind: "video"; seconds: number; ready: true }
    | { kind: "none"; ready: false };
}

export interface Automation {
  id: string;
  name: string;
  account: string;
  schedule: string;
  status: "active" | "library_low" | "paused";
  libraryNote: string;
  next?: string;
  last?: string;
  publishedCount?: number;
  pausedSince?: string;
  warning?: string;
  enabled: boolean;
}

export type HistoryStatus = "published" | "failed";

export interface HistoryItem {
  id: string;
  platform: Platform;
  body: string;
  when: string;
  source: string;
  status: HistoryStatus;
  stats?: string;
  error?: { title: string; detail: string };
}

export interface AdSet {
  id: string;
  name: string;
  placement: string;
  targeting: string;
  ads: number;
  dailyBudget: number;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  platforms: ("FB" | "IG")[];
  status: "active" | "paused";
  spend: number;
  budget: number;
  metricsLabel: string;
  metricsValue: string;
  cplLabel?: string;
  enabled: boolean;
  adSets: AdSet[];
}

export type AudienceType = "saved" | "custom" | "lookalike";

export interface Audience {
  id: string;
  type: AudienceType;
  name: string;
  description: string;
  detail: string;
  reach: string;
  created: string;
  inUse: number;
}

export interface AdPerf {
  spend: number;
  spendTrend: string;
  impressions: string;
  impressionsTrend: string;
  clicks: string;
  clicksTrend: string;
  conversions: number;
  conversionsTrend: string;
  avgCpc: number;
  avgCpcTrend: string;
  series: { spend: number[]; conversions: number[] };
  topAds: {
    name: string;
    context: string;
    spend: number;
    ctr: string;
    cpc: number;
    conv: number;
  }[];
  insight: string;
}

export interface CompanyData {
  dashboard: DashboardData;
  accounts: SocialAccount[];
  scheduled: ScheduledPost[];
  library: {
    unused: number;
    runway: string;
    aiBudgetUsed: number;
    aiBudgetCap: number;
    imageSpend: number;
    videoSpend: number;
    templates: Template[];
  };
  automations: {
    active: number;
    paused: number;
    postsThisWeek: number;
    rules: Automation[];
  };
  history: HistoryItem[];
  campaigns: {
    activeCampaigns: number;
    spendMtd: number;
    conversions: number;
    avgCpc: number;
    list: Campaign[];
  };
  audiences: {
    total: number;
    inUse: number;
    combinedReach: string;
    list: Audience[];
  };
  adPerformance: AdPerf;
  adSafety: {
    monthlyCap: number;
    usedThisMonth: number;
    requireBudgetCap: boolean;
    confirmAiSpend: boolean;
    doubleConfirmThreshold: number;
    dailyDigest: boolean;
    recentAudit: string;
  };
}
