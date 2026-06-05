// Types DB (snake_case) reflétant le schéma Supabase.
// Utilisés uniquement dans les repositories pour le mapping snake_case ↔ camelCase.
// NE PAS importer ces types dans les composants — utiliser lib/types.ts.

export interface DbOrganization {
  id: string;
  name: string;
  created_at: string;
}

export interface DbCompany {
  id: string;
  org_id: string;
  code: string;
  name: string;
  brand_voice: string | null;
  accent: string | null;
  logo_url: string | null;
  default_platforms: string[] | null;
  default_posting_time: string | null;
  default_needs_review: boolean | null;
  created_at: string;
}

export interface DbScheduledPost {
  id: string;
  company_id: string;
  platform: string;
  title: string;
  body: string | null;
  date: string | null;
  time: string | null;
  source: string;
  status: string;
  needs_review: boolean | null;
  automation_name: string | null;
  media: { kind: "image" | "video" } | null;
  published_at: string | null;
  external_id: string | null;
  created_at: string;
}

export interface DbCampaign {
  id: string;
  company_id: string;
  name: string;
  objective: string | null;
  platforms: string[] | null;
  status: string;
  enabled: boolean;
  spend: number | null;
  budget: number | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_date: string | null;
  end_date: string | null;
  metrics: Record<string, unknown> | null;
  meta_campaign_id: string | null;
  created_at: string;
}

export interface DbAudience {
  id: string;
  company_id: string;
  type: string;
  name: string;
  description: string | null;
  detail: string | null;
  reach: string | null;
  in_use: number | null;
  config: Record<string, unknown> | null;
  meta_audience_id: string | null;
  created_by: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface DbAdSet {
  id: string;
  campaign_id: string;
  name: string;
  placement: string | null;
  targeting: string | null;
  audience_id: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  budget_type: string | null;
  optimization_goal: string | null;
  status: string | null;
  enabled: boolean | null;
  start_date: string | null;
  end_date: string | null;
  metrics: Record<string, unknown> | null;
  meta_ad_set_id: string | null;
  created_at: string;
}
