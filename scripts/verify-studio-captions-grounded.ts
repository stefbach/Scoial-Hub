// Vérifie que les sous-titres/captions produits par le Studio Créatif reflètent
// le contenu RÉEL des plans (voix off / texte du Réalisateur IA) quand il est
// connu, au lieu d'accroches marketing génériques sans rapport avec la vidéo
// (retour client — « les captions n'ont rien à voir avec la vidéo générée »).
// Sans clé ANTHROPIC_API_KEY, marketizeVideo() retombe sur le paquet déterministe
// (buildMock) : ce test tourne donc sans réseau ni service externe.
// Lancement : npx tsx scripts/verify-studio-captions-grounded.ts

import { marketizeVideo } from "../lib/video/marketer";
import type { MediaAsset } from "../lib/video/types";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  console.log("\n— 1) Clips notés (Réalisateur IA) → captions alignées sur le contenu réel —");
  const notedAssets: MediaAsset[] = [
    { url: "https://x/clip-0.mp4", kind: "video", name: "Scène 1", note: "Le café coule lentement dans la tasse en céramique blanche." },
    { url: "https://x/clip-1.mp4", kind: "video", name: "Scène 2", note: "Un barista sourit en tendant le café au client." },
  ];
  const pkg1 = await marketizeVideo({
    assets: notedAssets,
    assembly: "video_montage",
    objective: "vendre notre nouveau café",
    platforms: ["tiktok"],
    brandVoice: "chaleureux",
    lang: "fr",
  });
  check("2 plans notés → 2 segments de sous-titres", pkg1.captions.length === 2, `${pkg1.captions.length}`);
  check(
    "segment 1 = la note du plan 1 (pas une accroche générique)",
    pkg1.captions[0]?.text === notedAssets[0].note,
    pkg1.captions[0]?.text
  );
  check(
    "segment 2 = la note du plan 2",
    pkg1.captions[1]?.text === notedAssets[1].note,
    pkg1.captions[1]?.text
  );
  check("segment 1 démarre à 0s (1er plan du montage)", pkg1.captions[0]?.start === 0);
  check("segment 2 démarre à 5s (2e plan, PER_CLIP=5)", pkg1.captions[1]?.start === 5);

  console.log("\n— 2) Vidéo SANS note connue → repli sur les accroches génériques (comportement existant) —");
  const blindAssets: MediaAsset[] = [{ url: "https://x/clip-0.mp4", kind: "video", name: "Scène 1" }];
  const pkg2 = await marketizeVideo({
    assets: blindAssets,
    assembly: "video",
    objective: "vendre notre nouveau café",
    platforms: ["tiktok"],
    brandVoice: "chaleureux",
    lang: "fr",
  });
  check("aucune note connue → 5 sous-titres génériques (repli inchangé)", pkg2.captions.length === 5, `${pkg2.captions.length}`);

  console.log("\n— 3) Montage MIXTE (photos + vidéos) → la note suit l'INDEX RÉEL du plan, pas l'index parmi les seules vidéos —");
  const mixedAssets: MediaAsset[] = [
    { url: "https://x/img-0.jpg", kind: "image", name: "Photo 1" },
    { url: "https://x/clip-0.mp4", kind: "video", name: "Scène 1", note: "Gros plan sur le produit fini." },
  ];
  const pkg3 = await marketizeVideo({
    assets: mixedAssets,
    assembly: "video_montage",
    objective: "présenter le produit",
    platforms: ["tiktok"],
    brandVoice: "pro",
    lang: "fr",
  });
  check("1 seul plan noté (la vidéo, en 2e position) → 1 segment", pkg3.captions.length === 1, `${pkg3.captions.length}`);
  check(
    "le segment démarre à 5s (2e plan du montage, pas 0s)",
    pkg3.captions[0]?.start === 5,
    `${pkg3.captions[0]?.start}`
  );

  console.log(failed === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failed} ÉCHEC(S)`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
