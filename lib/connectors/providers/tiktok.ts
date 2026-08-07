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

    // PULL_FROM_URL — la vidéo vit déjà sur NOTRE serveur (bucket Supabase),
    // ce qui est exactement le cas où les guidelines TikTok imposent
    // PULL_FROM_URL et interdisent FILE_UPLOAD (réservé au contenu venant de
    // l'appareil de l'utilisateur final) : "If video resources are already
    // on API Clients' servers, do not use FILE_UPLOAD; use PULL_FROM_URL
    // instead." — l'avoir fait dans l'autre sens était la vraie cause du
    // rejet générique "review our integration guidelines". Le domaine du
    // bucket est déjà vérifié via Manage URL properties (requis pour
    // PULL_FROM_URL).
    //
    // NB : privacy_level SELF_ONLY est le seul autorisé tant que l'app n'est pas
    // auditée par TikTok ; une app auditée peut utiliser PUBLIC_TO_EVERYONE.
    const res = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        post_info: { title: text, privacy_level: "SELF_ONLY" },
        source_info: { source: "PULL_FROM_URL", video_url: media.url },
      }),
    });
    const json = (await res.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };
    if (!res.ok || (json.error && json.error.code && json.error.code !== "ok")) {
      throw new Error(`TikTok publish → ${json.error?.message ?? `HTTP ${res.status}`}`);
    }
    return { externalId: json.data?.publish_id ?? "" };
  },
};

export const tiktokConnector = makeOAuth2Connector(spec);
