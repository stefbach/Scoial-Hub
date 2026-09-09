// Vérifie que les modèles vidéo premium (Google Veo 3 / Veo 3 Fast) demandent
// bien le format vertical 9:16 quand l'appelant le demande (TikTok, Reels,
// Stories) — bug réel remonté par un testeur : l'espace TikTok publiait des
// vidéos au format paysage car `buildInput` ignorait complètement l'aspect
// demandé et Veo 3 retombait sur son défaut (16:9) côté Replicate.
// Lancement : npx tsx scripts/verify-video-aspect.ts

import { VIDEO_MODELS } from "../lib/ai/model-catalog";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const veo3 = VIDEO_MODELS.find((m) => m.id === "google/veo-3");
const veo3Fast = VIDEO_MODELS.find((m) => m.id === "google/veo-3-fast");

console.log("\n— google/veo-3 et google/veo-3-fast : ratio vertical forwardé —");
for (const m of [veo3, veo3Fast]) {
  if (!m) {
    check(`modèle trouvé`, false);
    continue;
  }
  for (const aspect of ["9:16", "portrait", "story"]) {
    const input = m.buildInput("un prompt", { aspect }) as { aspect_ratio?: string };
    check(`${m.id} avec aspect="${aspect}" → aspect_ratio: "9:16" envoyé à Replicate`, input.aspect_ratio === "9:16", JSON.stringify(input));
  }
}

console.log("\n— comportement historique préservé pour le paysage/carré —");
for (const m of [veo3, veo3Fast]) {
  if (!m) continue;
  for (const aspect of ["16:9", "landscape", "square"]) {
    const input = m.buildInput("un prompt", { aspect }) as { aspect_ratio?: string };
    check(`${m.id} avec aspect="${aspect}" → aucun aspect_ratio envoyé (défaut Replicate 16:9, jamais 1:1 non supporté)`, input.aspect_ratio === undefined, JSON.stringify(input));
  }
}

console.log("\n— aspect absent : vidRatio() retombe sur le vertical par défaut (convention existante) —");
for (const m of [veo3, veo3Fast]) {
  if (!m) continue;
  const input = m.buildInput("un prompt", {}) as { aspect_ratio?: string };
  check(`${m.id} sans aspect précisé → aspect_ratio: "9:16" (comme les autres modèles vidéo du catalogue)`, input.aspect_ratio === "9:16", JSON.stringify(input));
}

console.log(failed === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
