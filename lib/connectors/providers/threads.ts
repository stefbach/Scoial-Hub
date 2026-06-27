/**
 * lib/connectors/providers/threads.ts
 *
 * Connecteur Threads (Meta) — 100 % DÉCLARATIF. Threads Graph API.
 * Flux en 2 temps comme Instagram : créer un container puis le publier.
 * Scopes : threads_basic, threads_content_publish.
 *
 * Tant que THREADS_CLIENT_ID / THREADS_CLIENT_SECRET sont absents, le
 * connecteur tourne en mode simulé.
 */

import { makeOAuth2Connector, type OAuth2ProviderSpec } from "@/lib/connectors/provider-spec";

const THREADS_GRAPH = "https://graph.threads.net/v1.0";

const spec: OAuth2ProviderSpec = {
  platform: "threads",
  label: "Threads",
  clientIdEnv: "THREADS_CLIENT_ID",
  clientSecretEnv: "THREADS_CLIENT_SECRET",
  authorizeUrl: "https://threads.net/oauth/authorize",
  tokenUrl: "https://graph.threads.net/oauth/access_token",
  scopes: ["threads_basic", "threads_content_publish"],
  scopeSeparator: ",",
  simPrefix: "th",

  async fetchAccount(accessToken) {
    const res = await fetch(
      `${THREADS_GRAPH}/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) throw new Error(`threads/me → HTTP ${res.status}`);
    const json = (await res.json()) as { id?: string; username?: string };
    return {
      externalId: json.id,
      accountName: json.username ? `@${json.username}` : "Threads",
    };
  },

  async publish({ accessToken, text, media, externalAccountId }) {
    const userId = externalAccountId || "me";

    // Étape 1 : créer le container (texte, image ou vidéo).
    const createParams: Record<string, string> = { access_token: accessToken, text };
    if (media?.url) {
      const isVideo =
        media.mimeType?.startsWith("video") ?? /\.(mp4|mov|m4v|webm)(\?|$)/i.test(media.url);
      createParams.media_type = isVideo ? "VIDEO" : "IMAGE";
      createParams[isVideo ? "video_url" : "image_url"] = media.url;
    } else {
      createParams.media_type = "TEXT";
    }

    const createRes = await fetch(`${THREADS_GRAPH}/${userId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createParams),
    });
    if (!createRes.ok) throw new Error(`Threads container → HTTP ${createRes.status}`);
    const container = (await createRes.json()) as { id?: string };
    if (!container.id) throw new Error("Threads : container sans id.");

    // Étape 2 : publier le container.
    const pubRes = await fetch(`${THREADS_GRAPH}/${userId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
    });
    if (!pubRes.ok) throw new Error(`Threads publish → HTTP ${pubRes.status}`);
    const published = (await pubRes.json()) as { id?: string };
    const id = published.id ?? "";
    return { externalId: id };
  },
};

export const threadsConnector = makeOAuth2Connector(spec);
