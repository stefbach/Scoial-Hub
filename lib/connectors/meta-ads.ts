// Publication directe de publicités Meta (Marketing API).
// Chaîne complète : Campagne → Ad Set (budget/ciblage/géo) → Créative → Ad.
// SÉCURITÉ : tout est créé en PAUSE (aucune dépense). L'activation est une
// action explicite séparée, plafonnée par un budget max.

import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";
const BASE = `https://graph.facebook.com/${V}`;

// Plafond de sécurité du budget quotidien (centimes). Au-delà → refus.
const MAX_DAILY_BUDGET_CENTS = Number(process.env.META_ADS_MAX_DAILY_CENTS ?? 5000_00); // 5000 €/j

type Params = Record<string, unknown>;

async function graphPost(path: string, params: Params, token: string): Promise<Record<string, unknown>> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  form.set("access_token", token);
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (json && (json as { error?: { message?: string } }).error) {
    throw new Error((json as { error: { message?: string } }).error.message || "Erreur Marketing API");
  }
  return json;
}

// ── Mapping objectif → (objective ODAX, optimization_goal) ────────────────────
function mapObjective(o: string): { objective: string; optimization: string; cta: string } {
  const k = (o || "").toLowerCase();
  if (k.includes("aware") || k.includes("notor")) return { objective: "OUTCOME_AWARENESS", optimization: "REACH", cta: "LEARN_MORE" };
  if (k.includes("engag") || k.includes("communaut")) return { objective: "OUTCOME_ENGAGEMENT", optimization: "POST_ENGAGEMENT", cta: "LEARN_MORE" };
  // trafic / leads / ventes → trafic vers le site (robuste, sans pixel ni formulaire)
  return { objective: "OUTCOME_TRAFFIC", optimization: "LINK_CLICKS", cta: "LEARN_MORE" };
}

export interface PublishAdInput {
  companyId: string;
  name: string;
  objective: string;          // notoriété | trafic | leads | ventes | engagement
  dailyBudgetCents: number;    // budget quotidien en centimes
  countries: string[];         // ex ["FR","MU"]
  ageMin?: number;
  ageMax?: number;
  imageUrl: string;            // visuel (Studio / bibliothèque)
  primaryText: string;         // texte principal
  headline?: string;
  link: string;                // URL de destination
  cta?: string;                // type CTA Meta (LEARN_MORE, SHOP_NOW, SIGN_UP, CONTACT_US…)
}

export interface PublishAdResult {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  status: "PAUSED";
}

/** Crée la pub complète EN PAUSE (aucune diffusion tant que non activée). */
export async function publishAd(input: PublishAdInput): Promise<PublishAdResult> {
  const ctx = await getMetaContext(input.companyId);
  if (!ctx.userToken) throw new Error("Meta non connecté pour cette société.");
  if (!ctx.adAccountId) throw new Error("Aucun compte publicitaire configuré (Meta Ads).");
  if (!ctx.pageId) throw new Error("Aucune Page Facebook sélectionnée.");
  const token = ctx.userToken;
  const act = `act_${ctx.adAccountId}`;

  const budget = Math.max(100, Math.round(input.dailyBudgetCents || 0));
  if (budget > MAX_DAILY_BUDGET_CENTS) {
    throw new Error(`Budget quotidien trop élevé (max ${(MAX_DAILY_BUDGET_CENTS / 100).toFixed(0)} €/j).`);
  }

  const { objective, optimization, cta } = mapObjective(input.objective);

  // 1) Campagne (PAUSE)
  const campaign = await graphPost(`${act}/campaigns`, {
    name: `${input.name} — Campagne`,
    objective,
    status: "PAUSED",
    special_ad_categories: [],
  }, token);
  const campaignId = String(campaign.id);

  // 2) Ad Set (budget + ciblage + géo, PAUSE)
  const targeting = {
    geo_locations: { countries: input.countries.length ? input.countries : ["FR"] },
    age_min: input.ageMin ?? 18,
    age_max: input.ageMax ?? 65,
  };
  const adset = await graphPost(`${act}/adsets`, {
    name: `${input.name} — Ad set`,
    campaign_id: campaignId,
    daily_budget: budget,
    billing_event: "IMPRESSIONS",
    optimization_goal: optimization,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    status: "PAUSED",
    start_time: new Date(Date.now() + 3600_000).toISOString(),
  }, token);
  const adSetId = String(adset.id);

  // 3) Créative (image + texte + lien + CTA) liée à la Page
  const creative = await graphPost(`${act}/adcreatives`, {
    name: `${input.name} — Créative`,
    object_story_spec: {
      page_id: ctx.pageId,
      link_data: {
        message: input.primaryText,
        link: input.link,
        name: input.headline || input.name,
        picture: input.imageUrl,
        call_to_action: { type: input.cta || cta, value: { link: input.link } },
      },
    },
  }, token);
  const creativeId = String(creative.id);

  // 4) Ad (PAUSE)
  const ad = await graphPost(`${act}/ads`, {
    name: `${input.name} — Annonce`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  }, token);
  const adId = String(ad.id);

  return { campaignId, adSetId, creativeId, adId, status: "PAUSED" };
}

/** Active (diffuse) ou met en pause une pub déjà créée. */
export async function setAdLive(
  companyId: string,
  ids: { campaignId: string; adSetId: string; adId: string },
  live: boolean
): Promise<void> {
  const ctx = await getMetaContext(companyId);
  if (!ctx.userToken) throw new Error("Meta non connecté.");
  const token = ctx.userToken;
  const status = live ? "ACTIVE" : "PAUSED";
  // Ordre : campagne → ad set → ad (tout doit être ACTIVE pour diffuser).
  await graphPost(ids.campaignId, { status }, token);
  await graphPost(ids.adSetId, { status }, token);
  await graphPost(ids.adId, { status }, token);
}
