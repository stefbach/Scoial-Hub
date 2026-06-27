/**
 * lib/connectors/providers/twitter.ts
 *
 * Connecteur Twitter/X — 100 % DÉCLARATIF (aucune route ni classe dédiée).
 * API v2 OAuth 2.0 (Authorization Code + PKCE). Scopes : tweet.write,
 * users.read, offline.access (refresh token), tweet.read.
 *
 * Tant que TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET sont absents, le
 * connecteur tourne en mode simulé (cf. makeOAuth2Connector).
 */

import { makeOAuth2Connector, type OAuth2ProviderSpec } from "@/lib/connectors/provider-spec";

const TWITTER_API = "https://api.twitter.com/2";

const spec: OAuth2ProviderSpec = {
  platform: "twitter",
  label: "Twitter/X",
  clientIdEnv: "TWITTER_CLIENT_ID",
  clientSecretEnv: "TWITTER_CLIENT_SECRET",
  authorizeUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: `${TWITTER_API}/oauth2/token`,
  scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  // X impose Basic auth pour les apps confidentielles + PKCE obligatoire.
  tokenAuth: "basic",
  pkce: "plain",
  simPrefix: "tw",

  async fetchAccount(accessToken) {
    const res = await fetch(`${TWITTER_API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`users/me → HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { id: string; username?: string; name?: string } };
    const u = json.data;
    return {
      externalId: u?.id,
      accountName: u?.username ? `@${u.username}` : (u?.name ?? "Twitter/X"),
    };
  },

  async publish({ accessToken, text }) {
    // API v2 : POST /tweets. (Les médias exigent l'upload v1.1 préalable —
    // non couvert ici : texte d'abord, média = évolution incrémentale.)
    const res = await fetch(`${TWITTER_API}/tweets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { detail?: string; title?: string };
        detail = body.detail ?? body.title ?? detail;
      } catch {
        /* corps non parsable */
      }
      throw new Error(`Twitter/X tweets → ${detail}`);
    }
    const json = (await res.json()) as { data?: { id: string } };
    const id = json.data?.id ?? "";
    return { externalId: id, url: id ? `https://twitter.com/i/web/status/${id}` : undefined };
  },
};

export const twitterConnector = makeOAuth2Connector(spec);
