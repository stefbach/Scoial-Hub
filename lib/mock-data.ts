import type { Company, CompanyData } from "./types";

export const ORG_NAME = "DDS Group";

export const COMPANIES: Company[] = [
  {
    id: "occ",
    code: "OCC",
    name: "Obesity Care Clinic",
    brandVoice: "warm, professional, evidence-based",
    accent: "#2563eb",
  },
  {
    id: "tibok",
    code: "TI",
    name: "Tibok",
    brandVoice: "friendly, modern, accessible",
    accent: "#d62976",
  },
  {
    id: "cvmi",
    code: "CV",
    name: "Cabo Verde Medical International",
    brandVoice: "authoritative, international, medical",
    accent: "#16a34a",
  },
];

const occ: CompanyData = {
  dashboard: {
    organic: { scheduled: 7, published7d: 12, inLibrary: 23, failed: 1 },
    paid: {
      activeCampaigns: 3,
      spendMtd: 2840,
      spendCap: 5000,
      conversions: 142,
      aiBudgetUsed: 8,
      aiBudgetCap: 65,
    },
    upcomingPosts: [
      { platform: "facebook", title: "Hydration wellness tip", when: "Mon 09:00" },
      { platform: "instagram", title: "Hydration wellness tip", when: "Mon 09:00" },
      { platform: "facebook", title: "Sarah's journey", when: "Wed 09:00" },
    ],
    topAd: {
      platform: "facebook",
      name: "Hydration tip — FB Feed",
      spend: 420,
      ctr: "3.8%",
      conversions: 34,
    },
  },
  accounts: [
    { id: "occ-fb", platform: "facebook", accountName: "OCC Facebook Page", status: "active" },
    { id: "occ-ig", platform: "instagram", accountName: "@occ_mauritius", status: "active" },
  ],
  scheduled: [
    { id: "s1", platform: "facebook", title: "Hydration wellness tip", date: "2026-05-25", time: "09:00", source: "automation", automationName: "M/W/F wellness tips", media: { kind: "image" }, body: "Staying hydrated isn't just about quenching thirst — it supports metabolism, focus, and recovery. Aim for 2L a day." },
    { id: "s2", platform: "instagram", title: "Hydration wellness tip", date: "2026-05-25", time: "09:00", source: "automation", automationName: "M/W/F wellness tips", media: { kind: "image" }, body: "Hydration check! Your body uses water for everything — digestion, focus, even skin glow.\n\n#wellness #hydration" },
    { id: "s3", platform: "facebook", title: "Patient testimonial — Sarah", date: "2026-05-27", time: "09:00", source: "automation", automationName: "Patient stories", body: "Sarah lost 18kg over 14 months with our supervised program.\n\n\"The team supported me every step of the way.\" — Read her full story." },
    { id: "s4", platform: "facebook", title: "Free consultation week — May promo", date: "2026-05-27", time: "15:30", source: "manual", media: { kind: "image" }, body: "This week only: book a free initial consultation with our specialists. Limited slots — reserve yours today." },
    { id: "s5", platform: "instagram", title: "Weekly wellness tip — sleep", date: "2026-05-29", time: "09:00", source: "automation", automationName: "M/W/F wellness tips", body: "Quality sleep is the foundation of a healthy metabolism. Aim for 7–9 hours and keep a consistent schedule.\n\n#sleep #wellness" },
    { id: "d1", platform: "facebook", title: "Bariatric Q&A — answering your questions", date: "2026-05-30", time: "10:00", source: "manual", status: "draft", body: "We get a lot of questions about bariatric surgery. This week our team answers the most common ones — from recovery time to long-term results." },
    { id: "d2", platform: "instagram", title: "Meet the team — Dr. Patel", date: "2026-06-01", time: "12:00", source: "manual", status: "draft", body: "Say hello to Dr. Patel, who has guided hundreds of patients through their weight-loss journey with warmth and evidence-based care." },
    { id: "d3", platform: "facebook", title: "June challenge — 10K steps a day", date: "2026-06-02", time: "08:00", source: "manual", status: "draft", body: "This June, join our 10,000-steps-a-day challenge. Small daily movement adds up to big results — who's in?" },
  ],
  library: {
    unused: 23,
    runway: "~2.5 wks",
    aiBudgetUsed: 8.4,
    aiBudgetCap: 65,
    imageSpend: 8.4,
    videoSpend: 0,
    templates: [
      {
        id: "t1",
        platform: "facebook",
        tags: ["wellness", "hydration"],
        body: "Staying hydrated isn't just about quenching thirst — it supports metabolism, focus, and recovery.",
        status: "unused",
        addedDate: "2026-05-18",
        media: { kind: "image", ready: true },
      },
      {
        id: "t2",
        platform: "instagram",
        tags: ["wellness"],
        body: "Hydration check! Your body uses water for everything — digestion, focus, even skin glow. #wellness",
        status: "used",
        addedDate: "2026-05-12",
        media: { kind: "image", ready: true },
      },
      {
        id: "t3",
        platform: "facebook",
        tags: ["testimonials"],
        body: "Sarah lost 18kg over 14 months with our supervised program.",
        status: "unused",
        addedDate: "2026-05-20",
        media: { kind: "none", ready: false },
      },
      {
        id: "t4",
        platform: "instagram",
        tags: ["tips", "wellness"],
        body: "Small swap, big difference: replace one sugary drink a day with water. #wellness",
        status: "used",
        addedDate: "2026-05-09",
        media: { kind: "video", seconds: 5, ready: true },
      },
      {
        id: "t5",
        platform: "facebook",
        tags: ["education"],
        body: "Understanding BMI is a starting point, not the whole story. Our specialists look at the full picture of your health.",
        status: "unused",
        addedDate: "2026-05-21",
        media: { kind: "none", ready: false },
      },
      {
        id: "t6",
        platform: "instagram",
        tags: ["recipes"],
        body: "High-protein breakfast idea: Greek yoghurt, berries, and a sprinkle of seeds. Keeps you full for hours.",
        status: "archived",
        addedDate: "2026-04-28",
        media: { kind: "image", ready: true },
      },
    ],
  },
  automations: {
    active: 2,
    paused: 1,
    postsThisWeek: 6,
    rules: [
      {
        id: "a1",
        name: "OCC Facebook — M/W/F wellness tips",
        account: "OCC Facebook",
        socialAccountId: "occ-fb",
        platform: "facebook",
        days: ["mon", "wed", "fri"],
        time: "09:00",
        libraryName: "OCC Facebook library",
        tagFilter: ["wellness"],
        onEmpty: "pause_and_alert",
        schedule: "Mon, Wed, Fri at 09:00",
        status: "active",
        libraryNote: "Library: wellness (12 unused)",
        next: "Mon 25 May 09:00",
        last: "Fri 22 May 09:00",
        publishedCount: 47,
        lastRunAt: "2026-05-22T09:00:00",
        enabled: true,
      },
      {
        id: "a2",
        name: "OCC Instagram — M/W/F wellness tips",
        account: "OCC Instagram",
        socialAccountId: "occ-ig",
        platform: "instagram",
        days: ["mon", "wed", "fri"],
        time: "09:00",
        libraryName: "OCC Instagram library",
        tagFilter: ["wellness"],
        onEmpty: "pause_and_alert",
        schedule: "Mon, Wed, Fri at 09:00",
        status: "library_low",
        libraryNote: "3 unused — 1 week left",
        publishedCount: 22,
        warning: "Library empty after Fri 29 May. Add templates to keep running.",
        enabled: true,
      },
      {
        id: "a3",
        name: "OCC Facebook — patient testimonials",
        account: "OCC Facebook",
        socialAccountId: "occ-fb",
        platform: "facebook",
        days: ["fri"],
        time: "14:00",
        libraryName: "OCC Facebook library",
        tagFilter: ["testimonials"],
        onEmpty: "pause_and_alert",
        schedule: "Every Friday at 14:00",
        status: "paused",
        libraryNote: "",
        publishedCount: 11,
        pausedSince: "Paused since 18 May",
        enabled: false,
      },
    ],
  },
  history: [
    {
      id: "h1",
      platform: "instagram",
      body: "Hydration check! Your body uses water...",
      fullBody: "Hydration check! Your body uses water for everything — digestion, focus, even skin glow.\n\n#wellness #hydration",
      when: "Fri 22 May 09:00",
      source: "automation",
      automationName: "M/W/F wellness tips",
      scheduledAt: "2026-05-22T09:00:00",
      publishedAt: "2026-05-22T09:00:12",
      status: "published",
      stats: "47 reactions · 3 comments",
      metrics: { reactions: 47, comments: 3, shares: 5, linkClicks: 18 },
      externalUrl: "#",
      media: { kind: "image" },
    },
    {
      id: "h2",
      platform: "facebook",
      body: "Staying hydrated isn't just about quenching...",
      fullBody: "Staying hydrated isn't just about quenching thirst — it supports metabolism, focus, and recovery. Aim for 2L a day.",
      when: "Fri 22 May 09:00",
      source: "automation",
      automationName: "M/W/F wellness tips",
      scheduledAt: "2026-05-22T09:00:00",
      publishedAt: "2026-05-22T09:00:08",
      status: "published",
      stats: "124 reactions · 8 comments",
      metrics: { reactions: 124, comments: 8, shares: 19, linkClicks: 42 },
      externalUrl: "#",
      media: { kind: "image" },
    },
    {
      id: "h3",
      platform: "instagram",
      body: "Small swap, big difference...",
      fullBody: "Small swap, big difference: replace one sugary drink a day with water.\n\n#wellness",
      when: "Wed 20 May 09:00",
      source: "automation",
      automationName: "M/W/F wellness tips",
      scheduledAt: "2026-05-20T09:00:00",
      status: "failed",
      media: { kind: "image" },
      error: {
        title: "Image dimensions invalid for Instagram",
        detail: 'Meta: "Aspect ratio must be between 4:5 and 1.91:1. Provided: 2.1:1." Crop before reposting.',
      },
    },
    {
      id: "h4",
      platform: "facebook",
      body: "Small swap, big difference...",
      fullBody: "Small swap, big difference: replace one sugary drink a day with water.\n\n#wellness #hydration",
      when: "Wed 20 May 09:00",
      source: "automation",
      automationName: "M/W/F wellness tips",
      scheduledAt: "2026-05-20T09:00:00",
      publishedAt: "2026-05-20T09:00:05",
      status: "published",
      stats: "89 reactions · 5 comments",
      metrics: { reactions: 89, comments: 5, shares: 11, linkClicks: 27 },
      externalUrl: "#",
      media: { kind: "image" },
    },
    {
      id: "h5",
      platform: "facebook",
      body: "Patient testimonial — Sarah",
      fullBody: "Sarah lost 18kg over 14 months with our supervised program.\n\n\"The team supported me every step of the way.\"",
      when: "Wed 13 May 09:00",
      source: "automation",
      automationName: "Patient stories",
      scheduledAt: "2026-05-13T09:00:00",
      publishedAt: "2026-05-13T09:00:07",
      status: "published",
      stats: "212 reactions · 14 comments",
      metrics: { reactions: 212, comments: 14, shares: 31, linkClicks: 58 },
      externalUrl: "#",
    },
    {
      id: "h6",
      platform: "facebook",
      body: "Bariatric Q&A reminder",
      fullBody: "Don't miss tomorrow's bariatric Q&A — submit your questions in the comments and our team will answer them live.",
      when: "Sat 2 May 12:00",
      source: "manual",
      scheduledAt: "2026-05-02T12:00:00",
      publishedAt: "2026-05-02T12:00:03",
      status: "published",
      stats: "33 reactions · 9 comments",
      metrics: { reactions: 33, comments: 9, shares: 4, linkClicks: 12 },
      externalUrl: "#",
    },
  ],
  campaigns: {
    activeCampaigns: 3,
    spendMtd: 2840,
    conversions: 142,
    avgCpc: 0.42,
    list: [
      {
        id: "c1",
        name: "January Detox Program — Lead Gen",
        objective: "Leads",
        platforms: ["FB", "IG"],
        status: "active",
        spend: 1200,
        budget: 2000,
        metricsLabel: "48,210 impr.",
        metricsValue: "2.97% CTR · 89 leads",
        cplLabel: "EUR 13.48 CPL",
        enabled: true,
        adSets: [
          {
            id: "as1",
            name: "Women 35-55 Mauritius",
            placement: "FB Feed + IG Feed + IG Stories",
            targeting: "Lookalike: OCC patients",
            ads: 3,
            dailyBudget: 40,
          },
          {
            id: "as2",
            name: "Men 35-55 Mauritius",
            placement: "FB Feed + IG Feed",
            targeting: "Interests: fitness, health",
            ads: 2,
            dailyBudget: 40,
          },
        ],
      },
      {
        id: "c2",
        name: "Wellness Webinar — Awareness",
        objective: "Awareness",
        platforms: ["IG"],
        status: "active",
        spend: 640,
        budget: 1500,
        metricsLabel: "124,800 impr.",
        metricsValue: "1 set · 2 ads",
        enabled: true,
        adSets: [
          {
            id: "as3",
            name: "Wellness curious 25-45 Mauritius",
            placement: "IG Feed + IG Reels",
            targeting: "Interests: nutrition, mindfulness",
            ads: 2,
            dailyBudget: 30,
          },
        ],
      },
      {
        id: "c3",
        name: "Bariatric Consultation — Conversions",
        objective: "Conversions",
        platforms: ["FB"],
        status: "active",
        spend: 1000,
        budget: 3000,
        metricsLabel: "53 conv.",
        metricsValue: "EUR 18.87 CPA",
        enabled: true,
        adSets: [
          {
            id: "as4",
            name: "Men 40-60 Mauritius",
            placement: "FB Feed",
            targeting: "Lookalike: bariatric consults",
            ads: 2,
            dailyBudget: 50,
          },
          {
            id: "as5",
            name: "Women 40-60 Mauritius",
            placement: "FB Feed",
            targeting: "Interests: weight loss, health checks",
            ads: 1,
            dailyBudget: 35,
          },
        ],
      },
    ],
  },
  audiences: {
    total: 5,
    inUse: 3,
    combinedReach: "~480K",
    list: [
      {
        id: "aud1",
        type: "saved",
        name: "Women 35-55 Mauritius — Wellness",
        description: "Female · 35-55 · Mauritius",
        detail: "Interests: weight loss, wellness, nutrition",
        reach: "180K-220K",
        created: "Created 12 May",
        inUse: 1,
        config: {
          gender: "Female",
          ageRange: "35-55",
          locations: ["Mauritius"],
          interests: ["Weight loss", "Wellness", "Nutrition"],
          behaviors: ["Engaged shoppers"],
        },
        lastSyncedAt: "2026-05-29T06:00:00",
        usedByAdSetIds: ["as5"],
        metaAudienceId: "act_540021",
        createdAt: "2026-05-12",
        createdBy: "Younes",
      },
      {
        id: "aud2",
        type: "saved",
        name: "Men 35-55 Mauritius — Health",
        description: "Male · 35-55 · Mauritius",
        detail: "Interests: fitness, men's health",
        reach: "140K-170K",
        created: "Created 12 May",
        inUse: 1,
        config: {
          gender: "Male",
          ageRange: "35-55",
          locations: ["Mauritius"],
          interests: ["Fitness", "Men's health", "Health checkups"],
          behaviors: ["Frequent travellers"],
        },
        lastSyncedAt: "2026-05-29T06:00:00",
        usedByAdSetIds: ["as2"],
        metaAudienceId: "act_540022",
        createdAt: "2026-05-12",
        createdBy: "Younes",
      },
      {
        id: "aud3",
        type: "custom",
        name: "OCC past patients",
        description: "Uploaded list · 1,247 matched on Meta",
        detail: "Refreshed 18 May",
        reach: "~1.2K",
        created: "Created 28 Apr",
        inUse: 0,
        config: {
          source: "Uploaded list",
          fileName: "occ_past_patients_q1.csv",
          uploadDate: "2026-04-28",
          matchRate: "1,247 of 1,500 emails matched on Meta · 83%",
          refreshedAt: "2026-05-18",
        },
        lastSyncedAt: "2026-05-18T08:00:00",
        usedByAdSetIds: [],
        metaAudienceId: "act_540023",
        createdAt: "2026-04-28",
        createdBy: "Sarah M.",
      },
      {
        id: "aud4",
        type: "lookalike",
        name: "Lookalike — OCC patients (1%)",
        description: "Mauritius · Top 1% similarity",
        detail: "Based on OCC past patients",
        reach: "~12K",
        created: "Created 28 Apr",
        inUse: 1,
        config: {
          sourceAudienceId: "aud3",
          sourceAudienceName: "OCC past patients",
          similarity: "Top 1%",
          countries: ["Mauritius"],
        },
        lastSyncedAt: "2026-05-29T06:00:00",
        usedByAdSetIds: ["as1"],
        metaAudienceId: "act_540024",
        createdAt: "2026-04-28",
        createdBy: "Younes",
      },
      {
        id: "aud5",
        type: "saved",
        name: "Wellness curious 25-45 Mauritius",
        description: "All · 25-45 · Mauritius",
        detail: "Interests: nutrition, mindfulness",
        reach: "210K-260K",
        created: "Created 6 May",
        inUse: 0,
        config: {
          gender: "All",
          ageRange: "25-45",
          locations: ["Mauritius"],
          interests: ["Nutrition", "Mindfulness", "Healthy living"],
        },
        lastSyncedAt: "2026-05-29T06:00:00",
        usedByAdSetIds: [],
        metaAudienceId: "act_540025",
        createdAt: "2026-05-06",
        createdBy: "Younes",
      },
    ],
  },
  adPerformance: {
    spend: 2840,
    spendTrend: "UP 12%",
    impressions: "205K",
    impressionsTrend: "UP 8%",
    clicks: "6,720",
    clicksTrend: "UP 15%",
    conversions: 142,
    conversionsTrend: "UP 22%",
    avgCpc: 0.42,
    avgCpcTrend: "DN 3%",
    series: {
      spend: [40, 62, 70, 78, 82, 80, 88, 96, 104, 118, 126, 132],
      conversions: [18, 24, 28, 30, 34, 33, 40, 44, 50, 56, 62, 70],
    },
    topAds: [
      { name: "Hydration tip — FB Feed", context: "January Detox · Women 35-55", spend: 420, ctr: "3.8%", cpc: 0.38, conv: 34 },
      { name: "Patient testimonial — IG Stories", context: "January Detox · Lookalike", spend: 380, ctr: "3.2%", cpc: 0.41, conv: 28 },
      { name: "Free consultation — FB Feed", context: "Bariatric · Men 40-60", spend: 520, ctr: "2.1%", cpc: 0.55, conv: 22 },
    ],
    insight:
      '"Hydration tip" is your best performer at EUR 12.35 per conversion. Consider increasing its budget by 30%, or testing similar messaging in other campaigns.',
  },
  adSafety: {
    monthlyCap: 5000,
    usedThisMonth: 2840,
    requireBudgetCap: true,
    confirmAiSpend: true,
    doubleConfirmThreshold: 500,
    dailyDigest: true,
    recentAudit: 'Younes increased "January Detox" daily budget EUR 60 to 80 · 21 May 15:42',
  },
  // 4 days into the 7-day safety period (today = 2026-05-30; connected 26 May).
  meta: {
    connected: true,
    connectedAt: "2026-05-26",
    businessManagerName: "OCC Holdings",
    facebookPageName: "OCC Facebook Page",
    instagramHandle: "@occ_mauritius",
    readOnly: true,
    keepReadOnlyAfterSafety: false,
  },
  linkedin: { connected: false },
};

const tibok: CompanyData = {
  dashboard: {
    organic: { scheduled: 4, published7d: 9, inLibrary: 15, failed: 0 },
    paid: {
      activeCampaigns: 2,
      spendMtd: 1420,
      spendCap: 4000,
      conversions: 96,
      aiBudgetUsed: 14,
      aiBudgetCap: 65,
    },
    upcomingPosts: [
      { platform: "instagram", title: "Telehealth in 60 seconds", when: "Tue 10:00" },
      { platform: "facebook", title: "Meet your doctor online", when: "Thu 11:00" },
    ],
    topAd: {
      platform: "instagram",
      name: "Consult from home — IG Reels",
      spend: 310,
      ctr: "4.1%",
      conversions: 41,
    },
  },
  accounts: [
    { id: "ti-fb", platform: "facebook", accountName: "Tibok Facebook Page", status: "active" },
    { id: "ti-ig", platform: "instagram", accountName: "@tibok.health", status: "active" },
  ],
  scheduled: [
    { id: "ts1", platform: "instagram", title: "Telehealth in 60 seconds", date: "2026-05-26", time: "10:00", source: "automation", automationName: "Daily education", media: { kind: "video" }, body: "Feeling unwell? Talk to a licensed doctor from your couch in minutes.\n\n#telehealth" },
    { id: "ts2", platform: "facebook", title: "Meet your doctor online", date: "2026-05-28", time: "11:00", source: "manual", needsReview: true, media: { kind: "image" }, body: "No waiting rooms. No traffic. Just quality care, online — whenever you need it." },
    { id: "ts3", platform: "instagram", title: "5 signs you should see a GP", date: "2026-05-30", time: "10:00", source: "automation", automationName: "Daily education", body: "When should you actually see a doctor? Here are 5 signs not to ignore." },
    { id: "td1", platform: "instagram", title: "How online prescriptions work", date: "2026-05-31", time: "10:00", source: "manual", status: "draft", body: "Wondering how online prescriptions work with Tibok? Here's the simple 3-step process — consult, get your script, collect at your pharmacy." },
    { id: "td2", platform: "facebook", title: "Weekend clinic hours update", date: "2026-06-01", time: "09:00", source: "manual", status: "draft", body: "Good news — our online doctors are now available all weekend. Quality care whenever you need it, no appointment required." },
  ],
  library: {
    unused: 15,
    runway: "~1.8 wks",
    aiBudgetUsed: 14.2,
    aiBudgetCap: 65,
    imageSpend: 11.0,
    videoSpend: 3.2,
    templates: [
      {
        id: "tb1",
        platform: "instagram",
        tags: ["education", "telehealth"],
        body: "Feeling unwell? Talk to a licensed doctor from your couch in minutes. #telehealth",
        status: "unused",
        addedDate: "2026-05-19",
        media: { kind: "image", ready: true },
      },
      {
        id: "tb2",
        platform: "facebook",
        tags: ["education"],
        body: "No waiting rooms. No traffic. Just quality care, online.",
        status: "used",
        addedDate: "2026-05-10",
        media: { kind: "image", ready: true },
      },
      {
        id: "tb3",
        platform: "instagram",
        tags: ["tips"],
        body: "When should you actually see a doctor? Here are 5 signs not to ignore.",
        status: "unused",
        addedDate: "2026-05-22",
        media: { kind: "video", seconds: 8, ready: true },
      },
      {
        id: "tb4",
        platform: "facebook",
        tags: ["trust"],
        body: "Every Tibok doctor is fully licensed and verified. Your health is in safe hands.",
        status: "used",
        addedDate: "2026-05-06",
        media: { kind: "none", ready: false },
      },
    ],
  },
  automations: {
    active: 1,
    paused: 1,
    postsThisWeek: 3,
    rules: [
      {
        id: "tba1",
        name: "Tibok Instagram — daily education",
        account: "Tibok Instagram",
        socialAccountId: "ti-ig",
        platform: "instagram",
        days: ["mon", "tue", "wed", "thu", "fri"],
        time: "10:00",
        libraryName: "Tibok Instagram library",
        tagFilter: ["education"],
        onEmpty: "pause_and_alert",
        schedule: "Mon-Fri at 10:00",
        status: "active",
        libraryNote: "Library: education (9 unused)",
        next: "Tue 26 May 10:00",
        last: "Mon 25 May 10:00",
        publishedCount: 62,
        lastRunAt: "2026-05-25T10:00:00",
        enabled: true,
      },
      {
        id: "tba2",
        name: "Tibok Facebook — weekly trust posts",
        account: "Tibok Facebook",
        socialAccountId: "ti-fb",
        platform: "facebook",
        days: ["mon"],
        time: "11:00",
        libraryName: "Tibok Facebook library",
        tagFilter: ["trust"],
        onEmpty: "pause_and_alert",
        schedule: "Every Monday at 11:00",
        status: "paused",
        libraryNote: "",
        publishedCount: 8,
        pausedSince: "Paused since 11 May",
        enabled: false,
      },
    ],
  },
  history: [
    {
      id: "th1",
      platform: "instagram",
      body: "Feeling unwell? Talk to a licensed doctor...",
      fullBody: "Feeling unwell? Talk to a licensed doctor from your couch in minutes.\n\n#telehealth",
      when: "Mon 25 May 10:00",
      source: "automation",
      automationName: "Daily education",
      scheduledAt: "2026-05-25T10:00:00",
      publishedAt: "2026-05-25T10:00:09",
      status: "published",
      stats: "212 reactions · 14 comments",
      metrics: { reactions: 212, comments: 14, shares: 22, linkClicks: 64 },
      externalUrl: "#",
      media: { kind: "video" },
    },
    {
      id: "th2",
      platform: "facebook",
      body: "No waiting rooms. No traffic...",
      fullBody: "No waiting rooms. No traffic. Just quality care, online — whenever you need it.",
      when: "Sat 23 May 09:00",
      source: "manual",
      scheduledAt: "2026-05-23T09:00:00",
      publishedAt: "2026-05-23T09:00:04",
      status: "published",
      stats: "58 reactions · 2 comments",
      metrics: { reactions: 58, comments: 2, shares: 7, linkClicks: 15 },
      externalUrl: "#",
      media: { kind: "image" },
    },
    {
      id: "th3",
      platform: "instagram",
      body: "5 signs you should see a GP...",
      fullBody: "When should you actually see a doctor? Here are 5 signs not to ignore.",
      when: "Mon 11 May 10:00",
      source: "automation",
      automationName: "Daily education",
      scheduledAt: "2026-05-11T10:00:00",
      status: "failed",
      error: {
        title: "Token expired for @tibok.health",
        detail: 'Meta: "OAuthException — User access token expired." Reconnect the account in Settings → Accounts.',
      },
    },
  ],
  campaigns: {
    activeCampaigns: 2,
    spendMtd: 1420,
    conversions: 96,
    avgCpc: 0.36,
    list: [
      {
        id: "tc1",
        name: "Telehealth Launch — Traffic",
        objective: "Traffic",
        platforms: ["FB", "IG"],
        status: "active",
        spend: 820,
        budget: 1500,
        metricsLabel: "92,400 impr.",
        metricsValue: "3.4% CTR · 41 conv",
        cplLabel: "EUR 20.00 CPA",
        enabled: true,
        adSets: [
          {
            id: "tas1",
            name: "Adults 25-45 Mauritius",
            placement: "FB Feed + IG Reels",
            targeting: "Interests: healthcare, busy professionals",
            ads: 3,
            dailyBudget: 30,
          },
        ],
      },
      {
        id: "tc2",
        name: "App Installs — Mobile",
        objective: "App promotion",
        platforms: ["IG"],
        status: "paused",
        spend: 600,
        budget: 1200,
        metricsLabel: "61,200 impr.",
        metricsValue: "1 set · 2 ads",
        enabled: false,
        adSets: [],
      },
    ],
  },
  audiences: {
    total: 4,
    inUse: 2,
    combinedReach: "~310K",
    list: [
      {
        id: "tau1",
        type: "saved",
        name: "Busy professionals 25-45",
        description: "All · 25-45 · Mauritius",
        detail: "Interests: healthcare, productivity",
        reach: "150K-190K",
        created: "Created 8 May",
        inUse: 1,
      },
      {
        id: "tau2",
        type: "lookalike",
        name: "Lookalike — Tibok app users (2%)",
        description: "Mauritius · Top 2% similarity",
        detail: "Based on app installers",
        reach: "~24K",
        created: "Created 2 May",
        inUse: 1,
      },
    ],
  },
  adPerformance: {
    spend: 1420,
    spendTrend: "UP 9%",
    impressions: "112K",
    impressionsTrend: "UP 18%",
    clicks: "3,980",
    clicksTrend: "UP 21%",
    conversions: 96,
    conversionsTrend: "UP 31%",
    avgCpc: 0.36,
    avgCpcTrend: "DN 6%",
    series: {
      spend: [22, 30, 36, 40, 44, 48, 52, 58, 60, 66, 70, 74],
      conversions: [10, 14, 18, 20, 26, 30, 38, 44, 52, 60, 70, 82],
    },
    topAds: [
      { name: "Consult from home — IG Reels", context: "Telehealth Launch · 25-45", spend: 310, ctr: "4.1%", cpc: 0.31, conv: 41 },
      { name: "No waiting rooms — FB Feed", context: "Telehealth Launch · 25-45", spend: 280, ctr: "3.3%", cpc: 0.38, conv: 29 },
    ],
    insight:
      '"Consult from home" reels are converting 32% above account average. Reels placement is outperforming feed — consider shifting more budget there.',
  },
  adSafety: {
    monthlyCap: 4000,
    usedThisMonth: 1420,
    requireBudgetCap: true,
    confirmAiSpend: true,
    doubleConfirmThreshold: 400,
    dailyDigest: true,
    recentAudit: 'Younes paused "App Installs — Mobile" · 19 May 11:08',
  },
  // Safety period long expired; user kept read-only on (connected 1 May).
  meta: {
    connected: true,
    connectedAt: "2026-05-01",
    businessManagerName: "Tibok Holdings",
    facebookPageName: "Tibok Facebook Page",
    instagramHandle: "@tibok.health",
    readOnly: true,
    keepReadOnlyAfterSafety: true,
  },
  linkedin: { connected: false },
};

const cvmi: CompanyData = {
  dashboard: {
    organic: { scheduled: 2, published7d: 5, inLibrary: 9, failed: 0 },
    paid: {
      activeCampaigns: 1,
      spendMtd: 560,
      spendCap: 3000,
      conversions: 18,
      aiBudgetUsed: 3,
      aiBudgetCap: 65,
    },
    upcomingPosts: [
      { platform: "facebook", title: "International patient program", when: "Wed 12:00" },
      { platform: "facebook", title: "Accredited care, global standards", when: "Fri 12:00" },
    ],
    topAd: {
      platform: "facebook",
      name: "Medical excellence — FB Feed",
      spend: 240,
      ctr: "2.4%",
      conversions: 12,
    },
  },
  accounts: [
    { id: "cv-fb", platform: "facebook", accountName: "CVMI Facebook Page", status: "active" },
  ],
  scheduled: [
    { id: "cs1", platform: "facebook", title: "International patient program", date: "2026-05-27", time: "12:00", source: "automation", automationName: "Twice-weekly trust posts", media: { kind: "image" }, body: "Our international patient program coordinates travel, treatment, and recovery — all in one place." },
    { id: "cs2", platform: "facebook", title: "Accredited care, global standards", date: "2026-05-29", time: "12:00", source: "manual", body: "Internationally accredited care, delivered with precision and compassion. World-class medicine, close to home." },
    { id: "cd1", platform: "facebook", title: "Patient travel guide — what to expect", date: "2026-05-31", time: "12:00", source: "manual", status: "draft", body: "Travelling for treatment can feel daunting. Our patient travel guide walks you through every step, from visa support to recovery accommodation." },
  ],
  library: {
    unused: 9,
    runway: "~3.0 wks",
    aiBudgetUsed: 3.1,
    aiBudgetCap: 65,
    imageSpend: 3.1,
    videoSpend: 0,
    templates: [
      {
        id: "cv1",
        platform: "facebook",
        tags: ["trust"],
        body: "Internationally accredited care, delivered with precision and compassion.",
        status: "unused",
        addedDate: "2026-05-15",
        media: { kind: "image", ready: true },
      },
      {
        id: "cv2",
        platform: "facebook",
        tags: ["programs"],
        body: "Our international patient program coordinates travel, treatment, and recovery — all in one place.",
        status: "used",
        addedDate: "2026-05-08",
        media: { kind: "image", ready: true },
      },
      {
        id: "cv3",
        platform: "facebook",
        tags: ["trust"],
        body: "Specialists trained across three continents. World-class medicine, close to home.",
        status: "unused",
        addedDate: "2026-05-16",
        media: { kind: "none", ready: false },
      },
    ],
  },
  automations: {
    active: 1,
    paused: 0,
    postsThisWeek: 2,
    rules: [
      {
        id: "cva1",
        name: "CVMI Facebook — twice-weekly trust posts",
        account: "CVMI Facebook",
        socialAccountId: "cv-fb",
        platform: "facebook",
        days: ["wed", "fri"],
        time: "12:00",
        libraryName: "CVMI Facebook library",
        tagFilter: ["trust"],
        onEmpty: "pause_and_alert",
        schedule: "Wed, Fri at 12:00",
        status: "active",
        libraryNote: "Library: trust (6 unused)",
        next: "Wed 27 May 12:00",
        last: "Fri 22 May 12:00",
        publishedCount: 28,
        lastRunAt: "2026-05-22T12:00:00",
        enabled: true,
      },
    ],
  },
  history: [
    {
      id: "ch1",
      platform: "facebook",
      body: "Internationally accredited care...",
      fullBody: "Internationally accredited care, delivered with precision and compassion.",
      when: "Fri 22 May 12:00",
      source: "automation",
      automationName: "Twice-weekly trust posts",
      scheduledAt: "2026-05-22T12:00:00",
      publishedAt: "2026-05-22T12:00:06",
      status: "published",
      stats: "41 reactions · 1 comment",
      metrics: { reactions: 41, comments: 1, shares: 3, linkClicks: 9 },
      externalUrl: "#",
      media: { kind: "image" },
    },
    {
      id: "ch2",
      platform: "facebook",
      body: "Specialists trained across three continents...",
      fullBody: "Specialists trained across three continents. World-class medicine, close to home.",
      when: "Wed 20 May 12:00",
      source: "automation",
      automationName: "Twice-weekly trust posts",
      scheduledAt: "2026-05-20T12:00:00",
      publishedAt: "2026-05-20T12:00:05",
      status: "published",
      stats: "33 reactions",
      metrics: { reactions: 33, comments: 0, shares: 4, linkClicks: 7 },
      externalUrl: "#",
    },
  ],
  campaigns: {
    activeCampaigns: 1,
    spendMtd: 560,
    conversions: 18,
    avgCpc: 0.61,
    list: [
      {
        id: "cvc1",
        name: "International Patients — Awareness",
        objective: "Awareness",
        platforms: ["FB"],
        status: "active",
        spend: 560,
        budget: 2000,
        metricsLabel: "38,900 impr.",
        metricsValue: "2.4% CTR · 18 conv",
        cplLabel: "EUR 31.11 CPA",
        enabled: true,
        adSets: [
          {
            id: "cvas1",
            name: "Regional — West Africa 30-60",
            placement: "FB Feed",
            targeting: "Interests: medical travel, healthcare",
            ads: 2,
            dailyBudget: 25,
          },
        ],
      },
    ],
  },
  audiences: {
    total: 3,
    inUse: 1,
    combinedReach: "~190K",
    list: [
      {
        id: "cvau1",
        type: "saved",
        name: "Medical travel — West Africa",
        description: "All · 30-60 · West Africa",
        detail: "Interests: medical travel, private healthcare",
        reach: "120K-160K",
        created: "Created 4 May",
        inUse: 1,
      },
      {
        id: "cvau2",
        type: "custom",
        name: "CVMI enquiry list",
        description: "Uploaded list · 380 matched on Meta",
        detail: "Refreshed 12 May",
        reach: "~380",
        created: "Created 30 Apr",
        inUse: 0,
      },
    ],
  },
  adPerformance: {
    spend: 560,
    spendTrend: "UP 4%",
    impressions: "39K",
    impressionsTrend: "UP 6%",
    clicks: "940",
    clicksTrend: "UP 9%",
    conversions: 18,
    conversionsTrend: "UP 11%",
    avgCpc: 0.61,
    avgCpcTrend: "UP 2%",
    series: {
      spend: [8, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32],
      conversions: [1, 2, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16],
    },
    topAds: [
      { name: "Medical excellence — FB Feed", context: "Intl Patients · West Africa", spend: 240, ctr: "2.4%", cpc: 0.58, conv: 12 },
      { name: "Global standards — FB Feed", context: "Intl Patients · West Africa", spend: 180, ctr: "1.9%", cpc: 0.66, conv: 6 },
    ],
    insight:
      "CVMI underperforms relative to ad spend. Consider revisiting targeting or creative — current CPA is well above the group average.",
  },
  adSafety: {
    monthlyCap: 3000,
    usedThisMonth: 560,
    requireBudgetCap: true,
    confirmAiSpend: true,
    doubleConfirmThreshold: 500,
    dailyDigest: false,
    recentAudit: 'Younes created "International Patients — Awareness" · 4 May 09:20',
  },
  // Meta not connected for CVMI — exercises the disconnected card path.
  meta: {
    connected: false,
    readOnly: true,
    keepReadOnlyAfterSafety: false,
  },
  linkedin: { connected: false },
};

export const COMPANY_DATA: Record<string, CompanyData> = {
  occ,
  tibok,
  cvmi,
};

// Build a valid, empty-ish CompanyData for a newly-created company so every
// screen renders without special-casing. Frontend-only; no backend.
export function makeEmptyCompanyData(): CompanyData {
  return {
    dashboard: {
      organic: { scheduled: 0, published7d: 0, inLibrary: 0, failed: 0 },
      paid: { activeCampaigns: 0, spendMtd: 0, spendCap: 5000, conversions: 0, aiBudgetUsed: 0, aiBudgetCap: 65 },
      upcomingPosts: [],
      topAd: { platform: "facebook", name: "—", spend: 0, ctr: "0%", conversions: 0 },
    },
    accounts: [],
    scheduled: [],
    library: { unused: 0, runway: "—", aiBudgetUsed: 0, aiBudgetCap: 65, imageSpend: 0, videoSpend: 0, templates: [] },
    automations: { active: 0, paused: 0, postsThisWeek: 0, rules: [] },
    history: [],
    campaigns: { activeCampaigns: 0, spendMtd: 0, conversions: 0, avgCpc: 0, list: [] },
    audiences: { total: 0, inUse: 0, combinedReach: "—", list: [] },
    adPerformance: {
      spend: 0, spendTrend: "UP 0%",
      impressions: "0", impressionsTrend: "UP 0%",
      clicks: "0", clicksTrend: "UP 0%",
      conversions: 0, conversionsTrend: "UP 0%",
      avgCpc: 0, avgCpcTrend: "UP 0%",
      series: { spend: [], conversions: [] },
      topAds: [],
      insight: "No ad data yet for this company.",
    },
    adSafety: {
      monthlyCap: 5000, usedThisMonth: 0, requireBudgetCap: true,
      confirmAiSpend: true, doubleConfirmThreshold: 500, dailyDigest: true,
      recentAudit: "No changes yet.",
    },
    meta: { connected: false, readOnly: true, keepReadOnlyAfterSafety: false },
    linkedin: { connected: false },
  };
}

// Register a freshly-created company in the shared mock stores so the company
// switcher and every company-scoped screen can resolve it.
export function registerCompany(company: Company) {
  COMPANIES.push(company);
  COMPANY_DATA[company.id] = makeEmptyCompanyData();
  ANALYTICS_SERIES[company.id] = {
    postsPublished: Array(30).fill(0),
    engagement: Array(30).fill(0),
    adSpend: Array(30).fill(0),
    conversions: Array(30).fill(0),
  };
  ANALYTICS_PLATFORM_SHARE[company.id] = { facebook: 0.6, instagram: 0.4, linkedin: 0 };
}

// Per-company daily series for the Analytics screen. 30 days × 4 metrics
// each. Chosen to roll up to plausible aggregates (OCC dominates engagement
// and conversions, Tibok grew week-over-week, CVMI lags relative to spend).
//
// Index 29 is "today" (anchored to 2026-05-30 on the page).
const occPosts: number[] = [
  1, 2, 2, 3, 2, 3, 4, 3, 4, 3, 4, 4, 5, 4, 3, 5, 4, 5, 6, 5, 4, 6, 5, 6, 7, 6, 5, 7, 6, 8,
];
const occEng: number[] = [
  62, 70, 78, 84, 90, 96, 104, 96, 102, 110, 118, 126, 134, 128, 116, 132, 124, 138, 152, 138, 128, 148, 134, 152, 168, 152, 142, 178, 162, 196,
];
const occSpend: number[] = [
  60, 72, 80, 88, 94, 100, 108, 100, 108, 116, 122, 130, 138, 132, 120, 136, 128, 142, 156, 142, 132, 152, 138, 156, 172, 156, 146, 182, 166, 196,
];
const occConv: number[] = [
  2, 3, 3, 4, 4, 4, 5, 4, 5, 5, 5, 6, 6, 6, 5, 6, 6, 7, 7, 7, 6, 7, 7, 8, 8, 8, 7, 9, 8, 10,
];

const tiPosts: number[] = [
  1, 1, 2, 1, 2, 2, 2, 3, 2, 3, 2, 3, 3, 3, 4, 3, 4, 4, 4, 5, 4, 5, 4, 5, 6, 5, 6, 6, 6, 7,
];
const tiEng: number[] = [
  28, 32, 38, 36, 42, 46, 52, 56, 50, 58, 54, 62, 66, 64, 78, 72, 84, 86, 92, 102, 96, 110, 104, 116, 130, 124, 138, 142, 148, 162,
];
const tiSpend: number[] = [
  32, 34, 38, 40, 44, 46, 50, 52, 48, 54, 52, 58, 62, 60, 70, 66, 76, 78, 82, 90, 86, 96, 92, 100, 110, 104, 114, 118, 122, 128,
];
const tiConv: number[] = [
  1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 5, 6, 6, 6, 6, 7, 7, 7,
];

const cvPosts: number[] = [
  0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 3,
];
const cvEng: number[] = [
  10, 14, 12, 16, 14, 18, 16, 18, 20, 18, 20, 22, 20, 22, 18, 22, 20, 24, 22, 24, 22, 24, 22, 24, 26, 24, 22, 26, 24, 26,
];
const cvSpend: number[] = [
  16, 18, 20, 18, 20, 22, 20, 22, 18, 22, 20, 22, 24, 22, 20, 22, 18, 22, 20, 22, 18, 20, 18, 20, 22, 18, 16, 22, 20, 22,
];
const cvConv: number[] = [
  0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
];

export interface AnalyticsSeries {
  postsPublished: number[];
  engagement: number[];
  adSpend: number[];
  conversions: number[];
}

export const ANALYTICS_SERIES: Record<string, AnalyticsSeries> = {
  occ: {
    postsPublished: occPosts,
    engagement: occEng,
    adSpend: occSpend,
    conversions: occConv,
  },
  tibok: {
    postsPublished: tiPosts,
    engagement: tiEng,
    adSpend: tiSpend,
    conversions: tiConv,
  },
  cvmi: {
    postsPublished: cvPosts,
    engagement: cvEng,
    adSpend: cvSpend,
    conversions: cvConv,
  },
};

// Engagement split per company per platform. Rolls up to the platform totals
// shown in the bar chart. LinkedIn is unconnected for every company.
export const ANALYTICS_PLATFORM_SHARE: Record<string, { facebook: number; instagram: number; linkedin: number }> = {
  occ: { facebook: 0.62, instagram: 0.38, linkedin: 0 },
  tibok: { facebook: 0.45, instagram: 0.55, linkedin: 0 },
  cvmi: { facebook: 1.0, instagram: 0, linkedin: 0 },
};

export const ANALYTICS_SUMMARY =
  'Strong month across all companies. OCC drove 59% of engagement and 70% of conversions, largely from "January Detox". Tibok grew 38% week-over-week. CVMI underperforms relative to ad spend — consider revisiting targeting or creative.';

// Kept for backwards compatibility (any other screen that imported ANALYTICS
// will still get sensible aggregates). The Analytics page itself derives
// everything from the series above.
export const ANALYTICS = {
  overview: {
    postsPublished: 87,
    postsTrend: "UP 14%",
    engagement: "4,820",
    engagementTrend: "UP 22%",
    adSpend: 4260,
    adSpendTrend: "UP 9%",
    conversions: 218,
    conversionsTrend: "UP 28%",
  },
  byCompany: [
    { name: "OCC", value: 2840, pct: 59, color: "#1e3a5f" },
    { name: "Tibok", value: 1420, pct: 30, color: "#6b1f3a" },
    { name: "CVMI", value: 560, pct: 11, color: "#166534" },
  ],
  byPlatform: [
    { name: "Facebook", value: 2640, max: 2640, color: "#1877f2", connected: true },
    { name: "Instagram", value: 2180, max: 2640, color: "#d62976", connected: true },
    { name: "LinkedIn", value: 0, max: 2640, color: "#0a66c2", connected: false },
  ],
  summary: ANALYTICS_SUMMARY,
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "pending";
  companyAccess: string[]; // company ids
}

export const TEAM: TeamMember[] = [
  { id: "u1", name: "Younes O.", email: "younes@ddsgroup.mu", role: "admin", status: "active", companyAccess: ["occ", "tibok", "cvmi"] },
  { id: "u2", name: "Sarah M.", email: "sarah@ddsgroup.mu", role: "editor", status: "active", companyAccess: ["occ", "tibok", "cvmi"] },
  { id: "u3", name: "Priya R.", email: "priya@ddsgroup.mu", role: "viewer", status: "active", companyAccess: ["occ", "tibok", "cvmi"] },
  { id: "u4", name: "Marcus L.", email: "marcus@external.com", role: "editor", status: "pending", companyAccess: ["occ"] },
];

// ─── AI generation history (Settings → AI preferences) ────────────────
export interface AiGenLog {
  id: string;
  companyId: string;
  type: "text" | "image" | "video";
  description: string;
  model: string;
  prompt: string;
  costEur: number;
  createdAt: string; // ISO timestamp
}

export const AI_GENERATION_LOGS: AiGenLog[] = [
  { id: "g1", companyId: "occ", type: "image", description: "Glass of water with lemon and mint", model: "Flux 2 Pro", prompt: "A vibrant glass of water with fresh lemon and mint, warm morning light, wellness photography", costEur: 0.06, createdAt: "2026-05-29T14:22:00" },
  { id: "g2", companyId: "occ", type: "text", description: "Wellness Wednesday caption rewrite", model: "Anthropic Claude", prompt: "Rewrite the hydration caption with a friendlier opening line", costEur: 0.01, createdAt: "2026-05-29T11:08:00" },
  { id: "g3", companyId: "occ", type: "image", description: "Healthy breakfast plate flat-lay", model: "Ideogram v3", prompt: "Flat lay healthy breakfast — Greek yoghurt, berries, granola, soft morning light", costEur: 0.07, createdAt: "2026-05-28T17:40:00" },
  { id: "g4", companyId: "occ", type: "video", description: "Hydration challenge — 5s loop", model: "Kling 3.0", prompt: "Slow pan over a tall glass of water as droplets fall down the sides, cinematic", costEur: 0.48, createdAt: "2026-05-28T10:05:00" },
  { id: "g5", companyId: "occ", type: "text", description: "January Detox ad copy variant", model: "Anthropic Claude", prompt: "Write 3 variants of the headline for the January Detox program", costEur: 0.02, createdAt: "2026-05-27T15:30:00" },
  { id: "g6", companyId: "occ", type: "image", description: "Patient testimonial backdrop", model: "Flux 2 Pro", prompt: "Soft neutral background for a testimonial card, warm tones, gentle bokeh", costEur: 0.06, createdAt: "2026-05-26T09:14:00" },
  { id: "g7", companyId: "occ", type: "text", description: "Hashtag suggestions for IG post", model: "Anthropic Claude", prompt: "Suggest 10 wellness hashtags for an Instagram post about hydration", costEur: 0.005, createdAt: "2026-05-25T12:42:00" },
  { id: "g8", companyId: "occ", type: "image", description: "Bariatric consultation visual", model: "GPT Image Mini", prompt: "Calming consultation room, soft morning sunlight, medical wellness atmosphere", costEur: 0.04, createdAt: "2026-05-24T16:18:00" },
  { id: "g9", companyId: "occ", type: "text", description: "Reshorten body text for Stories", model: "Anthropic Claude", prompt: "Shorten this body to under 90 characters for IG Stories", costEur: 0.008, createdAt: "2026-05-23T08:50:00" },
  { id: "g10", companyId: "occ", type: "video", description: "Sleep wellness teaser", model: "Veo 3.1 Fast", prompt: "Calm bedroom scene at dusk, slow camera drift, warm lamp light, sleep theme", costEur: 0.52, createdAt: "2026-05-21T20:11:00" },
  { id: "g11", companyId: "tibok", type: "image", description: "Doctor on phone, telehealth", model: "Flux 2 Pro", prompt: "Friendly female doctor on a video consultation, modern minimal background", costEur: 0.06, createdAt: "2026-05-29T13:30:00" },
  { id: "g12", companyId: "tibok", type: "text", description: "5 reasons to use telehealth", model: "Anthropic Claude", prompt: "Write a 5-point list, friendly tone, accessible language", costEur: 0.02, createdAt: "2026-05-28T11:20:00" },
  { id: "g13", companyId: "tibok", type: "video", description: "App-installs short video", model: "Kling 3.0", prompt: "Hand holding phone, app opening, calming animation, 5 seconds", costEur: 0.48, createdAt: "2026-05-27T15:55:00" },
  { id: "g14", companyId: "cvmi", type: "image", description: "Hospital corridor — international patients", model: "Ideogram v3", prompt: "Bright modern hospital corridor with welcoming reception desk, international signage", costEur: 0.07, createdAt: "2026-05-28T09:40:00" },
  { id: "g15", companyId: "cvmi", type: "text", description: "Patient travel guide outline", model: "Anthropic Claude", prompt: "Outline a 6-step patient travel guide covering visas, treatment, recovery", costEur: 0.015, createdAt: "2026-05-27T10:05:00" },
];

// ─── Audit log (Settings → Audit log) ──────────────────────────────────
export type AuditEntity = "post" | "campaign" | "audience" | "ad_safety" | "team" | "settings";
export type AuditSeverity = "info" | "warning" | "danger";

export interface AuditEvent {
  id: string;
  timestamp: string; // ISO timestamp
  userId: string;
  userName: string;
  companyId: string | null; // null = organization-wide
  companyCode?: string | null;
  entity: AuditEntity;
  description: string;
  severity: AuditSeverity;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

// 30+ entries spanning all action types, users, companies, severities,
// spread across the last ~60 days.
export const AUDIT_LOG: AuditEvent[] = [
  { id: "a1",  timestamp: "2026-05-29T15:42:00", userId: "u1", userName: "Younes O.", companyId: "occ",   companyCode: "OCC",   entity: "ad_safety",  description: "Increased \"January Detox\" daily budget EUR 60 → EUR 80", severity: "info",    before: { daily_budget: 60 }, after: { daily_budget: 80 }, ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a2",  timestamp: "2026-05-29T11:08:00", userId: "u2", userName: "Sarah M.",  companyId: "occ",   companyCode: "OCC",   entity: "post",       description: "Created post \"Hydration wellness tip\"",                    severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a3",  timestamp: "2026-05-28T22:17:00", userId: "system", userName: "System",companyId: "occ",   companyCode: "OCC",   entity: "ad_safety",  description: "Anomaly auto-paused \"Wellness Webinar\" — spend exceeded 7-day avg by 73%", severity: "warning", before: { status: "active" }, after: { status: "paused" }, ipAddress: "—", userAgent: "system/cron" },
  { id: "a4",  timestamp: "2026-05-28T14:40:00", userId: "u1", userName: "Younes O.", companyId: null,    companyCode: null,    entity: "team",       description: "Invited marcus@external.com as Editor",                       severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a5",  timestamp: "2026-05-28T09:14:00", userId: "u1", userName: "Younes O.", companyId: "tibok", companyCode: "TI",    entity: "settings",   description: "Refreshed Meta connection for Tibok",                          severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a6",  timestamp: "2026-05-27T17:02:00", userId: "u2", userName: "Sarah M.",  companyId: "occ",   companyCode: "OCC",   entity: "campaign",   description: "Created campaign \"Wellness Webinar — Awareness\"",            severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a7",  timestamp: "2026-05-27T12:30:00", userId: "u1", userName: "Younes O.", companyId: "occ",   companyCode: "OCC",   entity: "audience",   description: "Created audience \"Lookalike — OCC patients (1%)\"",         severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a8",  timestamp: "2026-05-26T16:08:00", userId: "u1", userName: "Younes O.", companyId: null,    companyCode: null,    entity: "settings",   description: "Connected Meta Business Manager (OCC Holdings)",              severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a9",  timestamp: "2026-05-26T09:00:00", userId: "u2", userName: "Sarah M.",  companyId: "occ",   companyCode: "OCC",   entity: "post",       description: "Published post \"Patient testimonial — Sarah\"",              severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a10", timestamp: "2026-05-25T13:55:00", userId: "u1", userName: "Younes O.", companyId: "tibok", companyCode: "TI",    entity: "ad_safety",  description: "Lowered monthly cap EUR 5,000 → EUR 4,000",                   severity: "warning", before: { monthly_cap: 5000 }, after: { monthly_cap: 4000 }, ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a11", timestamp: "2026-05-25T10:12:00", userId: "u2", userName: "Sarah M.",  companyId: "tibok", companyCode: "TI",    entity: "post",       description: "Created draft \"How online prescriptions work\"",             severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a12", timestamp: "2026-05-24T19:22:00", userId: "system", userName: "System",companyId: "occ",   companyCode: "OCC",   entity: "post",       description: "Failed to publish to Instagram — invalid image dimensions",    severity: "danger",  after: { error: "OAuthException — aspect ratio 2.1:1 invalid" }, ipAddress: "—", userAgent: "system/publisher" },
  { id: "a13", timestamp: "2026-05-24T14:00:00", userId: "u3", userName: "Priya R.",  companyId: "occ",   companyCode: "OCC",   entity: "post",       description: "Viewed analytics for \"January Detox\"",                     severity: "info",                                                                                ipAddress: "196.192.40.21", userAgent: "Mozilla/5.0 (iPhone)" },
  { id: "a14", timestamp: "2026-05-23T11:48:00", userId: "u1", userName: "Younes O.", companyId: "cvmi",  companyCode: "CV",    entity: "campaign",   description: "Created campaign \"International Patients — Awareness\"",      severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a15", timestamp: "2026-05-22T16:35:00", userId: "u2", userName: "Sarah M.",  companyId: "occ",   companyCode: "OCC",   entity: "audience",   description: "Uploaded custom audience \"OCC past patients\" (1,500 rows)",  severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a16", timestamp: "2026-05-21T20:14:00", userId: "u1", userName: "Younes O.", companyId: "occ",   companyCode: "OCC",   entity: "campaign",   description: "Paused campaign \"App Installs — Mobile\"",                  severity: "info",  before: { status: "active" }, after: { status: "paused" }, ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a17", timestamp: "2026-05-21T09:30:00", userId: "u1", userName: "Younes O.", companyId: null,    companyCode: null,    entity: "settings",   description: "Updated organization name \"DDS Holdings\" → \"DDS Group\"",  severity: "info",  before: { name: "DDS Holdings" }, after: { name: "DDS Group" }, ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a18", timestamp: "2026-05-20T15:18:00", userId: "u3", userName: "Priya R.",  companyId: "tibok", companyCode: "TI",    entity: "audience",   description: "Viewed audience \"Lookalike — Tibok app users (2%)\"",        severity: "info",                                                                                ipAddress: "196.192.40.21", userAgent: "Mozilla/5.0 (iPhone)" },
  { id: "a19", timestamp: "2026-05-19T11:00:00", userId: "u2", userName: "Sarah M.",  companyId: "occ",   companyCode: "OCC",   entity: "ad_safety",  description: "Enabled \"Confirm spend before AI actions\"",                  severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a20", timestamp: "2026-05-18T17:42:00", userId: "u1", userName: "Younes O.", companyId: "occ",   companyCode: "OCC",   entity: "campaign",   description: "Paused automation \"OCC Facebook — patient testimonials\"",   severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a21", timestamp: "2026-05-17T13:25:00", userId: "u1", userName: "Younes O.", companyId: null,    companyCode: null,    entity: "team",       description: "Changed Priya R. role: Editor → Viewer",                       severity: "info",  before: { role: "editor" }, after: { role: "viewer" }, ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a22", timestamp: "2026-05-16T08:50:00", userId: "system", userName: "System",companyId: "tibok", companyCode: "TI",    entity: "post",       description: "Auto-published \"5 signs you should see a GP\"",              severity: "info",                                                                                ipAddress: "—", userAgent: "system/publisher" },
  { id: "a23", timestamp: "2026-05-15T22:03:00", userId: "system", userName: "System",companyId: "cvmi",  companyCode: "CV",    entity: "ad_safety",  description: "Daily digest sent — no anomalies",                             severity: "info",                                                                                ipAddress: "—", userAgent: "system/cron" },
  { id: "a24", timestamp: "2026-05-14T16:11:00", userId: "u2", userName: "Sarah M.",  companyId: "occ",   companyCode: "OCC",   entity: "post",       description: "Edited scheduled post \"Hydration wellness tip\"",            severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a25", timestamp: "2026-05-13T10:34:00", userId: "u1", userName: "Younes O.", companyId: "occ",   companyCode: "OCC",   entity: "ad_safety",  description: "Increased double-confirm threshold EUR 300 → EUR 500",         severity: "info",  before: { threshold: 300 }, after: { threshold: 500 }, ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a26", timestamp: "2026-05-12T14:52:00", userId: "u1", userName: "Younes O.", companyId: "occ",   companyCode: "OCC",   entity: "audience",   description: "Created saved audience \"Women 35-55 Mauritius — Wellness\"",  severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a27", timestamp: "2026-05-11T09:18:00", userId: "u1", userName: "Younes O.", companyId: "tibok", companyCode: "TI",    entity: "settings",   description: "Connected Meta Business Manager (Tibok Holdings)",            severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a28", timestamp: "2026-05-10T19:46:00", userId: "system", userName: "System",companyId: "tibok", companyCode: "TI",    entity: "post",       description: "Failed to publish — Tibok IG token expired",                  severity: "danger",                                                                              ipAddress: "—", userAgent: "system/publisher" },
  { id: "a29", timestamp: "2026-05-09T15:02:00", userId: "u2", userName: "Sarah M.",  companyId: "occ",   companyCode: "OCC",   entity: "post",       description: "Deleted draft \"Old Q&A reminder\"",                          severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a30", timestamp: "2026-05-08T11:25:00", userId: "u1", userName: "Younes O.", companyId: null,    companyCode: null,    entity: "team",       description: "Invited sarah@ddsgroup.mu as Editor",                          severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a31", timestamp: "2026-05-06T08:48:00", userId: "u1", userName: "Younes O.", companyId: "cvmi",  companyCode: "CV",    entity: "audience",   description: "Created saved audience \"Medical travel — West Africa\"",      severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a32", timestamp: "2026-05-04T13:09:00", userId: "u2", userName: "Sarah M.",  companyId: "tibok", companyCode: "TI",    entity: "campaign",   description: "Created campaign \"Telehealth Launch — Traffic\"",            severity: "info",                                                                                ipAddress: "196.192.40.18", userAgent: "Mozilla/5.0 (Windows)" },
  { id: "a33", timestamp: "2026-05-02T16:30:00", userId: "u1", userName: "Younes O.", companyId: null,    companyCode: null,    entity: "settings",   description: "Updated AI image cap EUR 20 → EUR 25",                         severity: "info",  before: { image_cap: 20 }, after: { image_cap: 25 }, ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a34", timestamp: "2026-05-01T09:42:00", userId: "u1", userName: "Younes O.", companyId: "tibok", companyCode: "TI",    entity: "settings",   description: "Connected Meta Business Manager (Tibok Holdings)",            severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
  { id: "a35", timestamp: "2026-04-28T13:58:00", userId: "u1", userName: "Younes O.", companyId: "occ",   companyCode: "OCC",   entity: "audience",   description: "Uploaded custom audience \"OCC past patients\"",              severity: "info",                                                                                ipAddress: "196.192.40.12", userAgent: "Mozilla/5.0 (Macintosh)" },
];
