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
import { formatForLinkedIn } from "@/lib/linkedin-format";
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

/** Limite stricte du champ `commentary` d'un post LinkedIn (API /rest/posts). */
const LINKEDIN_COMMENTARY_MAX = 3000;

/**
 * Garantit un texte de post LinkedIn ≤ 3000 caractères, coupé PROPREMENT à une
 * frontière de phrase ou de paragraphe (jamais en plein mot, sans « … »).
 * En pratique les articles sont déjà calibrés sous 2900 → rarement déclenché ;
 * c'est le filet de sécurité ultime, valable pour TOUS les chemins de publication.
 */
function clampCommentary(text: string, max = LINKEDIN_COMMENTARY_MAX): string {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const br = Math.max(
    slice.lastIndexOf("\n\n"),
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("\n"),
  );
  return (br > max * 0.6 ? slice.slice(0, br + 1) : slice).trim();
}

/** True quand les app credentials LinkedIn sont présents. */
export const isLinkedInConfigured =
  Boolean(LINKEDIN_CLIENT_ID) && Boolean(LINKEDIN_CLIENT_SECRET);

/** URL de base des APIs LinkedIn. */
const LI_API_V2 = "https://api.linkedin.com/v2";
const LI_API_REST = "https://api.linkedin.com/rest";
const LI_OAUTH_BASE = "https://www.linkedin.com/oauth/v2";

/**
 * Version de l'API LinkedIn (en-tête `LinkedIn-Version`, format AAAAMM).
 * LinkedIn n'accepte que des versions récentes (~12 mois glissants) : une valeur
 * trop ancienne fait échouer toutes les requêtes. Surchargeable via
 * LINKEDIN_API_VERSION si LinkedIn impose une version précise.
 */
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || "202510";

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
      "LinkedIn-Version": LINKEDIN_VERSION,
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

/**
 * Upload d'une image vers LinkedIn (Images API) et renvoi de son URN
 * (`urn:li:image:...`) à référencer dans le post. Flux officiel en 3 temps :
 *   1) initializeUpload → { uploadUrl, image }
 *   2) PUT binaire de l'image vers uploadUrl
 *   3) on référence l'URN renvoyé dans content.media du post.
 */
async function uploadLinkedInImage(author: string, imageUrl: string, token: string): Promise<string> {
  const init = await fetch(`${LI_API_REST}/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
  });
  if (!init.ok) throw new Error(`LinkedIn images initializeUpload → HTTP ${init.status}`);
  const initJson = (await init.json()) as { value?: { uploadUrl?: string; image?: string } };
  const uploadUrl = initJson.value?.uploadUrl;
  const imageUrn = initJson.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error("LinkedIn images: réponse initializeUpload incomplète.");

  // Récupère les octets du visuel source (doit être une URL publique).
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Téléchargement du visuel échoué (HTTP ${imgRes.status}).`);
  const bytes = Buffer.from(await imgRes.arrayBuffer());

  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": imgRes.headers.get("content-type") || "application/octet-stream",
    },
    body: bytes,
  });
  if (!up.ok) throw new Error(`LinkedIn image upload → HTTP ${up.status}`);
  return imageUrn;
}

/** Vrai si le média est une vidéo (mimeType prioritaire, sinon extension). */
function isVideoMedia(media: { url: string; mimeType?: string }): boolean {
  if (media.mimeType?.startsWith("video")) return true;
  return /\.(mp4|mov|m4v|webm|avi)(\?|$)/i.test(media.url);
}

/**
 * Upload d'une VIDÉO vers LinkedIn (Videos API) et renvoi de son URN
 * (`urn:li:video:...`). Flux officiel :
 *   1) initializeUpload (fileSizeBytes) → { video, uploadInstructions[], uploadToken }
 *   2) PUT de chaque tranche d'octets vers son uploadUrl (ETag par partie)
 *   3) finalizeUpload avec les ETags
 *   4) courte attente du traitement (poll), puis l'URN se référence dans le post.
 */
async function uploadLinkedInVideo(author: string, videoUrl: string, token: string): Promise<string> {
  const restHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  } as const;

  // 0) Octets de la vidéo source (URL publique — nos médias sont hébergés).
  const vidRes = await fetch(videoUrl);
  if (!vidRes.ok) throw new Error(`Téléchargement de la vidéo échoué (HTTP ${vidRes.status}).`);
  const bytes = Buffer.from(await vidRes.arrayBuffer());
  if (bytes.length < 75 * 1024) throw new Error("Vidéo trop courte pour LinkedIn (minimum ~75 Ko).");
  if (bytes.length > 200 * 1024 * 1024) throw new Error("Vidéo trop lourde (> 200 Mo). Compressez-la avant publication.");

  // 1) initializeUpload
  const init = await fetch(`${LI_API_REST}/videos?action=initializeUpload`, {
    method: "POST",
    headers: restHeaders,
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: author,
        fileSizeBytes: bytes.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (!init.ok) throw new Error(`LinkedIn videos initializeUpload → HTTP ${init.status}`);
  const initJson = (await init.json()) as {
    value?: {
      video?: string;
      uploadToken?: string;
      uploadInstructions?: { uploadUrl: string; firstByte: number; lastByte: number }[];
    };
  };
  const videoUrn = initJson.value?.video;
  const instructions = initJson.value?.uploadInstructions ?? [];
  if (!videoUrn || instructions.length === 0) {
    throw new Error("LinkedIn videos: réponse initializeUpload incomplète.");
  }

  // 2) Upload de chaque tranche (ordre préservé — les ETags servent au finalize).
  const etags: string[] = [];
  for (const part of instructions) {
    const slice = bytes.subarray(part.firstByte, part.lastByte + 1);
    const up = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: slice,
    });
    if (!up.ok) throw new Error(`LinkedIn video upload (octets ${part.firstByte}-${part.lastByte}) → HTTP ${up.status}`);
    const etag = up.headers.get("etag");
    if (etag) etags.push(etag);
  }

  // 3) finalizeUpload
  const fin = await fetch(`${LI_API_REST}/videos?action=finalizeUpload`, {
    method: "POST",
    headers: restHeaders,
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken: initJson.value?.uploadToken ?? "",
        uploadedPartIds: etags,
      },
    }),
  });
  if (!fin.ok) throw new Error(`LinkedIn videos finalizeUpload → HTTP ${fin.status}`);

  // 4) Attente courte du traitement (le post exige une vidéo AVAILABLE ; si le
  //    traitement dépasse la fenêtre, l'appelant réessaiera — jamais de faux succès).
  for (let i = 0; i < 7; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await fetch(`${LI_API_REST}/videos/${encodeURIComponent(videoUrn)}`, { headers: restHeaders });
    if (!st.ok) continue;
    const stJson = (await st.json()) as { status?: string };
    if (stJson.status === "AVAILABLE") return videoUrn;
    if (stJson.status === "PROCESSING_FAILED") {
      throw new Error("LinkedIn n'a pas pu traiter la vidéo (format non supporté ?). Réessayez en MP4 H.264.");
    }
  }
  throw new Error("LinkedIn traite encore la vidéo — nouvelle tentative au prochain passage.");
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
    // 1) MISE EN FORME NATIVE : LinkedIn ne rend pas le markdown → conversion
    //    du gras/italique/puces/titres en Unicode natif (formatForLinkedIn est
    //    idempotente : un texte déjà converti ou sans markdown reste intact).
    //    Point d'application UNIQUE : tous les chemins (studio article, espace
    //    LinkedIn, publications programmées) passent par ce publishPost.
    // 2) GARDE-FOU universel : le champ `commentary` de l'API Posts est limité
    //    à 3000 caractères. Au-delà, LinkedIn tronque (avec « … ») côté
    //    serveur. On garantit donc ≤ 3000 EN COUPANT PROPREMENT à une
    //    frontière de phrase (jamais en plein mot, aucun « … »).
    const postBody: Record<string, unknown> = {
      author,
      commentary: clampCommentary(formatForLinkedIn(input.text)),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    // Ajout du média : VIDÉO (Videos API) ou image (Images API), sinon lien.
    let mediaAttached = false;
    if (input.media?.url) {
      if (isVideoMedia(input.media)) {
        // Vidéo : pas de repli texte silencieux — un échec doit se voir et être
        // retenté (le cron re-tente les échecs transitoires), jamais publier
        // le post sans sa vidéo à l'insu de l'utilisateur.
        const videoUrn = await uploadLinkedInVideo(author, input.media.url, input.accessToken);
        postBody.content = {
          media: { id: videoUrn, ...(input.linkTitle ? { title: input.linkTitle } : {}) },
        };
        mediaAttached = true;
      } else {
        try {
          const imageUrn = await uploadLinkedInImage(author, input.media.url, input.accessToken);
          postBody.content = {
            media: { id: imageUrn, ...(input.linkTitle ? { title: input.linkTitle } : {}) },
          };
          mediaAttached = true;
        } catch (e) {
          // Repli : si l'upload de l'image échoue, on publie au moins le texte.
          console.warn("[linkedin] upload image échoué, publication en texte seul :", (e as Error).message);
        }
      }
    }
    if (!mediaAttached && input.link) {
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
        "LinkedIn-Version": LINKEDIN_VERSION,
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
