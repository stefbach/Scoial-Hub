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

  async publish({ accessToken, text, media }) {
    // TikTok est une plateforme vidéo : un média vidéo est obligatoire.
    if (!media?.url) {
      throw new Error("TikTok exige une vidéo. Ajoutez un média vidéo à votre publication.");
    }

    // Étape obligatoire des guidelines TikTok avant tout /video/init/ : lire
    // les infos du créateur (options de confidentialité, verrous éventuels).
    // Sauter cet appel fait rejeter la publication avec un message générique
    // renvoyant vers content-sharing-guidelines — exactement ce qu'on a eu.
    const creatorRes = await fetch(`${TIKTOK_API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    });
    const creatorJson = (await creatorRes.json()) as {
      data?: { privacy_level_options?: string[]; max_video_post_duration_sec?: number };
      error?: { code?: string; message?: string };
    };
    if (!creatorRes.ok || (creatorJson.error && creatorJson.error.code && creatorJson.error.code !== "ok")) {
      throw new Error(`TikTok creator_info → ${creatorJson.error?.message ?? `HTTP ${creatorRes.status}`}`);
    }
    // SELF_ONLY est le seul niveau autorisé tant que l'app n'est pas auditée ;
    // on vérifie qu'il fait bien partie des options renvoyées par le créateur
    // plutôt que de le supposer aveuglément.
    const options = creatorJson.data?.privacy_level_options ?? [];
    if (options.length > 0 && !options.includes("SELF_ONLY")) {
      throw new Error(
        `TikTok : ce compte créateur n'autorise pas la visibilité SELF_ONLY (options reçues : ${options.join(", ")}).`
      );
    }

    // FILE_UPLOAD plutôt que PULL_FROM_URL : évite complètement d'avoir à faire
    // vérifier le domaine d'hébergement (Supabase Storage) par TikTok — la
    // vérification "Verify domains" côté Content Posting API restait ambiguë
    // même une fois la propriété d'URL générale vérifiée. On envoie les octets
    // directement, en un seul chunk (suffisant pour de courtes vidéos).
    const videoRes = await fetch(media.url);
    if (!videoRes.ok) {
      throw new Error(`TikTok publish → impossible de récupérer la vidéo (HTTP ${videoRes.status}).`);
    }
    const videoBuf = new Uint8Array(await videoRes.arrayBuffer());
    const videoSize = videoBuf.byteLength;

    // NB : privacy_level SELF_ONLY est le seul autorisé tant que l'app n'est pas
    // auditée par TikTok ; une app auditée peut utiliser PUBLIC_TO_EVERYONE.
    const res = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        post_info: { title: text, privacy_level: "SELF_ONLY" },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    });
    const json = (await res.json()) as {
      data?: { publish_id?: string; upload_url?: string };
      error?: { code?: string; message?: string };
    };
    if (!res.ok || (json.error && json.error.code && json.error.code !== "ok")) {
      throw new Error(`TikTok publish → ${json.error?.message ?? `HTTP ${res.status}`}`);
    }
    const uploadUrl = json.data?.upload_url;
    if (!uploadUrl) {
      throw new Error("TikTok publish → réponse sans upload_url.");
    }

    // Envoi effectif des octets — TikTok exige Content-Range même pour un
    // upload en un seul morceau.
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoBuf,
    });
    if (!uploadRes.ok) {
      throw new Error(`TikTok publish → échec de l'envoi du fichier (HTTP ${uploadRes.status}).`);
    }

    return { externalId: json.data?.publish_id ?? "" };
  },
};

export const tiktokConnector = makeOAuth2Connector(spec);
