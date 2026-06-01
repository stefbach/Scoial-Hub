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
  status?: "scheduled" | "draft" | "published"; // defaults to "scheduled" when omitted
  body?: string; // full post text, used to resume editing a draft
  automationName?: string; // present when source === "automation"
  media?: { kind: "image" | "video" }; // attached media, if any
  publishedAt?: string; // ISO timestamp set when published from the modal
}

export type TemplateStatus = "unused" | "used" | "archived";

export interface TemplateMedia {
  kind: "image" | "video" | "none";
  ready: boolean;
  seconds?: number;
  url?: string; // object URL for a manually uploaded image
}

export interface Template {
  id: string;
  platform: Platform;
  tags: string[];
  body: string;
  status: TemplateStatus;
  addedDate: string; // ISO date
  media: TemplateMedia;
}

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OnEmptyBehavior = "pause_and_alert" | "loop" | "auto_generate";

export interface Automation {
  id: string;
  name: string;
  account: string;
  socialAccountId: string;
  platform: Platform;
  days: WeekDay[];
  time: string; // HH:mm
  libraryName: string;
  tagFilter: string[];
  onEmpty: OnEmptyBehavior;
  schedule: string;
  status: "active" | "library_low" | "paused";
  libraryNote: string;
  next?: string;
  last?: string;
  publishedCount?: number;
  lastRunAt?: string;
  pausedSince?: string;
  warning?: string;
  enabled: boolean;
}

export type HistoryStatus = "published" | "failed";

export interface HistoryItem {
  id: string;
  platform: Platform;
  body: string;
  fullBody?: string; // full post text, falls back to body when omitted
  when: string;
  source: string;
  scheduledAt?: string; // ISO timestamp the post was scheduled for
  publishedAt?: string; // ISO timestamp the post actually went out (published only)
  automationName?: string; // present when source === "automation"
  status: HistoryStatus;
  stats?: string;
  metrics?: {
    reactions: number;
    comments: number;
    shares: number;
    linkClicks: number;
  };
  externalUrl?: string; // public URL on the platform when known
  media?: { kind: "image" | "video" };
  error?: { title: string; detail: string };
}

export interface AdSet {
  id: string;
  name: string;
  placement: string;
  targeting: string;
  ads: number;
  dailyBudget: number;
  enabled?: boolean;
  // Detail-page extras
  audienceId?: string;
  audienceName?: string;
  audienceReach?: string;
  placementMode?: "automatic" | "advanced";
  placements?: string[]; // when placementMode === "advanced"
  budgetType?: "daily" | "lifetime";
  lifetimeBudget?: number;
  startDate?: string;
  endDate?: string | null;
  optimizationGoal?: "conversions" | "link_clicks" | "reach" | "impressions";
  status?: "active" | "paused";
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  series?: CampaignSeries;
}

export type AdSource = "ai_generated" | "uploaded";

export interface Ad {
  id: string;
  campaignId: string;
  adSetId: string;
  adSetName: string;
  name: string;
  thumb: string; // tailwind bg-* class for the placeholder block
  spend: number;
  ctr: string;
  conversions: number;
  status: "active" | "paused";
  // Detail-modal extras
  headline?: string;
  bodyText?: string;
  cta?: string;
  destinationUrl?: string;
  source?: AdSource;
  aiModel?: string;
  format?: string;
  dimensions?: string;
  createdAt?: string; // ISO date
  createdBy?: string;
  metaAdId?: string;
  metaAdSetId?: string;
  lastSyncedAt?: string; // ISO timestamp
}

export interface CampaignSeries {
  spend: number[];
  impressions: number[];
  clicks: number[];
  conversions: number[];
  ctr: number[]; // %
  cpc: number[]; // EUR
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
  // Detail-page extras
  dailyBudget?: number;
  lifetimeBudget?: number;
  startDate?: string; // ISO date
  endDate?: string | null; // null = no end date
  impressions?: number;
  clicks?: number;
  impressionsTrend?: string;
  clicksTrend?: string;
  conversionsTrend?: string;
  spendTrend?: string;
  series?: CampaignSeries;
  ads?: Ad[];
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
