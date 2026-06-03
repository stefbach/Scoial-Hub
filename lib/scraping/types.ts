// Types partagés pour le dispositif de veille & benchmark concurrentiel.

export type ScrapeNetwork =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "twitter"
  | "facebook";

export type ContentType = "post" | "video" | "reel" | "story";

/** Un contenu scrappé/collecté d'un compte concurrent. */
export interface CompetitorContent {
  /** Réseau social source. */
  network: ScrapeNetwork;
  /** Handle / identifiant du compte (ex. "@marque", "UCxxxx"). */
  handle: string;
  /** Nom affiché du compte. */
  accountName?: string;
  /** Type de contenu. */
  type: ContentType;
  /** URL directe du post / vidéo (peut être vide si non accessible publiquement). */
  url: string;
  /** Texte de la publication (caption, titre, description). */
  caption: string;
  /** Nombre de likes / réactions. */
  likes: number;
  /** Nombre de commentaires. */
  comments: number;
  /** Nombre de vues (vues ou impressions). */
  views: number;
  /** Nombre de partages (0 si indisponible). */
  shares: number;
  /** Taux d'engagement estimé (likes+comments / views), entre 0 et 1. */
  engagementRate: number;
  /** Date de publication ISO 8601. */
  postedAt: string;
  /** Miniature URL (optionnel). */
  thumbnailUrl?: string;
  /** Marqueur indiquant que la donnée est simulée (pas réelle). */
  simulated?: boolean;
}

/** Paramètres d'une requête de scraping. */
export interface ScrapeQuery {
  /** Zone géographique cible (ex. "fr", "be"). */
  geo: string;
  /** Mots-clés / hashtags recherchés. */
  keywords: string[];
  /** Thématique globale (ex. "Mode durable", "Fintech B2B"). */
  theme: string;
  /** Handles des compétiteurs à cibler. */
  competitors: { network: ScrapeNetwork; handle: string; name?: string }[];
  /** Nombre max de contenus à collecter par réseau (défaut 20). */
  limit?: number;
  /** Auth Instagram Business Discovery (API Meta officielle, données réelles). */
  igAuth?: { businessId: string; token: string };
}

/** Résultat d'une collecte. */
export interface ScrapeResult {
  /** Contenus collectés. */
  contents: CompetitorContent[];
  /** Réseaux ayant fonctionné en mode réel (non simulé). */
  realNetworks: ScrapeNetwork[];
  /** Réseaux en mode simulé. */
  simulatedNetworks: ScrapeNetwork[];
  /** Durée de la collecte en ms. */
  durationMs: number;
  /** Horodatage de la collecte. */
  collectedAt: string;
}
