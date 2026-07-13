/**
 * lib/connectors/meta.ts
 *
 * Connecteur Meta : Facebook Pages + Instagram Business
 * via la Graph API (https://graph.facebook.com/${version}).
 *
 * Dégradation gracieuse : si `isMetaConfigured` est false ou si un token
 * est manquant, toutes les méthodes retournent des valeurs simulées cohérentes
 * sans jamais appeler le réseau. Aucun appel réseau n'a lieu au chargement du
 * module.
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

// Tolérance : si l'App ID a été collé sous la forme "appId|appSecret"
// (format token d'app), on en extrait l'App ID seul et, si besoin, le secret.
const RAW_APP_ID = (process.env.META_APP_ID ?? "").trim();
const META_APP_ID = RAW_APP_ID.split("|")[0].trim();
const META_APP_SECRET = (process.env.META_APP_SECRET ?? RAW_APP_ID.split("|")[1] ?? "").trim();
const META_API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** True quand les app credentials Meta sont présents. */
export const isMetaConfigured = Boolean(META_APP_ID) && Boolean(META_APP_SECRET);

/** URL de base de la Graph API. */
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/** Scopes OAuth requis pour la publication organique + Marketing API. */
const META_SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_manage_engagement", // répondre aux commentaires/messages de la Page (messagerie)
  "pages_read_user_content", // lire les commentaires/posts des VISITEURS + avis de la Page (messagerie)
  "pages_messaging", // lire/répondre aux messages privés Messenger
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "instagram_manage_comments", // lire/répondre aux commentaires Instagram (messagerie)
  "instagram_manage_messages", // lire/répondre aux DM Instagram
  "ads_management",
  "business_management",
].join(",");

// ---------------------------------------------------------------------------
// Helpers réseau
// ---------------------------------------------------------------------------

/**
 * Effectue un appel Graph API et parse le JSON.
 * Lance une erreur si la réponse contient un champ `error`.
 */
async function graphFetch<T = Record<string, unknown>>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const data = (await res.json()) as T & { error?: { message: string; code: number } };

  if ("error" in data && data.error) {
    throw new Error(
      `Graph API ${path} → [${data.error.code}] ${data.error.message}`
    );
  }

  return data;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Attend qu'un conteneur média Instagram soit prêt à être publié.
 *
 * Instagram traite le conteneur de façon ASYNCHRONE (récupération de l'image/
 * vidéo depuis l'URL, transcodage…). Appeler `media_publish` avant la fin du
 * traitement renvoie « [9007] Media ID is not available ». On interroge donc
 * `status_code` jusqu'à `FINISHED`, dans une fenêtre compatible avec la durée
 * max d'une route serverless (~45 s : couvre images et vidéos courtes).
 */
async function waitForIgContainerReady(containerId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + 45_000;
  let delay = 1200;
  let last = "";
  while (Date.now() < deadline) {
    const s = await graphFetch<{ status_code?: string; status?: string }>(
      `/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`
    );
    last = s.status_code ?? s.status ?? "";
    if (last === "FINISHED") return;
    if (last === "ERROR" || last === "EXPIRED") {
      throw new Error(
        `Instagram n'a pas pu préparer le média (${last}). Vérifiez que l'URL du média est publique et au bon format.`
      );
    }
    // IN_PROGRESS → on patiente (backoff plafonné).
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), 5000);
  }
  throw new Error(
    "Instagram met trop de temps à préparer le média (délai dépassé). Réessayez dans un instant — le visuel est peut-être encore en cours de traitement."
  );
}

// ---------------------------------------------------------------------------
// Valeurs simulées
// ---------------------------------------------------------------------------

/** Génère un identifiant simulé préfixé. */
function simulatedId(prefix: string): string {
  return `${prefix}_simulated_${Date.now()}`;
}

/**
 * Métriques vides (toutes à zéro). Utilisé quand aucun page token n'est
 * disponible : on évite un appel Graph API voué à l'échec et on renvoie un
 * objet neutre que l'appelant peut afficher sans erreur.
 */
function emptyMetrics(): PostMetrics {
  return {
    reactions: 0,
    comments: 0,
    shares: 0,
    linkClicks: 0,
    reach: 0,
    impressions: 0,
  };
}

/** Retourne des métriques simulées cohérentes. */
function simulatedMetrics(): PostMetrics {
  return {
    reactions: Math.floor(Math.random() * 120) + 10,
    comments: Math.floor(Math.random() * 30) + 1,
    shares: Math.floor(Math.random() * 20),
    linkClicks: Math.floor(Math.random() * 50) + 5,
    reach: Math.floor(Math.random() * 2000) + 200,
    impressions: Math.floor(Math.random() * 5000) + 500,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// Connecteur Facebook
// ---------------------------------------------------------------------------

class FacebookConnector implements SocialConnector {
  readonly platform: Platform = "facebook";

  isConfigured(): boolean {
    return isMetaConfigured;
  }

  getAuthUrl(state: string): string {
    if (!isMetaConfigured) {
      // En mode simulé, on renvoie une URL factice mais valide.
      return `${APP_URL}/accounts?simulated=true&platform=facebook&state=${encodeURIComponent(state)}`;
    }

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: `${APP_URL}/api/connectors/facebook/callback`,
      scope: META_SCOPES,
      response_type: "code",
      // rerequest : force Facebook à RE-proposer le choix des Pages partagées
      // avec l'app — sinon la reconnexion réutilise la sélection précédente et
      // les Pages jamais cochées restent invisibles (pubs « non accessibles »).
      auth_type: "rerequest",
      state,
    });

    return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    if (!isMetaConfigured) {
      // Simule un échange de code réussi.
      return {
        accessToken: `simulated_fb_token_${Date.now()}`,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        externalId: simulatedId("page"),
        accountName: "Page Facebook (simulée)",
        raw: { simulated: true },
      };
    }

    // Échange code → token court durée.
    const shortData = await graphFetch<{
      access_token: string;
      token_type: string;
    }>(
      `/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(
        `${APP_URL}/api/connectors/facebook/callback`
      )}&client_secret=${META_APP_SECRET}&code=${code}`
    );

    // Échange token court → token long durée (60 jours).
    const longData = await graphFetch<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>(
      `/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortData.access_token}`
    );

    // Récupère le profil de l'utilisateur pour l'identifiant et le nom.
    const me = await graphFetch<{ id: string; name: string }>(
      `/me?fields=id,name&access_token=${longData.access_token}`
    );

    return {
      accessToken: longData.access_token,
      expiresAt:
        longData.expires_in > 0
          ? Math.floor(Date.now() / 1000) + longData.expires_in
          : undefined,
      externalId: me.id,
      accountName: me.name,
      raw: longData as unknown as Record<string, unknown>,
    };
  }

  async publishPost(input: PublishInput): Promise<PublishResult> {
    if (!isMetaConfigured || !input.accessToken || input.accessToken.startsWith("simulated_")) {
      const simId = simulatedId("fb_post");
      return {
        externalId: simId,
        url: `https://www.facebook.com/${simId}`,
        simulated: true,
      };
    }

    const pageId = input.externalAccountId;

    // ── Média joint : Facebook exige des endpoints dédiés (≠ /feed) ──────────
    if (input.media?.url) {
      const isVideo =
        input.media.mimeType?.startsWith("video") ??
        /\.(mp4|mov|avi|m4v|webm)(\?|$)/i.test(input.media.url);

      if (isVideo) {
        // Vidéo de Page : POST /{page-id}/videos avec file_url public.
        const vid = await graphFetch<{ id: string }>(`/${pageId}/videos`, {
          method: "POST",
          body: JSON.stringify({
            file_url: input.media.url,
            description: input.text,
            access_token: input.accessToken,
          }),
        });
        return {
          externalId: vid.id,
          url: `https://www.facebook.com/${vid.id}`,
        };
      }

      // Photo de Page : POST /{page-id}/photos avec url publique + légende.
      const photo = await graphFetch<{ id: string; post_id?: string }>(`/${pageId}/photos`, {
        method: "POST",
        body: JSON.stringify({
          url: input.media.url,
          caption: input.text,
          access_token: input.accessToken,
        }),
      });
      const id = photo.post_id ?? photo.id;
      return {
        externalId: id,
        url: `https://www.facebook.com/${id}`,
      };
    }

    // ── Sinon : publication texte (+ lien) sur le mur (POST /{page-id}/feed) ──
    const body: Record<string, string> = {
      message: input.text,
      access_token: input.accessToken,
    };

    if (input.link) body.link = input.link;
    if (input.linkTitle) body.name = input.linkTitle;
    if (input.linkDescription) body.description = input.linkDescription;

    const result = await graphFetch<{ id: string }>(
      `/${pageId}/feed`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return {
      externalId: result.id,
      url: `https://www.facebook.com/${result.id}`,
    };
  }

  async getMetrics(externalId: string, accessToken?: string): Promise<PostMetrics> {
    if (!isMetaConfigured || externalId.includes("simulated")) {
      return simulatedMetrics();
    }

    // Les insights d'une publication exigent le PAGE token (stocké dans
    // social_accounts), pas l'app token : un appel app-token est voué à
    // l'échec (#403). En l'absence de page token, on retourne proprement des
    // métriques vides plutôt que de faire un appel destiné à échouer.
    const pageToken = accessToken?.trim();
    if (!pageToken || pageToken.startsWith("simulated_")) {
      return emptyMetrics();
    }

    const data = await graphFetch<{
      data: { name: string; values: { value: number }[] }[];
    }>(
      `/${externalId}/insights?metric=post_reactions_by_type_total,post_comments,post_shares,post_clicks&access_token=${encodeURIComponent(pageToken)}`
    );

    const get = (name: string): number => {
      const item = data.data.find((d) => d.name === name);
      if (!item || item.values.length === 0) return 0;
      const val = item.values[item.values.length - 1].value;
      return typeof val === "number" ? val : 0;
    };

    return {
      reactions: get("post_reactions_by_type_total"),
      comments: get("post_comments"),
      shares: get("post_shares"),
      linkClicks: get("post_clicks"),
    };
  }

  async createCampaign(
    input: CampaignInput
  ): Promise<{ externalId: string }> {
    if (!isMetaConfigured || !input.accessToken || input.accessToken.startsWith("simulated_")) {
      return { externalId: simulatedId("act_campaign") };
    }

    // Appel Marketing API : création d'une campagne.
    const body: Record<string, unknown> = {
      name: input.name,
      objective: input.objective,
      status: input.status ?? "PAUSED",
      access_token: input.accessToken,
    };

    if (input.dailyBudgetCents) {
      body.daily_budget = input.dailyBudgetCents;
    }

    const result = await graphFetch<{ id: string }>(
      `/act_${input.adAccountId}/campaigns`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return { externalId: result.id };
  }
}

// ---------------------------------------------------------------------------
// Connecteur Instagram
// ---------------------------------------------------------------------------

class InstagramConnector implements SocialConnector {
  readonly platform: Platform = "instagram";

  isConfigured(): boolean {
    return isMetaConfigured;
  }

  getAuthUrl(state: string): string {
    if (!isMetaConfigured) {
      return `${APP_URL}/accounts?simulated=true&platform=instagram&state=${encodeURIComponent(state)}`;
    }

    // Instagram utilise le même flow OAuth que Facebook — les tokens Facebook
    // permettent d'accéder aux comptes Instagram Business liés.
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: `${APP_URL}/api/connectors/instagram/callback`,
      scope: META_SCOPES,
      response_type: "code",
      // rerequest : force Facebook à RE-proposer le choix des Pages partagées
      // avec l'app — sinon la reconnexion réutilise la sélection précédente et
      // les Pages jamais cochées restent invisibles (pubs « non accessibles »).
      auth_type: "rerequest",
      state,
    });

    return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    if (!isMetaConfigured) {
      return {
        accessToken: `simulated_ig_token_${Date.now()}`,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        externalId: simulatedId("ig_user"),
        accountName: "Compte Instagram (simulé)",
        raw: { simulated: true },
      };
    }

    // Même échange que Facebook — le token donne accès aux deux plateformes.
    const shortData = await graphFetch<{
      access_token: string;
      token_type: string;
    }>(
      `/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(
        `${APP_URL}/api/connectors/instagram/callback`
      )}&client_secret=${META_APP_SECRET}&code=${code}`
    );

    const longData = await graphFetch<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>(
      `/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortData.access_token}`
    );

    // Récupère le compte Instagram Business connecté à la Page.
    const me = await graphFetch<{
      id: string;
      instagram_business_account?: { id: string; name: string; username: string };
    }>(
      `/me?fields=id,instagram_business_account{id,name,username}&access_token=${longData.access_token}`
    );

    const ig = me.instagram_business_account;

    return {
      accessToken: longData.access_token,
      expiresAt:
        longData.expires_in > 0
          ? Math.floor(Date.now() / 1000) + longData.expires_in
          : undefined,
      externalId: ig?.id ?? me.id,
      accountName: ig?.username ? `@${ig.username}` : (ig?.name ?? "Instagram"),
      raw: longData as unknown as Record<string, unknown>,
    };
  }

  async publishPost(input: PublishInput): Promise<PublishResult> {
    if (!isMetaConfigured || !input.accessToken || input.accessToken.startsWith("simulated_")) {
      const simId = simulatedId("ig_post");
      return {
        externalId: simId,
        url: `https://www.instagram.com/p/${simId}/`,
        simulated: true,
      };
    }

    const igUserId = input.externalAccountId;

    // Étape 1 : créer le container média.
    const containerParams: Record<string, string> = {
      caption: input.text,
      access_token: input.accessToken,
    };

    if (input.media?.url) {
      // Détermine le type de média (image par défaut).
      const isVideo =
        input.media.mimeType?.startsWith("video") ??
        input.media.url.match(/\.(mp4|mov|avi)$/i) != null;

      if (isVideo) {
        containerParams.media_type = "VIDEO";
        containerParams.video_url = input.media.url;
      } else {
        containerParams.image_url = input.media.url;
      }
    } else {
      // Instagram n'autorise pas la publication de texte seul : un média
      // (image ou vidéo) est obligatoire. On renvoie une erreur claire plutôt
      // que de publier une image placeholder factice à la place de l'utilisateur.
      throw new Error(
        "Instagram exige un média (image ou vidéo). Ajoutez un visuel à votre publication."
      );
    }

    const container = await graphFetch<{ id: string }>(
      `/${igUserId}/media`,
      {
        method: "POST",
        body: JSON.stringify(containerParams),
      }
    );

    // Étape 1bis : ATTENDRE que le conteneur soit prêt. Instagram traite le
    // média de façon asynchrone (téléchargement de l'URL, transcodage vidéo) ;
    // publier trop tôt renvoie « [9007] Media ID is not available ».
    await waitForIgContainerReady(container.id, input.accessToken);

    // Étape 2 : publier le container.
    const publish = await graphFetch<{ id: string }>(
      `/${igUserId}/media_publish`,
      {
        method: "POST",
        body: JSON.stringify({
          creation_id: container.id,
          access_token: input.accessToken,
        }),
      }
    );

    return {
      externalId: publish.id,
      url: `https://www.instagram.com/p/${publish.id}/`,
    };
  }

  async getMetrics(externalId: string, accessToken?: string): Promise<PostMetrics> {
    if (!isMetaConfigured || externalId.includes("simulated")) {
      return simulatedMetrics();
    }

    // Les insights Instagram exigent le PAGE token lié au compte IG Business
    // (pas l'app token). Sans token valide, on renvoie des métriques vides
    // proprement au lieu d'un appel voué à l'échec.
    const pageToken = accessToken?.trim();
    if (!pageToken || pageToken.startsWith("simulated_")) {
      return emptyMetrics();
    }

    const data = await graphFetch<{
      data: { name: string; value: number }[];
    }>(
      `/${externalId}/insights?metric=likes,comments,shares,saved,reach,impressions&access_token=${encodeURIComponent(pageToken)}`
    );

    const get = (name: string): number => {
      const item = data.data.find((d) => d.name === name);
      return item ? item.value : 0;
    };

    return {
      reactions: get("likes"),
      comments: get("comments"),
      shares: get("shares"),
      linkClicks: get("saved"), // Instagram n'a pas de link_clicks — on utilise "saved"
      reach: get("reach"),
      impressions: get("impressions"),
    };
  }

  async createCampaign(
    input: CampaignInput
  ): Promise<{ externalId: string }> {
    // Instagram utilise la même Marketing API que Facebook (Meta Ads).
    if (!isMetaConfigured || !input.accessToken || input.accessToken.startsWith("simulated_")) {
      return { externalId: simulatedId("act_campaign_ig") };
    }

    const body: Record<string, unknown> = {
      name: input.name,
      objective: input.objective,
      status: input.status ?? "PAUSED",
      access_token: input.accessToken,
    };

    if (input.dailyBudgetCents) {
      body.daily_budget = input.dailyBudgetCents;
    }

    const result = await graphFetch<{ id: string }>(
      `/act_${input.adAccountId}/campaigns`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return { externalId: result.id };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Instance partagée du connecteur Facebook. */
export const facebookConnector: SocialConnector = new FacebookConnector();

/** Instance partagée du connecteur Instagram. */
export const instagramConnector: SocialConnector = new InstagramConnector();
