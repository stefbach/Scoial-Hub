// Vérifie la compatibilité des visuels avec les réseaux sociaux
// (lib/media/image-format.ts) : détection WebP (URL + octets) et conversion
// WebP → JPEG. Contexte : LinkedIn (JPG/PNG/GIF) et Instagram (JPEG) refusent
// le WebP — un visuel WebP partait sans image sur le post publié.
//
// Usage : npm run test:imgformat

import sharp from "sharp";
import { isWebpUrl, isWebpBytes, toJpeg } from "../lib/media/image-format";

let failures = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures += 1;
}

async function main() {
  // ── Détection par URL ──────────────────────────────────────────────────────
  check("URL .webp détectée", isWebpUrl("https://x.supabase.co/storage/v1/object/public/sh-videos/a/persist/1-b.webp"));
  check("URL .webp?query détectée", isWebpUrl("https://cdn.test/img.webp?token=abc"));
  check("URL .WEBP (casse) détectée", isWebpUrl("https://cdn.test/IMG.WEBP"));
  check("URL .jpg non détectée", !isWebpUrl("https://cdn.test/img.jpg"));
  check("URL .png non détectée", !isWebpUrl("https://cdn.test/img.png"));
  check("URL contenant 'webp' hors extension non détectée", !isWebpUrl("https://cdn.test/webp-guide.html"));

  // ── Détection par octets + conversion ─────────────────────────────────────
  // Image WebP de test (avec alpha, pour vérifier l'aplatissement JPEG).
  const webp = await sharp({
    create: { width: 24, height: 24, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } },
  }).webp().toBuffer();

  check("octets WebP détectés (RIFF…WEBP)", isWebpBytes(webp));

  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).png().toBuffer();
  check("octets PNG non détectés comme WebP", !isWebpBytes(png));

  const jpeg = await toJpeg(webp);
  check("conversion → signature JPEG (FF D8)", jpeg[0] === 0xff && jpeg[1] === 0xd8);

  const meta = await sharp(jpeg).metadata();
  check("conversion → format jpeg", meta.format === "jpeg");
  check("conversion → dimensions préservées", meta.width === 24 && meta.height === 24);
  check("conversion → alpha aplati (3 canaux)", (meta.channels ?? 0) === 3);

  // Idempotence : un JPEG repasse sans erreur (toJpeg accepte tout format sharp).
  const again = await toJpeg(jpeg);
  check("re-conversion d'un JPEG sans erreur", again[0] === 0xff && again[1] === 0xd8);

  console.log(failures === 0 ? "\nTous les tests passent." : `\n${failures} test(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ erreur inattendue :", e);
  process.exit(1);
});
