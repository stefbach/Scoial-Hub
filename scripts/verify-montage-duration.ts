// Test autonome (sans réseau ni Shotstack) de la durée d'assemblage du Studio.
// Vérifie la propriété « montage illimité » : un montage vidéo joue TOUS les plans
// bout à bout (film = nb de clips × durée de plan), sans plafond, tandis que le
// diaporama répartit une durée cible. Vérifie aussi que le logo couvre tout le film.
// Lancement : npx tsx scripts/verify-montage-duration.ts

import { buildEdit } from "../lib/video/render";
import type { MediaAsset, PlatformCut } from "../lib/video/types";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function videoAssets(n: number): MediaAsset[] {
  return Array.from({ length: n }, (_, i) => ({ url: `https://x/clip-${i}.mp4`, kind: "video" as const, name: `Clip ${i}` }));
}
function imageAssets(n: number): MediaAsset[] {
  return Array.from({ length: n }, (_, i) => ({ url: `https://x/img-${i}.jpg`, kind: "image" as const, name: `Img ${i}` }));
}

function baseCut(over: Partial<PlatformCut>): PlatformCut {
  return {
    platform: "tiktok", label: "TikTok", aspect: "9:16",
    assemblyType: "video_montage", targetDurationSec: 0,
    hook: "", hookVariants: [], slides: [], overlays: [], musicMood: "", pacing: "",
    editNotes: [], caption: "", hashtags: [], cta: "", thumbnailText: "", renderStatus: "queued",
    ...over,
  };
}

// Extrait les clips médias (dernier track) et le clip logo (premier track).
function tracksOf(edit: ReturnType<typeof buildEdit>) {
  const tracks = (edit.timeline as { tracks: { clips: Array<{ length: number; start: number; asset: { type: string } }> }[] }).tracks;
  const media = tracks[tracks.length - 1].clips;
  return { tracks, media };
}
function totalLength(media: Array<{ length: number; start: number }>): number {
  return media.reduce((s, c) => s + c.length, 0);
}

console.log("\n— 1) Montage = somme des plans (illimité) —");
for (const n of [3, 12, 50, 200]) {
  const per = 5;
  const edit = buildEdit(baseCut({ assemblyType: "video_montage", secondsPerClip: per }), videoAssets(n), []);
  const { media } = tracksOf(edit);
  check(`${n} clips → ${n} plans dans le timeline`, media.length === n, `${media.length}`);
  check(`${n} clips → film = ${n * per}s (somme des plans)`, Math.round(totalLength(media)) === n * per, `${totalLength(media)}s`);
  // Plans posés bout à bout, sans chevauchement.
  const contiguous = media.every((c, i) => i === 0 || c.start === media[i - 1].start + media[i - 1].length);
  check(`${n} clips → plans contigus (start cumulatif)`, contiguous);
}

console.log("\n— 2) Aucun plafond : le film grandit avec le nombre de clips —");
const small = buildEdit(baseCut({ secondsPerClip: 5 }), videoAssets(4), []);
const big = buildEdit(baseCut({ secondsPerClip: 5 }), videoAssets(80), []);
const smallTotal = totalLength(tracksOf(small).media);
const bigTotal = totalLength(tracksOf(big).media);
check("80 clips > 4 clips en durée totale", bigTotal > smallTotal, `${bigTotal}s > ${smallTotal}s`);
check("80 clips dépasse l'ancien plafond de 28s", bigTotal > 28, `${bigTotal}s`);
check("80 clips dépasse même 5 min", bigTotal >= 300, `${bigTotal}s`);

console.log("\n— 3) Le logo couvre tout le film de montage —");
const withLogo = buildEdit(baseCut({ secondsPerClip: 6 }), videoAssets(20), [], "https://x/logo.png");
const { tracks: lt, media: lm } = tracksOf(withLogo);
const logoClip = lt[0].clips[0];
check("logo présent (1er track)", !!logoClip && logoClip.asset.type === "image");
check("logo length = durée du montage (somme des plans)", logoClip.length === totalLength(lm), `${logoClip.length}s vs ${totalLength(lm)}s`);

console.log("\n— 4) Le diaporama répartit la durée cible (comportement inchangé) —");
const slideEdit = buildEdit(baseCut({ assemblyType: "slideshow", targetDurationSec: 30 }), imageAssets(6), []);
const sm = tracksOf(slideEdit).media;
check("6 images → 6 slides", sm.length === 6, `${sm.length}`);
check("diaporama ≈ durée cible (30s), pas la somme illimitée", Math.abs(totalLength(sm) - 30) <= 6, `${totalLength(sm)}s`);

console.log("\n— 5) Vidéo simple (ré-édition) répartit la cible, pas la somme —");
const reedit = buildEdit(baseCut({ assemblyType: "video", targetDurationSec: 20 }), videoAssets(4), []);
const rm = tracksOf(reedit).media;
check("vidéo simple : 4 plans répartis sur ~20s", Math.abs(totalLength(rm) - 20) <= 4, `${totalLength(rm)}s`);

console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
process.exit(failed === 0 ? 0 : 1);
