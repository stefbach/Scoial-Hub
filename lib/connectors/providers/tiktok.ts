/**
 * lib/connectors/providers/tiktok.ts
 *
 * Connecteur TikTok — DÉCLARATIF. TikTok for Developers, API v2.
 * OAuth 2.0 (Authorization Code + PKCE S256). Particularités TikTok :
 *   - le paramètre d'identifiant client s'appelle `client_key` (pas client_id) ;
 *   - PKCE en méthode S256 obligatoire ;
 *   - la PUBLICATION exige une app AUDITÉE par TikTok (Content Posting API).
 *     Sans audit, seules les publications privées (SELF_ONLY) sont possibles.
 *
 * Tant que TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET sont absents, le connecteur
 * tourne en mode simulé (cf. makeOAuth2Connector).
 */

import { makeOAuth2Connector, type OAuth2ProviderSpec } from "@/lib/connectors/provider-spec";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

// ---------------------------------------------------------------------------
// creator_info — infos du créateur requises par les guidelines TikTok avant
// tout /video/init/ : options de confidentialité, interactions verrouillées
// par le créateur, durée max. Exportée pour être réutilisée par l'UI de
// composition (menu déroulant confidentialité + cases d'interaction, sans
// valeur par défaut — cf. « Required UX Implementation » des guidelines).
// ---------------------------------------------------------------------------

export interface TikTokCreatorInfo {
  privacyLevelOptions: string[];
  /** Vrai si le créateur a désactivé les commentaires dans ses réglages TikTok. */
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec?: number;
  creatorNickname?: string;
  creatorAvatarUrl?: string;
}

export async function fetchTikTokCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  const res = await fetch(`${TIKTOK_API}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    data?: {
      privacy_level_options?: string[];
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
      max_video_post_duration_sec?: number;
      creator_nickname?: string;
      creator_avatar_url?: string;
    };
    error?: { code?: string; message?: string };
  };
  if (!res.ok || (json.error && json.error.code && json.error.code !== "ok")) {
    throw new Error(`TikTok creator_info → [${json.error?.code ?? `HTTP ${res.status}`}] ${json.error?.message ?? ""}`);
  }
  const d = json.data ?? {};
  return {
    privacyLevelOptions: d.privacy_level_options ?? [],
    commentDisabled: !!d.comment_disabled,
    duetDisabled: !!d.duet_disabled,
    stitchDisabled: !!d.stitch_disabled,
    maxVideoPostDurationSec: d.max_video_post_duration_sec,
    creatorNickname: d.creator_nickname,
    creatorAvatarUrl: d.creator_avatar_url,
  };
}

// ---------------------------------------------------------------------------
// status/fetch — statut RÉEL d'une publication après l'appel init (init ne
// fait QUE mettre en file : la vidéo/photo est ensuite téléchargée et traitée
// de façon asynchrone côté TikTok, et peut échouer sans qu'aucune erreur ne
// remonte à l'appel init — cf. l'incident "photo marquée publiée mais absente
// du profil"). Utilisée par le cron de vérification post-publication.
// ---------------------------------------------------------------------------

export type TikTokPublishStatusValue =
  | "PROCESSING_UPLOAD"
  | "PROCESSING_DOWNLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

export interface TikTokPublishStatus {
  status: TikTokPublishStatusValue;
  failReason?: string;
  /** post_id publics — renseignés seulement une fois la modération TikTok terminée. */
  publiclyAvailablePostIds: string[];
}

export async function fetchTikTokPublishStatus(
  accessToken: string,
  publishId: string
): Promise<TikTokPublishStatus> {
  const res = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const json = (await res.json()) as {
    data?: {
      status?: string;
      fail_reason?: string;
      publicaly_available_post_id?: (number | string)[];
    };
    error?: { code?: string; message?: string };
  };
  if (!res.ok || (json.error && json.error.code && json.error.code !== "ok")) {
    throw new Error(`TikTok status/fetch → [${json.error?.code ?? `HTTP ${res.status}`}] ${json.error?.message ?? ""}`);
  }
  const d = json.data ?? {};
  return {
    status: (d.status as TikTokPublishStatusValue) ?? "FAILED",
    failReason: d.fail_reason,
    publiclyAvailablePostIds: (d.publicaly_available_post_id ?? []).map(String),
  };
}

const spec: OAuth2ProviderSpec = {
  platform: "tiktok",
  label: "TikTok",
  clientIdEnv: "TIKTOK_CLIENT_KEY",
  clientSecretEnv: "TIKTOK_CLIENT_SECRET",
  clientIdParam: "client_key", // TikTok n'utilise pas "client_id"
  authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
  tokenUrl: `${TIKTOK_API}/oauth/token/`,
  scopes: ["user.info.basic", "video.publish"],
  scopeSeparator: ",",
  pkce: "S256",
  simPrefix: "tt",

  async fetchAccount(accessToken) {
    // "username" appartient au scope user.info.profile (qu'on ne demande pas —
    // seul user.info.basic est configuré). Le demander quand même fait
    // rejeter l'appel ENTIER en 401 par TikTok, même si open_id/display_name
    // seraient couverts par user.info.basic. On se limite donc aux deux champs
    // réellement autorisés par notre scope actuel.
    const res = await fetch(`${TIKTOK_API}/user/info/?fields=open_id,display_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`user/info → HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { user?: { open_id?: string; display_name?: string } } };
    const u = json.data?.user;
    return {
      externalId: u?.open_id,
      accountName: u?.display_name ?? "TikTok",
    };
  },

  async publish({ accessToken, text, media, tiktok }) {
    if (!media?.url) {
      throw new Error("TikTok exige un média (vidéo ou photo). Ajoutez-en un à votre publication.");
    }
    const isPhoto = media.mimeType?.startsWith("image/") ?? false;

    // Étape obligatoire des guidelines TikTok avant tout /video/init/ ou
    // /content/init/ (même appel pour les deux) : lire les infos du créateur
    // (options de confidentialité, verrous éventuels). Sauter cet appel fait
    // rejeter la publication avec un message générique renvoyant vers
    // content-sharing-guidelines — exactement ce qu'on a eu.
    const creatorInfo = await fetchTikTokCreatorInfo(accessToken);
    const options = creatorInfo.privacyLevelOptions;

    // `tiktok` porte le choix explicite de l'utilisateur fait dans l'UI de
    // composition (menu déroulant confidentialité + cases Duet/Stitch/
    // Commentaire + divulgation commerciale — Required UX Implementation des
    // guidelines TikTok). Absent (anciens posts programmés avant l'ajout de
    // ces réglages, ou appel direct de l'API) → comportement historique
    // inchangé : SELF_ONLY, aucune interaction explicitement désactivée.
    const privacyLevel = tiktok?.privacyLevel ?? "SELF_ONLY";
    if (options.length > 0 && !options.includes(privacyLevel)) {
      throw new Error(
        `TikTok : la visibilité « ${privacyLevel} » n'est pas proposée par ce compte créateur (options reçues : ${options.join(", ")}).`
      );
    }

    if (isPhoto) {
      // /post/publish/content/init/ — endpoint et format DISTINCTS de la
      // vidéo (cf. API Reference → Photo). Duet/Stitch ne s'appliquent pas
      // aux photos (absents du schéma) ; le texte va dans `description`
      // (jusqu'à 4000 runes) plutôt que `title` (limité à 90 runes côté
      // photo — bien plus court que la vidéo, où `title` porte tout le
      // texte). Une seule image par post pour l'instant (photo_images
      // n'accepte qu'un tableau, jusqu'à 35 — notre UI de composition ne
      // gère qu'un seul média à la fois).
      const postInfo: Record<string, unknown> = { description: text, privacy_level: privacyLevel };
      if (tiktok) {
        postInfo.disable_comment = !tiktok.allowComment;
        if (tiktok.disclosure === "your_brand" || tiktok.disclosure === "both") {
          postInfo.brand_organic_toggle = true;
        }
        if (tiktok.disclosure === "branded_content" || tiktok.disclosure === "both") {
          postInfo.brand_content_toggle = true;
        }
      }
      const res = await fetch(`${TIKTOK_API}/post/publish/content/init/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          post_info: postInfo,
          source_info: { source: "PULL_FROM_URL", photo_images: [media.url], photo_cover_index: 0 },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        }),
      });
      const json = (await res.json()) as {
        data?: { publish_id?: string };
        error?: { code?: string; message?: string };
      };
      if (!res.ok || (json.error && json.error.code && json.error.code !== "ok")) {
        throw new Error(`TikTok publish (photo) → [${json.error?.code ?? `HTTP ${res.status}`}] ${json.error?.message ?? ""}`);
      }
      return { externalId: json.data?.publish_id ?? "" };
    }

    const postInfo: Record<string, unknown> = { title: text, privacy_level: privacyLevel };
    if (tiktok) {
      postInfo.disable_duet = !tiktok.allowDuet;
      postInfo.disable_stitch = !tiktok.allowStitch;
      postInfo.disable_comment = !tiktok.allowComment;
      // Divulgation de contenu commercial (cf. guidelines, section 3) : le
      // toggle est ÉTEINT par défaut ("none") — flags omis, comportement
      // organique classique.
      if (tiktok.disclosure === "your_brand" || tiktok.disclosure === "both") {
        postInfo.brand_organic_toggle = true;
      }
      if (tiktok.disclosure === "branded_content" || tiktok.disclosure === "both") {
        postInfo.brand_content_toggle = true;
      }
    }

    // PULL_FROM_URL — la vidéo vit déjà sur NOTRE serveur (bucket Supabase),
    // ce qui est exactement le cas où les guidelines TikTok imposent
    // PULL_FROM_URL et interdisent FILE_UPLOAD (réservé au contenu venant de
    // l'appareil de l'utilisateur final) : "If video resources are already
    // on API Clients' servers, do not use FILE_UPLOAD; use PULL_FROM_URL
    // instead." — l'avoir fait dans l'autre sens était la vraie cause du
    // rejet générique "review our integration guidelines". Le domaine du
    // bucket est déjà vérifié via Manage URL properties (requis pour
    // PULL_FROM_URL).
    const res = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        post_info: postInfo,
        source_info: { source: "PULL_FROM_URL", video_url: media.url },
      }),
    });
    const json = (await res.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };
    if (!res.ok || (json.error && json.error.code && json.error.code !== "ok")) {
      throw new Error(`TikTok publish → [${json.error?.code ?? `HTTP ${res.status}`}] ${json.error?.message ?? ""}`);
    }
    return { externalId: json.data?.publish_id ?? "" };
  },
};

export const tiktokConnector = makeOAuth2Connector(spec);
