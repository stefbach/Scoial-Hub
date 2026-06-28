// lib/social-series.ts
//
// Configuration DÉCLARATIVE des contraintes « série » par réseau social.
// Source unique partagée par l'API de génération (/api/ai/social-series) et le
// composant générique SeriesPlanner. Chaque réseau a ses limites propres
// (longueur, média requis, format, mode de diffusion).

export type SeriesPlatform = "facebook" | "instagram" | "twitter" | "pinterest" | "tiktok";

export interface SeriesConfig {
  platform: SeriesPlatform;
  label: string;
  color: string;
  /** Longueur max du texte/légende (caractères). */
  maxChars: number;
  /**
   * Exigence de média :
   * - "none"     : aucun média
   * - "optional" : image facultative
   * - "image"    : image OBLIGATOIRE (Instagram, Pinterest)
   * - "video"    : vidéo OBLIGATOIRE (TikTok)
   */
  media: "none" | "optional" | "image" | "video";
  /** Formats de contenu disponibles. */
  formats: ("post" | "article")[];
  /**
   * Diffusion :
   * - "schedule" : programmation auto via le cron (Facebook, Instagram).
   * - "publish"  : « Publier maintenant » via le connecteur (Twitter, Pinterest,
   *                TikTok — pas encore dans le moteur de programmation auto).
   */
  delivery: "schedule" | "publish";
  /** Pinterest : un board cible est requis. */
  needsBoard?: boolean;
}

export const SERIES_CONFIG: Record<SeriesPlatform, SeriesConfig> = {
  facebook: {
    platform: "facebook", label: "Facebook", color: "#1877F2",
    maxChars: 2000, media: "optional", formats: ["post", "article"], delivery: "schedule",
  },
  instagram: {
    platform: "instagram", label: "Instagram", color: "#E1306C",
    maxChars: 2200, media: "image", formats: ["post"], delivery: "schedule",
  },
  twitter: {
    platform: "twitter", label: "Twitter / X", color: "#000000",
    maxChars: 280, media: "optional", formats: ["post"], delivery: "publish",
  },
  pinterest: {
    platform: "pinterest", label: "Pinterest", color: "#E60023",
    maxChars: 500, media: "image", formats: ["post"], delivery: "publish", needsBoard: true,
  },
  tiktok: {
    platform: "tiktok", label: "TikTok", color: "#000000",
    maxChars: 2200, media: "video", formats: ["post"], delivery: "publish",
  },
};

export function isSeriesPlatform(value: string): value is SeriesPlatform {
  return value in SERIES_CONFIG;
}
