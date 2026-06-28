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
    const res = await fetch(`${TIKTOK_API}/user/info/?fields=open_id,username,display_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`user/info → HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { user?: { open_id?: string; username?: string; display_name?: string } } };
    const u = json.data?.user;
    return {
      externalId: u?.open_id,
      accountName: u?.username ? `@${u.username}` : (u?.display_name ?? "TikTok"),
    };
  },

  async publish({ accessToken, text, media }) {
    // TikTok est une plateforme vidéo : un média vidéo est obligatoire.
    if (!media?.url) {
      throw new Error("TikTok exige une vidéo. Ajoutez un média vidéo à votre publication.");
    }
    // Content Posting API — direct post via PULL_FROM_URL.
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
