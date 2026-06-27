/**
 * lib/connectors/providers/pinterest.ts
 *
 * Connecteur Pinterest — 100 % DÉCLARATIF. API v5 OAuth 2.0.
 * Scopes : boards:read, pins:read, pins:write, user_accounts:read.
 *
 * Tant que PINTEREST_CLIENT_ID / PINTEREST_CLIENT_SECRET sont absents, le
 * connecteur tourne en mode simulé.
 */

import { makeOAuth2Connector, type OAuth2ProviderSpec } from "@/lib/connectors/provider-spec";

const PINTEREST_API = "https://api.pinterest.com/v5";

const spec: OAuth2ProviderSpec = {
  platform: "pinterest",
  label: "Pinterest",
  clientIdEnv: "PINTEREST_CLIENT_ID",
  clientSecretEnv: "PINTEREST_CLIENT_SECRET",
  authorizeUrl: "https://www.pinterest.com/oauth/",
  tokenUrl: `${PINTEREST_API}/oauth/token`,
  scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
  scopeSeparator: ",",
  // Pinterest exige Basic auth (client_id:client_secret) au token endpoint.
  tokenAuth: "basic",
  simPrefix: "pin",

  async fetchAccount(accessToken) {
    const res = await fetch(`${PINTEREST_API}/user_account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`user_account → HTTP ${res.status}`);
    const json = (await res.json()) as { username?: string; id?: string };
    return {
      externalId: json.id ?? json.username,
      accountName: json.username ? `@${json.username}` : "Pinterest",
    };
  },

  async publish({ accessToken, text, media, link, externalAccountId }) {
    // Un Pin Pinterest EXIGE un visuel + un board cible (externalAccountId).
    if (!media?.url) {
      throw new Error("Pinterest exige une image (média) pour créer un Pin. Ajoutez un visuel.");
    }
    if (!externalAccountId) {
      throw new Error("Pinterest exige un board cible (board_id) pour publier le Pin.");
    }
    const res = await fetch(`${PINTEREST_API}/pins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        board_id: externalAccountId,
        description: text,
        ...(link ? { link } : {}),
        media_source: { source_type: "image_url", url: media.url },
      }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string };
        detail = body.message ?? detail;
      } catch {
        /* corps non parsable */
      }
      throw new Error(`Pinterest pins → ${detail}`);
    }
    const json = (await res.json()) as { id?: string };
    const id = json.id ?? "";
    return { externalId: id, url: id ? `https://www.pinterest.com/pin/${id}/` : undefined };
  },
};

export const pinterestConnector = makeOAuth2Connector(spec);
