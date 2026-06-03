// Génération d'IMAGES finales via Cloudinary (transformations à la volée, "fetch").
// Recadrage au format réseau + titre incrusté lisible (bordure noire).
// Aucune signature requise pour les URLs de delivery → seul le cloud name suffit.
// Cloud name : CLOUDINARY_CLOUD_NAME ou extrait de CLOUDINARY_URL (…@<cloud>).

import type { MediaAsset, PlatformCut } from "./types";

const SIZE: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};

export function cloudName(): string {
  if (process.env.CLOUDINARY_CLOUD_NAME) return process.env.CLOUDINARY_CLOUD_NAME;
  const url = process.env.CLOUDINARY_URL ?? "";
  const m = url.match(/@([^/?#\s]+)/);
  return m ? m[1] : "";
}

export const isCloudinaryConfigured = (): boolean => Boolean(cloudName());

/** Nettoie un texte pour l'overlay Cloudinary (retire emojis/caractères spéciaux). */
function sanitize(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}\s!?.'&%-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Construit l'URL d'une image recadrée + titre incrusté. */
export function buildBrandedImage(sourceUrl: string, aspect: string, text: string): string {
  const cn = cloudName();
  if (!cn || !sourceUrl) return sourceUrl;
  const [w, h] = SIZE[aspect] ?? SIZE["9:16"];
  const parts = [`c_fill,g_auto,w_${w},h_${h}`];
  const clean = sanitize(text || "");
  if (clean) {
    const enc = encodeURIComponent(clean);
    const fs = Math.round(w * 0.07);
    parts.push(
      `l_text:Arial_${fs}_bold:${enc},co_white,bo_5px_solid_black,g_south,y_${Math.round(h * 0.09)},w_${Math.round(w * 0.86)},c_fit`
    );
  }
  return `https://res.cloudinary.com/${cn}/image/fetch/${parts.join("/")}/${encodeURIComponent(sourceUrl)}`;
}

/** Produit la liste d'images finales pour un livrable statique (carrousel/collage/single). */
export function buildImagesForCut(cut: PlatformCut, assets: MediaAsset[]): string[] {
  const images = assets.filter((a) => a.kind === "image");
  if (images.length === 0) return [];
  const aspect = cut.aspect;

  if (cut.assemblyType === "single") {
    return [buildBrandedImage(images[0].url, aspect, cut.hook || cut.thumbnailText)];
  }

  // carrousel / collage / autres formats statiques → une image par slide.
  const slides = cut.slides.length > 0 ? cut.slides : images.map((_, i) => ({ index: i + 1, onImageText: "", note: "" }));
  const out: string[] = [];
  slides.slice(0, 8).forEach((s, i) => {
    const src = images[i % images.length].url;
    out.push(buildBrandedImage(src, aspect, s.onImageText));
  });
  return out;
}
