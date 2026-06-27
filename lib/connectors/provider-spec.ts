/**
 * lib/connectors/provider-spec.ts
 *
 * Fabrique de connecteurs OAuth 2.0 DÉCLARATIFS.
 *
 * Objectif : ajouter un réseau social = écrire UN objet de configuration
 * (`OAuth2ProviderSpec`), pas un connecteur de 250 lignes ni 3 routes API.
 * La très grande majorité des plateformes (Twitter/X, Pinterest, Threads,
 * Mastodon, Reddit, YouTube…) suivent le même flux « authorization_code » :
 * cette fabrique le factorise une fois pour toutes.
 *
 * Dégradation gracieuse : tant que les credentials (env) sont absents, le
 * connecteur fonctionne en MODE SIMULÉ (aucun appel réseau, identifiants et
 * publications factices cohérents) — exactement comme les connecteurs Meta et
 * LinkedIn historiques. La couche appelante reste donc identique.
 *
 * Aucun appel réseau au chargement du module.
 */

import type {
  SocialConnector,
  ConnectorPlatform,
  TokenSet,
  PublishInput,
  PublishResult,
  PostMetrics,
} from "@/lib/connectors/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Spécification déclarative d'un provider OAuth 2.0
// ---------------------------------------------------------------------------

/** Contexte transmis à l'adaptateur de publication d'un provider. */
export interface PublishContext extends PublishInput {
  /** Identifiant de plateforme (utile pour les adaptateurs partagés). */
  platform: ConnectorPlatform;
}

/**
 * Description d'un réseau social joignable via le flux OAuth 2.0 standard.
 * Tout est optionnel sauf le strict nécessaire : un provider minimal = nom +
 * endpoints + scopes. Les adaptateurs (`fetchAccount`, `publish`, `metrics`)
 * branchent le comportement réel quand les credentials sont présents.
 */
export interface OAuth2ProviderSpec {
  /** Identifiant interne de la plateforme. */
  platform: ConnectorPlatform;
  /** Nom lisible (logs, UI). */
  label: string;

  /** Nom de la variable d'env contenant le client_id. */
  clientIdEnv: string;
  /** Nom de la variable d'env contenant le client_secret. */
  clientSecretEnv: string;

  /** URL d'autorisation (où l'on redirige l'utilisateur). */
  authorizeUrl: string;
  /** Endpoint d'échange du code contre un token. */
  tokenUrl: string;
  /** Scopes OAuth demandés. */
  scopes: string[];
  /** Séparateur de scopes dans l'URL (défaut : espace). */
  scopeSeparator?: string;

  /**
   * Mode d'authentification au token endpoint :
   * - "body"  : client_id + client_secret dans le corps (défaut)
   * - "basic" : en-tête Authorization: Basic base64(id:secret)
   */
  tokenAuth?: "body" | "basic";

  /**
   * Active PKCE en méthode "plain". Le `code_verifier` est porté par le
   * paramètre `state` (opaque, déjà anti-CSRF) — suffisant pour la méthode
   * plain où challenge === verifier. Requis par Twitter/X.
   */
  pkce?: "plain";

  /** Préfixe des identifiants simulés (mode mock). */
  simPrefix: string;

  /**
   * Récupère l'identité du compte connecté après obtention du token.
   * Optionnel : si absent, on stocke le token sans externalId enrichi.
   */
  fetchAccount?: (accessToken: string) => Promise<{ externalId?: string; accountName?: string }>;

  /**
   * Adaptateur de publication RÉEL. Si absent, la publication en mode
   * configuré lève une erreur HONNÊTE (pas de faux succès) : le contenu est
   * prêt mais l'API d'écriture n'est pas encore branchée pour ce réseau.
   */
  publish?: (ctx: PublishContext) => Promise<PublishResult>;

  /** Adaptateur de métriques réel (optionnel). */
  metrics?: (externalId: string, accessToken?: string) => Promise<PostMetrics>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simulatedId(prefix: string): string {
  return `${prefix}_simulated_${Date.now()}`;
}

function simulatedMetrics(): PostMetrics {
  return {
    reactions: Math.floor(Math.random() * 100) + 5,
    comments: Math.floor(Math.random() * 25) + 1,
    shares: Math.floor(Math.random() * 18),
    linkClicks: Math.floor(Math.random() * 45) + 3,
    reach: Math.floor(Math.random() * 1800) + 150,
    impressions: Math.floor(Math.random() * 4500) + 400,
    simulated: true,
  };
}

/** URL de callback générique : une seule route dynamique sert tous les providers. */
function redirectUri(platform: ConnectorPlatform): string {
  return `${APP_URL}/api/connectors/${platform}/callback`;
}

/** Le `state` OAuth porte aussi le code_verifier PKCE (méthode plain). */
function verifierFromState(state: string): string {
  // Borne à 128 caractères (limite RFC 7636) et nettoie les caractères hors set.
  return state.replace(/[^A-Za-z0-9._~-]/g, "").slice(0, 128) || "verifier";
}

// ---------------------------------------------------------------------------
// Fabrique
// ---------------------------------------------------------------------------

/**
 * Construit un `SocialConnector` complet à partir d'une spec déclarative.
 * Lecture des credentials différée (au moment des appels), pas au chargement.
 */
export function makeOAuth2Connector(spec: OAuth2ProviderSpec): SocialConnector {
  const sep = spec.scopeSeparator ?? " ";

  const clientId = () => (process.env[spec.clientIdEnv] ?? "").trim();
  const clientSecret = () => (process.env[spec.clientSecretEnv] ?? "").trim();
  const configured = () => Boolean(clientId()) && Boolean(clientSecret());

  return {
    platform: spec.platform,

    isConfigured: () => configured(),

    getAuthUrl(state: string): string {
      if (!configured()) {
        return `${APP_URL}/accounts?simulated=true&platform=${spec.platform}&state=${encodeURIComponent(state)}`;
      }

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId(),
        redirect_uri: redirectUri(spec.platform),
        scope: spec.scopes.join(sep),
        state,
      });

      if (spec.pkce === "plain") {
        params.set("code_challenge", verifierFromState(state));
        params.set("code_challenge_method", "plain");
      }

      return `${spec.authorizeUrl}?${params.toString()}`;
    },

    async exchangeCode(code: string, state?: string): Promise<TokenSet> {
      if (!configured()) {
        return {
          accessToken: `simulated_${spec.simPrefix}_token_${Date.now()}`,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          externalId: simulatedId(spec.simPrefix),
          accountName: `${spec.label} (simulé)`,
          raw: { simulated: true },
        };
      }

      const form = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(spec.platform),
      });
      if (spec.pkce === "plain") form.set("code_verifier", verifierFromState(state ?? ""));

      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      };
      if (spec.tokenAuth === "basic") {
        const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
        headers.Authorization = `Basic ${basic}`;
      } else {
        form.set("client_id", clientId());
        form.set("client_secret", clientSecret());
      }

      const res = await fetch(spec.tokenUrl, { method: "POST", headers, body: form.toString() });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error_description?: string; error?: string; message?: string };
          detail = body.error_description ?? body.error ?? body.message ?? detail;
        } catch {
          /* corps non parsable */
        }
        throw new Error(`${spec.label} token exchange → ${detail}`);
      }

      const token = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      let externalId: string | undefined;
      let accountName: string | undefined;
      if (spec.fetchAccount) {
        try {
          const info = await spec.fetchAccount(token.access_token);
          externalId = info.externalId;
          accountName = info.accountName;
        } catch (e) {
          console.warn(`[${spec.platform}] fetchAccount échoué :`, (e as Error).message);
        }
      }

      return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt:
          token.expires_in && token.expires_in > 0
            ? Math.floor(Date.now() / 1000) + token.expires_in
            : undefined,
        externalId,
        accountName: accountName ?? spec.label,
        raw: token as unknown as Record<string, unknown>,
      };
    },

    async publishPost(input: PublishInput): Promise<PublishResult> {
      if (!configured() || !input.accessToken || input.accessToken.startsWith("simulated_")) {
        const simId = simulatedId(`${spec.simPrefix}_post`);
        return { externalId: simId, simulated: true };
      }
      if (!spec.publish) {
        throw new Error(
          `Publication ${spec.label} non disponible : l'adaptateur d'écriture n'est pas encore branché. Le contenu est prêt — publiez-le manuellement en attendant.`
        );
      }
      return spec.publish({ ...input, platform: spec.platform });
    },

    async getMetrics(externalId: string, accessToken?: string): Promise<PostMetrics> {
      if (!configured() || externalId.includes("simulated") || !spec.metrics) {
        return simulatedMetrics();
      }
      return spec.metrics(externalId, accessToken);
    },
  };
}
