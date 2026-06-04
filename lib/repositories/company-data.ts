// Agrégateur de données société : lit les tables sh_* réelles et reconstruit
// l'objet CompanyData consommé par toutes les pages (dashboard, historique,
// programmés, campagnes, audiences, bibliothèque…). Démarrage propre garanti :
// on part de makeEmptyCompanyData() et on remplit ce qui existe en base.
//
// Ne throw jamais : toute erreur → on garde les valeurs par défaut (vides).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { makeEmptyCompanyData } from "@/lib/mock-data";
import type {
  CompanyData,
  Campaign,
  ScheduledPost,
  HistoryItem,
  Automation,
  Audience,
  Template,
  SocialAccount,
  Platform,
} from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
const s = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const n = (v: unknown, d = 0): number => (v == null ? d : Number(v) || d);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const plat = (v: unknown): Platform => {
  const p = s(v);
  return (["facebook", "instagram", "linkedin", "tiktok"].includes(p) ? p : "facebook") as Platform;
};

function frDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapCampaign(r: Row): Campaign {
  return {
    id: s(r.id),
    name: s(r.name),
    objective: s(r.objective),
    platforms: (arr(r.platforms) as Campaign["platforms"]),
    status: (s(r.status, "paused") as Campaign["status"]),
    enabled: Boolean(r.enabled),
    spend: n(r.spend),
    budget: n(r.budget),
    metricsLabel: "",
    metricsValue: "",
    dailyBudget: r.daily_budget != null ? n(r.daily_budget) : undefined,
    lifetimeBudget: r.lifetime_budget != null ? n(r.lifetime_budget) : undefined,
    startDate: s(r.start_date) || undefined,
    endDate: s(r.end_date) || null,
    adSets: [],
  };
}

function mapScheduled(r: Row): ScheduledPost {
  const media = r.media as { kind?: "image" | "video" } | null;
  return {
    id: s(r.id),
    platform: plat(r.platform),
    title: s(r.title),
    date: s(r.date),
    time: s(r.time),
    source: (s(r.source, "manual") as ScheduledPost["source"]),
    needsReview: Boolean(r.needs_review),
    status: (s(r.status, "scheduled") as ScheduledPost["status"]),
    body: s(r.body) || undefined,
    automationName: s(r.automation_name) || undefined,
    media: media?.kind ? { kind: media.kind } : undefined,
    publishedAt: s(r.published_at) || undefined,
  };
}

function mapHistory(r: Row): HistoryItem {
  const media = r.media as { kind?: "image" | "video" } | null;
  const metrics = r.metrics as HistoryItem["metrics"] | null;
  const error = r.error as HistoryItem["error"] | null;
  const publishedAt = s(r.published_at) || undefined;
  const scheduledAt = s(r.scheduled_at) || undefined;
  return {
    id: s(r.id),
    platform: plat(r.platform),
    body: s(r.body),
    fullBody: s(r.full_body) || undefined,
    when: frDate((publishedAt ?? scheduledAt ?? s(r.created_at)) || null),
    source: s(r.source, "manual"),
    scheduledAt,
    publishedAt,
    automationName: s(r.automation_name) || undefined,
    status: (s(r.status, "published") as HistoryItem["status"]),
    metrics: metrics ?? undefined,
    externalUrl: s(r.external_url) || undefined,
    media: media?.kind ? { kind: media.kind } : undefined,
    error: error ?? undefined,
  };
}

function mapAutomation(r: Row): Automation {
  return {
    id: s(r.id),
    name: s(r.name),
    account: "",
    socialAccountId: s(r.social_account_id),
    platform: plat(r.platform),
    days: arr<Automation["days"][number]>(r.days),
    time: s(r.time),
    libraryName: s(r.library_name),
    tagFilter: arr<string>(r.tag_filter),
    onEmpty: (s(r.on_empty, "skip") as Automation["onEmpty"]),
    schedule: "",
    status: (s(r.status, "active") as Automation["status"]),
    libraryNote: "",
    enabled: Boolean(r.enabled),
  };
}

function mapAudience(r: Row): Audience {
  return {
    id: s(r.id),
    type: (s(r.type, "saved") as Audience["type"]),
    name: s(r.name),
    description: s(r.description),
    detail: s(r.detail),
    reach: s(r.reach, "—"),
    created: frDate(s(r.created_at) || null),
    inUse: n(r.in_use),
    config: (r.config as Audience["config"]) ?? undefined,
    metaAudienceId: s(r.meta_audience_id) || undefined,
    createdAt: s(r.created_at) || undefined,
    createdBy: s(r.created_by) || undefined,
  };
}

function mapTemplate(r: Row): Template {
  return {
    id: s(r.id),
    platform: plat(r.platform),
    tags: arr<string>(r.tags),
    body: s(r.body),
    status: (s(r.status, "ready") as Template["status"]),
    addedDate: s(r.added_date),
    media: (r.media as Template["media"]) ?? { kind: "none" },
  };
}

function mapAccount(r: Row): SocialAccount {
  return {
    id: s(r.id),
    platform: plat(r.platform),
    accountName: s(r.account_name),
    status: (s(r.status, "active") as SocialAccount["status"]),
  };
}

// ── Agrégateur principal ───────────────────────────────────────────────────────

export async function getCompanyData(companyId: string): Promise<CompanyData> {
  const data = makeEmptyCompanyData();
  if (!isSupabaseConfigured) return data;

  const supabase = createClient();
  if (!supabase) return data;

  try {
    const uuid = await resolveCompanyUuid(companyId);

    const [campaignsR, scheduledR, historyR, automationsR, audiencesR, accountsR, templatesR] =
      await Promise.all([
        supabase.from("sh_campaigns").select("*").eq("company_id", uuid).order("created_at", { ascending: false }),
        supabase.from("sh_scheduled_posts").select("*").eq("company_id", uuid).order("date", { ascending: true }),
        supabase.from("sh_history_items").select("*").eq("company_id", uuid).order("created_at", { ascending: false }),
        supabase.from("sh_automations").select("*").eq("company_id", uuid),
        supabase.from("sh_audiences").select("*").eq("company_id", uuid),
        supabase.from("sh_social_accounts").select("id,platform,account_name,status").eq("company_id", uuid),
        supabase.from("sh_templates").select("*").eq("company_id", uuid),
      ]);

    const campaigns = arr<Row>(campaignsR.data).map(mapCampaign);
    const scheduled = arr<Row>(scheduledR.data).map(mapScheduled);
    const history = arr<Row>(historyR.data).map(mapHistory);
    const automations = arr<Row>(automationsR.data).map(mapAutomation);
    const audiences = arr<Row>(audiencesR.data).map(mapAudience);
    const accounts = arr<Row>(accountsR.data).map(mapAccount);
    const templates = arr<Row>(templatesR.data).map(mapTemplate);

    // ── Agrégats dashboard ──────────────────────────────────────────────
    const now = Date.now();
    const within7d = (iso?: string) =>
      iso ? now - new Date(iso).getTime() <= 7 * 24 * 3600 * 1000 : false;

    const published7d = history.filter(
      (h) => h.status === "published" && within7d(h.publishedAt)
    ).length;
    const failed = history.filter((h) => h.status === "failed").length;
    const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
    const spendMtd = campaigns.reduce((acc, c) => acc + c.spend, 0);

    data.accounts = accounts;
    data.scheduled = scheduled;
    data.history = history;
    data.automations = {
      active: automations.filter((a) => a.status === "active" && a.enabled).length,
      paused: automations.filter((a) => a.status === "paused" || !a.enabled).length,
      postsThisWeek: published7d,
      rules: automations,
    };
    data.campaigns = {
      activeCampaigns,
      spendMtd,
      conversions: 0,
      avgCpc: 0,
      list: campaigns,
    };
    data.audiences = {
      total: audiences.length,
      inUse: audiences.filter((a) => a.inUse > 0).length,
      combinedReach: data.audiences.combinedReach,
      list: audiences,
    };
    data.library = {
      ...data.library,
      unused: templates.length,
      templates,
    };

    data.dashboard = {
      ...data.dashboard,
      organic: {
        scheduled: scheduled.filter((p) => p.status !== "published").length,
        published7d,
        inLibrary: templates.length,
        failed,
      },
      paid: {
        ...data.dashboard.paid,
        activeCampaigns,
        spendMtd,
      },
      upcomingPosts: scheduled
        .filter((p) => p.status !== "published")
        .slice(0, 5)
        .map((p) => ({ platform: p.platform, title: p.title, when: `${p.date} ${p.time}`.trim() })),
    };

    return data;
  } catch (err) {
    console.error("[company-data] getCompanyData error:", err);
    return data;
  }
}
