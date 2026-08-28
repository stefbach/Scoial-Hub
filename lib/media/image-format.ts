/**
 * lib/media/image-format.ts
 *
 * Compatibilité des formats d'image avec les réseaux sociaux.
 *
 * Les modèles de génération IA produisent souvent du WebP — un format refusé
 * par les APIs de publication : LinkedIn (Images API : JPG/PNG/GIF) et
 * Instagram (Content Publishing : JPEG). Résultat : le post partait SANS son
 * visuel (LinkedIn dégradait en texte seul, Instagram refusait le conteneur).
 *
 * Ce module (sans dépendance Supabase — testable isolément) fournit :
 *   - la détection d'une image WebP (URL ou octets),
 *   - la conversion WebP → JPEG via sharp (import dynamique : jamais chargé
 *     dans un bundle client).
 */

/** Vrai si l'URL pointe vers un fichier .webp (querystring tolérée). */
export function isWebpUrl(url: string): boolean {
  return /\.webp(\?|$)/i.test(url);
}

/** Vrai si les octets commencent par la signature WebP (RIFF....WEBP). */
export function isWebpBytes(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

/**
 * Convertit une image (WebP ou autre) en JPEG publiable partout.
 * L'alpha éventuel est aplati sur fond blanc (JPEG ne gère pas la
 * transparence). Qualité 92 : visuellement sans perte pour du social.
 */
export async function toJpeg(buf: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buf).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
}
