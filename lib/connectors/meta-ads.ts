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

async function graphGet(path: string, fields: string, token: string): Promise<Record<string, unknown>> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}/${path}${sep}fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as Record<string, unknown>;
  if (json && (json as { error?: { message?: string } }).error) {
    throw new Error((json as { error: { message?: string } }).error.message || "Erreur Marketing API");
  }
  return json;
}

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

/** Champs proposés dans un formulaire de prospects (Instant Form). */
export type LeadFieldType = "FULL_NAME" | "EMAIL" | "PHONE" | "CITY" | "JOB_TITLE";

export interface LeadFormSpec {
  formName: string;
  privacyUrl: string;            // URL de politique de confidentialité (obligatoire Meta)
  privacyLinkText?: string;
  intro?: string;                // titre d'accroche du formulaire
  fields: LeadFieldType[];       // questions (au moins EMAIL recommandé)
  thankYouTitle?: string;
  thankYouBody?: string;
  locale?: string;               // ex "fr_FR"
}

export interface PublishAdInput {
  companyId: string;
  name: string;
  objective: string;          // notoriété | trafic | engagement | leads/prospects | ventes
  dailyBudgetCents: number;    // budget quotidien en centimes (si budgetType=daily)
  /** "daily" (défaut) ou "lifetime" (budget total, exige endTime). */
  budgetType?: "daily" | "lifetime";
  lifetimeBudgetCents?: number;
  startTime?: string;          // ISO — début de diffusion (défaut : +1h)
  endTime?: string;            // ISO — fin (obligatoire si budget à vie)
  countries: string[];         // ex ["FR","MU"]
  ageMin?: number;
  ageMax?: number;
  gender?: "all" | "male" | "female";
  /** Centres d'intérêt Meta (ids issus de la recherche adinterest). */
  interests?: { id: string; name: string }[];
  /** "auto" (Advantage+) ou "manual" (placements choisis). */
  placement?: "auto" | "manual";
  publisherPlatforms?: string[];   // ["facebook","instagram"]
  facebookPositions?: string[];    // ["feed","story"]
  instagramPositions?: string[];   // ["stream","story","reels"]
  imageUrl: string;            // visuel principal
  /** Visuels supplémentaires → carrousel (2 à 10 cartes au total avec imageUrl). */
  images?: string[];
  primaryText: string;         // texte principal
  headline?: string;
  link: string;                // URL de destination
  cta?: string;                // type CTA Meta (LEARN_MORE, SHOP_NOW, SIGN_UP, CONTACT_US…)
  /** Si fourni (objectif Prospects) : crée un formulaire instantané et une pub lead. */
  leadForm?: LeadFormSpec;
}

export interface PublishAdResult {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  leadFormId?: string;
  status: "PAUSED";
}

/** Crée un formulaire de prospects (Instant Form) sur la Page et renvoie son id. */
async function createLeadForm(pageId: string, pageToken: string, spec: LeadFormSpec): Promise<string> {
  const fields = (spec.fields?.length ? spec.fields : ["FULL_NAME", "EMAIL", "PHONE"]) as LeadFieldType[];
  const questions = fields.map((t) => ({ type: t }));
  const params: Params = {
    name: spec.formName || "Formulaire de prospects",
    locale: spec.locale || "fr_FR",
    questions,
    privacy_policy: { url: spec.privacyUrl, link_text: spec.privacyLinkText || "Politique de confidentialité" },
    follow_up_action_text: "Merci !",
  };
  if (spec.intro) {
    params.context_card = { title: spec.intro, style: "PARAGRAPH_STYLE" };
  }
  if (spec.thankYouTitle || spec.thankYouBody) {
    params.thank_you_page = {
      title: spec.thankYouTitle || "Merci !",
      body: spec.thankYouBody || "Nous vous recontactons rapidement.",
      button_type: "VIEW_WEBSITE",
    };
  }
  const res = await graphPost(`${pageId}/leadgen_forms`, params, pageToken);
  if (!res.id) throw new Error("Échec de création du formulaire de prospects.");
  return String(res.id);
}

/** Crée la pub complète EN PAUSE (aucune diffusion tant que non activée). */
export async function publishAd(input: PublishAdInput): Promise<PublishAdResult> {
  const ctx = await getMetaContext(input.companyId);
  if (!ctx.userToken) throw new Error("Meta non connecté pour cette société.");
  if (!ctx.adAccountId) throw new Error("Aucun compte publicitaire configuré (Meta Ads).");
  if (!ctx.pageId) throw new Error("Aucune Page Facebook sélectionnée.");
  const token = ctx.userToken;
  const act = `act_${ctx.adAccountId}`;

  const isLifetime = input.budgetType === "lifetime";
  const budget = Math.max(100, Math.round((isLifetime ? input.lifetimeBudgetCents : input.dailyBudgetCents) || 0));
  if (!isLifetime && budget > MAX_DAILY_BUDGET_CENTS) {
    throw new Error(`Budget quotidien trop élevé (max ${(MAX_DAILY_BUDGET_CENTS / 100).toFixed(0)} €/j).`);
  }
  if (isLifetime && !input.endTime) {
    throw new Error("Une date de fin est requise pour un budget à vie.");
  }

  const { objective, optimization, cta } = mapObjective(input.objective);

  // Mode « formulaire de prospects » (Lead Ads / Instant Form) si demandé.
  const isLead = Boolean(input.leadForm) && input.leadForm!.privacyUrl?.trim();
  let leadFormId: string | undefined;
  if (isLead) {
    if (!ctx.pageToken) throw new Error("Token de Page requis pour créer un formulaire de prospects.");
    leadFormId = await createLeadForm(ctx.pageId, ctx.pageToken, input.leadForm!);
  }

  // 1) Campagne (PAUSE)
  const campaign = await graphPost(`${act}/campaigns`, {
    name: `${input.name} — Campagne`,
    objective: isLead ? "OUTCOME_LEADS" : objective,
    status: "PAUSED",
    special_ad_categories: [],
  }, token);
  const campaignId = String(campaign.id);

  // 2) Ciblage : géo + âge + genre + centres d'intérêt + placements.
  const targeting: Params = {
    geo_locations: { countries: input.countries.length ? input.countries : ["FR"] },
    age_min: input.ageMin ?? 18,
    age_max: input.ageMax ?? 65,
  };
  if (input.gender === "male") targeting.genders = [1];
  else if (input.gender === "female") targeting.genders = [2];
  if (input.interests?.length) {
    targeting.flexible_spec = [{ interests: input.interests.map((i) => ({ id: i.id, name: i.name })) }];
  }
  if (input.placement === "manual") {
    if (input.publisherPlatforms?.length) targeting.publisher_platforms = input.publisherPlatforms;
    if (input.facebookPositions?.length) targeting.facebook_positions = input.facebookPositions;
    if (input.instagramPositions?.length) targeting.instagram_positions = input.instagramPositions;
  }

  // Budget + calendrier.
  const startTime = input.startTime || new Date(Date.now() + 3600_000).toISOString();
  const adsetParams: Params = {
    name: `${input.name} — Ad set`,
    campaign_id: campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: isLead ? "LEAD_GENERATION" : optimization,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    status: "PAUSED",
    start_time: startTime,
    ...(isLead ? { promoted_object: { page_id: ctx.pageId } } : {}),
  };
  if (isLifetime) {
    adsetParams.lifetime_budget = budget;
    adsetParams.end_time = input.endTime;
  } else {
    adsetParams.daily_budget = budget;
    if (input.endTime) adsetParams.end_time = input.endTime;
  }
  const adset = await graphPost(`${act}/adsets`, adsetParams, token);
  const adSetId = String(adset.id);

  // 3) Créative : image unique OU carrousel (≥ 2 visuels). En mode lead, le CTA
  //    ouvre le formulaire instantané ; sinon il pointe vers le lien.
  const callToAction = isLead
    ? { type: "SIGN_UP", value: { lead_gen_form_id: leadFormId } }
    : { type: input.cta || cta, value: { link: input.link } };
  const allImages = [input.imageUrl, ...(input.images ?? [])].filter(Boolean);
  const isCarousel = !isLead && allImages.length > 1;
  const linkData: Params = isCarousel
    ? {
        message: input.primaryText,
        link: input.link,
        child_attachments: allImages.slice(0, 10).map((pic) => ({
          link: input.link,
          picture: pic,
          name: input.headline || input.name,
          call_to_action: callToAction,
        })),
        multi_share_optimized: true,
        multi_share_end_card: false,
      }
    : {
        message: input.primaryText,
        link: input.link,
        name: input.headline || input.name,
        picture: input.imageUrl,
        call_to_action: callToAction,
      };
  const creative = await graphPost(`${act}/adcreatives`, {
    name: `${input.name} — Créative`,
    object_story_spec: { page_id: ctx.pageId, link_data: linkData },
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

  return { campaignId, adSetId, creativeId, adId, leadFormId, status: "PAUSED" };
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

  // ── Re-validation d'appartenance AVANT activation ───────────────────────────
  // Sécurité : on ne fait confiance ni au client ni aux IDs fournis. Avant de
  // passer une pub en diffusion (live=true), on vérifie côté serveur que l'ad set
  // appartient bien au compte publicitaire de la société (account_id == ad_account_id
  // du contexte). Sinon on refuse — empêche d'activer/payer sur un compte tiers.
  // (La mise en PAUSE n'est jamais risquée → pas de blocage sur live=false.)
  if (live) {
    if (!ctx.adAccountId) {
      throw new Error("Aucun compte publicitaire configuré (Meta Ads) : activation refusée.");
    }
    const expected = String(ctx.adAccountId).replace(/^act_/, "");
    let adset: Record<string, unknown>;
    try {
      adset = await graphGet(ids.adSetId, "account_id,campaign_id", token);
    } catch (err) {
      throw new Error(
        `Vérification d'appartenance de la pub impossible (ad set introuvable) : ${(err as Error).message}`
      );
    }
    const adsetAccount = String(adset.account_id ?? "").replace(/^act_/, "");
    if (!adsetAccount || adsetAccount !== expected) {
      throw new Error(
        "Activation refusée : cette publicité n'appartient pas au compte publicitaire de la société."
      );
    }
    // Cohérence : l'ad set doit bien appartenir à la campagne fournie.
    const adsetCampaign = String(adset.campaign_id ?? "");
    if (ids.campaignId && adsetCampaign && adsetCampaign !== String(ids.campaignId)) {
      throw new Error(
        "Activation refusée : l'ad set ne correspond pas à la campagne indiquée."
      );
    }
    // NB : le plafond de budget quotidien (MAX_DAILY_BUDGET_CENTS) est appliqué à
    // la création (publishAd). L'ad set existant a donc déjà été plafonné.
  }

  // Ordre : campagne → ad set → ad (tout doit être ACTIVE pour diffuser).
  await graphPost(ids.campaignId, { status }, token);
  await graphPost(ids.adSetId, { status }, token);
  await graphPost(ids.adId, { status }, token);
}
