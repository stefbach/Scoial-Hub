/**
 * lib/connectors/linkedin.ts
 *
 * Connecteur LinkedIn : publication organique via l'API UGC Posts / Posts,
 * métriques via l'API Share Statistics, et ébauche LinkedIn Marketing API.
 *
 * Endpoints utilisés :
 *   - OAuth 2.0 : https://www.linkedin.com/oauth/v2/authorization
 *   - REST v2 :   https://api.linkedin.com/v2
 *   - REST /rest : https://api.linkedin.com/rest  (nouveaux endpoints)
 *
 * Dégradation gracieuse : si `isLinkedInConfigured` est false ou si un token
 * est manquant, toutes les méthodes retournent des valeurs simulées cohérentes
 * sans jamais appeler le réseau. Aucun appel réseau au chargement du module.
 */

import type { Platform } from "@/lib/types";
import type {
  SocialConnector,
  TokenSet,
  PublishInput,
  PublishResult,
  PostMetrics,
  CampaignInput,
} from "@/lib/connectors/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID ?? "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** True quand les app credentials LinkedIn sont présents. */
export const isLinkedInConfigured =
  Boolean(LINKEDIN_CLIENT_ID) && Boolean(LINKEDIN_CLIENT_SECRET);

/** URL de base des APIs LinkedIn. */
const LI_API_V2 = "https://api.linkedin.com/v2";
const LI_API_REST = "https://api.linkedin.com/rest";
const LI_OAUTH_BASE = "https://www.linkedin.com/oauth/v2";

/**
 * Scopes OAuth LinkedIn.
 *
 * - w_member_social         : publier des posts au nom d'un membre
 * - r_organization_social   : lire les posts / statistiques d'une organisation
 * - rw_organization_admin   : créer / gérer des posts d'organisation
 * - r_basicprofile          : lire le profil basique (id, nom)
 *
 * Note : `rw_organization_admin` et `r_organization_social` nécessitent
 * une app review LinkedIn (programme Marketing Developer Platform).
 */
// Scopes par défaut = ceux qui fonctionnent SANS revue LinkedIn (produits
// « Sign In with LinkedIn using OpenID Connect » + « Share on LinkedIn ») :
//   openid, profile, email, w_member_social (publier au nom du membre).
// Les scopes « organisation » (r_organization_social, rw_organization_admin)
// exigent l'approbation Community Management / Marketing Developer Platform —
// sinon LinkedIn renvoie `unauthorized_scope_error` et la connexion ÉCHOUE.
// On ne les demande donc QUE si LINKEDIN_ORG_SCOPES=true (app approuvée).
// Override total possible via LINKEDIN_SCOPES (liste séparée par des espaces).
const LINKEDIN_SCOPES =
  process.env.LINKEDIN_SCOPES?.trim() ||
  (process.env.LINKEDIN_ORG_SCOPES === "true"
    ? "openid profile email w_member_social r_organization_social w_organization_social rw_organization_admin"
    : "openid profile email w_member_social");

// ---------------------------------------------------------------------------
// Helpers réseau
// ---------------------------------------------------------------------------

/**
 * Effectue un appel à l'API LinkedIn et parse le JSON.
 * Lance une erreur si la réponse HTTP n'est pas 2xx.
 */
async function linkedinFetch<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "LinkedIn-Version": "202405", // version stable pour les nouveaux endpoints
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let errMsg = `LinkedIn API ${url} → HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { message?: string; serviceErrorCode?: number };
      if (errBody.message) errMsg += ` — ${errBody.message}`;
    } catch {
      // impossible de parser le corps d'erreur
    }
    throw new Error(errMsg);
  }

  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Valeurs simulées
// ---------------------------------------------------------------------------

/** Génère un identifiant simulé préfixé. */
function simulatedId(prefix: string): string {
  return `${prefix}_simulated_${Date.now()}`;
}

/** Retourne des métriques simulées cohérentes. */
function simulatedMetrics(): PostMetrics {
  return {
    reactions: Math.floor(Math.random() * 80) + 5,
    comments: Math.floor(Math.random() * 20) + 1,
    shares: Math.floor(Math.random() * 15),
    linkClicks: Math.floor(Math.random() * 40) + 3,
    reach: Math.floor(Math.random() * 1500) + 100,
    impressions: Math.floor(Math.random() * 4000) + 300,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// Connecteur LinkedIn
// ---------------------------------------------------------------------------

class LinkedInConnector implements SocialConnector {
  readonly platform: Platform = "linkedin";

  isConfigured(): boolean {
    return isLinkedInConfigured;
  }

  getAuthUrl(state: string): string {
    if (!isLinkedInConfigured) {
      // Mode simulé : URL factice pointant vers la page de comptes.
      return `${APP_URL}/accounts?simulated=true&platform=linkedin&state=${encodeURIComponent(state)}`;
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: LINKEDIN_CLIENT_ID,
      redirect_uri: `${APP_URL}/api/connectors/linkedin/callback`,
      state,
      scope: LINKEDIN_SCOPES,
    });

    return `${LI_OAUTH_BASE}/authorization?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    if (!isLinkedInConfigured) {
      // Simule un échange de code réussi.
      return {
        accessToken: `simulated_li_token_${Date.now()}`,
        expiresAt: Math.floor(Date.now() / 1000) + 5183944, // ~60 jours
        externalId: simulatedId("urn_li_person"),
        accountName: "Profil LinkedIn (simulé)",
        raw: { simulated: true },
      };
    }

    // Échange code → access_token via le endpoint token LinkedIn.
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${APP_URL}/api/connectors/linkedin/callback`,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    });

    const tokenData = await linkedinFetch<{
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
      scope: string;
    }>(`${LI_OAUTH_BASE}/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    // Récupère le profil de l'utilisateur (OpenID Connect userinfo).
    const profile = await linkedinFetch<{
      sub: string;
      name?: string;
      given_name?: string;
      family_name?: string;
    }>("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const accountName =
      profile.name ??
      [profile.given_name, profile.family_name].filter(Boolean).join(" ") ??
      "Profil LinkedIn";

    // L'identifiant LinkedIn est un URN : urn:li:person:{sub}
    const externalId = `urn:li:person:${profile.sub}`;

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt:
        tokenData.expires_in > 0
          ? Math.floor(Date.now() / 1000) + tokenData.expires_in
          : undefined,
      externalId,
      accountName,
      raw: tokenData as unknown as Record<string, unknown>,
    };
  }

  async publishPost(input: PublishInput): Promise<PublishResult> {
    if (
      !isLinkedInConfigured ||
      !input.accessToken ||
      input.accessToken.startsWith("simulated_")
    ) {
      const simId = simulatedId("li_post");
      return {
        externalId: simId,
        url: `https://www.linkedin.com/feed/update/${simId}/`,
        simulated: true,
      };
    }

    // Détermine si on publie en tant que membre ou organisation.
    // Convention : si externalAccountId commence par "urn:li:organization:",
    // on publie en tant qu'organisation ; sinon en tant que membre.
    const author = input.externalAccountId.startsWith("urn:li:organization:")
      ? input.externalAccountId
      : input.externalAccountId;

    // Construction du body pour l'API Posts (linkedin.com/rest/posts).
    const postBody: Record<string, unknown> = {
      author,
      commentary: input.text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    // Ajout d'un média image si fourni.
    if (input.media?.url) {
      // Pour un média, il faut d'abord enregistrer l'image via l'API Assets,
      // puis référencer l'asset URN. Ici on passe par un article (link) comme
      // alternative simplifiée si c'est une image externe.
      postBody.content = {
        article: {
          source: input.media.url,
          title: input.linkTitle ?? input.text.slice(0, 70),
          description: input.linkDescription ?? "",
          thumbnail: input.media.url,
        },
      };
    } else if (input.link) {
      postBody.content = {
        article: {
          source: input.link,
          title: input.linkTitle ?? "",
          description: input.linkDescription ?? "",
        },
      };
    }

    // Appel POST /rest/posts
    const res = await fetch(`${LI_API_REST}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.accessToken}`,
        "LinkedIn-Version": "202405",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postBody),
    });

    if (!res.ok) {
      let errMsg = `LinkedIn Posts API → HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as { message?: string };
        if (errBody.message) errMsg += ` — ${errBody.message}`;
      } catch {
        // corps d'erreur non parsable
      }
      throw new Error(errMsg);
    }

    // L'API renvoie l'URN du post dans le header x-restli-id.
    const postUrn = res.headers.get("x-restli-id") ?? simulatedId("li_post");
    // Encode pour l'URL (les ":" doivent être %3A).
    const encodedUrn = encodeURIComponent(postUrn);

    return {
      externalId: postUrn,
      url: `https://www.linkedin.com/feed/update/${encodedUrn}/`,
    };
  }

  async getMetrics(externalId: string): Promise<PostMetrics> {
    if (!isLinkedInConfigured || externalId.includes("simulated")) {
      return simulatedMetrics();
    }

    // API Share Statistics : GET /v2/socialActions/{shareUrn}
    // Note : le token d'accès doit avoir r_organization_social ou être l'auteur.
    // On ne dispose pas du token ici → on utilise des métriques simulées en
    // production sans token. En production, passer le token via un paramètre
    // enrichi ou depuis social_accounts.
    const encodedId = encodeURIComponent(externalId);

    try {
      const data = await linkedinFetch<{
        likesSummary?: { totalLikes: number };
        commentsSummary?: { totalFirstLevelComments: number };
        sharesSummary?: { totalShares: number };
        clickCount?: number;
        impressionCount?: number;
        uniqueImpressionsCount?: number;
      }>(`${LI_API_V2}/socialActions/${encodedId}`);

      return {
        reactions: data.likesSummary?.totalLikes ?? 0,
        comments: data.commentsSummary?.totalFirstLevelComments ?? 0,
        shares: data.sharesSummary?.totalShares ?? 0,
        linkClicks: data.clickCount ?? 0,
        impressions: data.impressionCount,
        reach: data.uniqueImpressionsCount,
      };
    } catch {
      // Retombe sur des métriques simulées si l'API est inaccessible.
      return simulatedMetrics();
    }
  }

  async createCampaign(
    input: CampaignInput
  ): Promise<{ externalId: string }> {
    if (
      !isLinkedInConfigured ||
      !input.accessToken ||
      input.accessToken.startsWith("simulated_")
    ) {
      return { externalId: simulatedId("li_campaign") };
    }

    // Ébauche LinkedIn Marketing API : création d'une campagne.
    // Nécessite le scope rw_organization_admin et un compte Ads Manager.
    // L'adAccountId doit être un URN : urn:li:sponsoredAccount:{id}
    const adAccount = input.adAccountId.startsWith("urn:li:")
      ? input.adAccountId
      : `urn:li:sponsoredAccount:${input.adAccountId}`;

    // Mapping des objectifs vers les types LinkedIn.
    const objectiveMap: Record<string, string> = {
      AWARENESS: "BRAND_AWARENESS",
      TRAFFIC: "WEBSITE_VISITS",
      ENGAGEMENT: "ENGAGEMENT",
      LEADS: "LEAD_GENERATION",
      APP_PROMOTION: "APP_INSTALLS",
      SALES: "WEBSITE_CONVERSIONS",
    };

    const body: Record<string, unknown> = {
      account: adAccount,
      name: input.name,
      campaignGroup: `urn:li:sponsoredCampaignGroup:${adAccount}`,
      type: "TEXT_AD",
      costType: "CPM",
      objectiveType: objectiveMap[input.objective] ?? "BRAND_AWARENESS",
      status: input.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
      locale: { country: "FR", language: "fr" },
      targeting: {
        includedTargetingFacets: {},
      },
    };

    if (input.dailyBudgetCents) {
      body.dailyBudget = {
        amount: String(input.dailyBudgetCents / 100),
        currencyCode: "EUR",
      };
    }

    const data = await linkedinFetch<{ id: number }>(
      `${LI_API_V2}/adCampaignsV2`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${input.accessToken}` },
        body: JSON.stringify(body),
      }
    );

    return { externalId: `urn:li:sponsoredCampaign:${data.id}` };
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Instance partagée du connecteur LinkedIn. */
export const linkedinConnector: SocialConnector = new LinkedInConnector();
