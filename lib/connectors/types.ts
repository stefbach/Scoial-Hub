/**
 * lib/connectors/types.ts
 *
 * Interfaces et types partagés par tous les connecteurs de réseaux sociaux.
 * Chaque plateforme implémente `SocialConnector` pour un contrat unifié.
 */

import type { Platform } from "@/lib/types";

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
  /** Titre d'un lien (FB uniquement). */
  linkTitle?: string;
  /** Description d'un lien (FB uniquement). */
  linkDescription?: string;
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
  platform: Platform;
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
  readonly platform: Platform;

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
   * @param code  Code reçu dans le callback OAuth.
   */
  exchangeCode(code: string): Promise<TokenSet>;

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
