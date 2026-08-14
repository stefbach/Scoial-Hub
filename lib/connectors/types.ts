/**
 * lib/connectors/types.ts
 *
 * Interfaces et types partagés par tous les connecteurs de réseaux sociaux.
 * Chaque plateforme implémente `SocialConnector` pour un contrat unifié.
 */

import type { Platform, TikTokPublishOptions } from "@/lib/types";

// ---------------------------------------------------------------------------
// Plateformes gérées par la couche connecteurs
// ---------------------------------------------------------------------------

/**
 * Surensemble de `Platform` réservé au sous-système de connecteurs.
 *
 * `Platform` (lib/types) est volontairement laissé inchangé : il est utilisé
 * dans des dizaines de `Record<Platform, …>` exhaustifs à travers l'app. Les
 * nouveaux réseaux (Twitter/X, Pinterest, Threads…) n'existent QUE dans la
 * couche publication/connexion : on les ajoute donc ici sans rien casser
 * ailleurs. Ajouter un réseau = étendre cette union + 1 objet de config
 * (aucune nouvelle route, aucun nouveau connecteur écrit à la main).
 */
export type ConnectorPlatform = Platform | "twitter" | "pinterest" | "threads";

// ---------------------------------------------------------------------------
// Erreurs d'authentification
// ---------------------------------------------------------------------------

/**
 * Le fournisseur a rejeté le token du compte (expiré, révoqué, mauvais profil).
 *
 * Distincte d'une erreur réseau : réessayer à l'identique ne peut PAS aboutir,
 * seule une reconnexion du compte le peut. La couche publication s'en sert pour
 * marquer la connexion `disconnected` et arrêter la boucle de réessais, au lieu
 * d'échouer silencieusement toutes les 10 minutes (cas Tibok : jeton Facebook
 * invalide depuis le 13/07 sans que personne ne le voie).
 */
export class ConnectorAuthError extends Error {
  readonly platform: string;

  constructor(platform: string, message: string) {
    super(message);
    this.name = "ConnectorAuthError";
    this.platform = platform;
  }
}

/** Vrai si l'erreur signale un token rejeté par le fournisseur. */
export function isConnectorAuthError(err: unknown): err is ConnectorAuthError {
  return err instanceof ConnectorAuthError;
}

// ---------------------------------------------------------------------------
// Token OAuth
// ---------------------------------------------------------------------------

/** Jeu de tokens renvoyé après l'échange du code OAuth. */
export interface TokenSet {
  /** Token d'accès (short-lived ou long-lived selon la plateforme). */
  accessToken: string;
  /** Token de rafraîchissement, présent si la plateforme le fournit. */
  refreshToken?: string;
  /** Timestamp UNIX (secondes) d'expiration de l'access token. */
  expiresAt?: number;
  /** Identifiant externe de l'utilisateur / compte côté plateforme. */
  externalId?: string;
  /** Nom lisible du compte (page, profil…). */
  accountName?: string;
  /** Champs supplémentaires libres renvoyés par la plateforme. */
  raw?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Publication
// ---------------------------------------------------------------------------

/** Média joint à une publication. */
export interface MediaAttachment {
  /** URL publique accessible (image ou vidéo). */
  url: string;
  /** Légende à associer au média. */
  caption?: string;
  /** Type MIME, ex. "image/jpeg" ou "video/mp4". */
  mimeType?: string;
}

/** Paramètres d'une publication organique. */
export interface PublishInput {
  /** Identifiant externe du compte (page_id, ig_user_id, URN LinkedIn…). */
  externalAccountId: string;
  /** Token d'accès du compte, issu de social_accounts. */
  accessToken: string;
  /** Texte principal du post. */
  text: string;
  /** URL à partager dans le post (optionnel). */
  link?: string;
  /** Média joint (image ou vidéo). */
  media?: MediaAttachment;
  /**
   * Emplacement de publication (Meta uniquement) : fil, Story éphémère 24 h ou
   * Reel. Absent → "feed" (comportement historique). Les autres connecteurs
   * l'ignorent.
   */
  postType?: "feed" | "story" | "reel";
  /** Titre d'un lien (FB uniquement). */
  linkTitle?: string;
  /** Description d'un lien (FB uniquement). */
  linkDescription?: string;
  /** Réglages Content Posting API (TikTok uniquement) — ignoré par les autres connecteurs. */
  tiktok?: TikTokPublishOptions;
}

/** Résultat d'une publication organique. */
export interface PublishResult {
  /** Identifiant de la publication côté plateforme. */
  externalId: string;
  /** URL publique du post publié, si disponible. */
  url?: string;
  /**
   * Vrai si le résultat est simulé (pas de vraie publication effectuée).
   * Utilisé quand les clés API sont absentes ou le compte non connecté.
   */
  simulated?: boolean;
}

// ---------------------------------------------------------------------------
// Métriques
// ---------------------------------------------------------------------------

/** Métriques de performance d'un post publié. */
export interface PostMetrics {
  /** Nombre de réactions / likes. */
  reactions: number;
  /** Nombre de commentaires. */
  comments: number;
  /** Nombre de partages / reposts. */
  shares: number;
  /** Nombre de clics sur les liens. */
  linkClicks: number;
  /** Portée organique (nombre de comptes uniques touchés). */
  reach?: number;
  /** Nombre d'impressions totales. */
  impressions?: number;
  /** Vrai si les métriques sont simulées. */
  simulated?: boolean;
}

// ---------------------------------------------------------------------------
// Campagnes publicitaires
// ---------------------------------------------------------------------------

/** Objectif d'une campagne publicitaire. */
export type CampaignObjective =
  | "AWARENESS"
  | "TRAFFIC"
  | "ENGAGEMENT"
  | "LEADS"
  | "APP_PROMOTION"
  | "SALES";

/** Paramètres de création d'une campagne pub. */
export interface CampaignInput {
  /** Identifiant du compte publicitaire (act_XXXXX pour Meta, URN pour LinkedIn). */
  adAccountId: string;
  /** Token d'accès. */
  accessToken: string;
  /** Nom de la campagne. */
  name: string;
  /** Objectif publicitaire. */
  objective: CampaignObjective;
  /** Budget journalier en centimes (EUR). */
  dailyBudgetCents?: number;
  /** Date de début ISO. */
  startDate?: string;
  /** Date de fin ISO (optionnel). */
  endDate?: string;
  /** Statut initial ("ACTIVE" | "PAUSED"). */
  status?: "ACTIVE" | "PAUSED";
}

// ---------------------------------------------------------------------------
// Statut connecteur
// ---------------------------------------------------------------------------

/** Statut de configuration et connexion d'un connecteur. */
export interface ConnectorStatus {
  /** Identifiant de la plateforme. */
  platform: ConnectorPlatform;
  /** True si les variables d'env requises (app credentials) sont présentes. */
  configured: boolean;
  /** Nombre de comptes actifs enregistrés dans social_accounts. */
  connectedAccounts: number;
  /** Liste des comptes connectés (nom + id externe). */
  accounts: {
    id: string;
    accountName: string;
    externalId?: string;
    status: "active" | "expired" | "revoked";
    /** URL publique du compte/Page (destination réelle), si connue. */
    url?: string;
  }[];
}

// ---------------------------------------------------------------------------
// Interface principale du connecteur
// ---------------------------------------------------------------------------

/**
 * Contrat unifié qu'implémente chaque connecteur de plateforme sociale.
 * Les méthodes qui nécessitent des credentials réseau se dégradent
 * gracieusement (valeur simulée) si la configuration est absente.
 */
export interface SocialConnector {
  /** Identifiant de la plateforme gérée par ce connecteur. */
  readonly platform: ConnectorPlatform;

  /**
   * Indique si les variables d'environnement minimales sont présentes
   * pour effectuer de vraies requêtes API (app credentials).
   */
  isConfigured(): boolean;

  /**
   * Construit l'URL d'autorisation OAuth vers laquelle rediriger l'utilisateur.
   * @param state  Valeur opaque à inclure dans le paramètre `state` (CSRF).
   */
  getAuthUrl(state: string): string;

  /**
   * Échange le code d'autorisation OAuth contre un jeu de tokens.
   * @param code   Code reçu dans le callback OAuth.
   * @param state  Valeur `state` reçue au callback (porte le code_verifier PKCE
   *               pour les providers qui l'exigent, ex. Twitter/X). Optionnel.
   */
  exchangeCode(code: string, state?: string): Promise<TokenSet>;

  /**
   * Publie un post organique sur la plateforme.
   * Retourne `{ simulated: true }` si les credentials sont absents.
   */
  publishPost(input: PublishInput): Promise<PublishResult>;

  /**
   * Récupère les métriques d'un post publié.
   * @param externalId  Identifiant de la publication côté plateforme.
   */
  getMetrics(externalId: string): Promise<PostMetrics>;

  /**
   * Crée une campagne publicitaire (optionnel — Meta Marketing API & LinkedIn Ads).
   * Retourne un `externalId` côté plateforme.
   */
  createCampaign?(input: CampaignInput): Promise<{ externalId: string }>;
}
