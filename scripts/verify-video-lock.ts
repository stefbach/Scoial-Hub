// Vérifie le verrouillage du modèle vidéo sur Facebook/Instagram/LinkedIn
// (lib/ai/model-catalog.ts) — sur ces réseaux, on ne propose JAMAIS les API
// vidéo les plus chères (Veo 3, Kling, Seedance Pro…), seulement 1-2 modèles
// au meilleur rapport qualité/prix.
//
// Ce qui est vérifié :
//   1. La liste verrouillée ne contient que des modèles économiques, jamais
//      les API premium.
//   2. `videoModelsForPlatform` renvoie la liste verrouillée pour
//      facebook/instagram/linkedin (et l'alias "instagram_reels" utilisé par
//      VideoDirector), et le catalogue complet pour tiktok / aucun réseau.
//   3. `getVideoModel(id, platform)` fait foi CÔTÉ SERVEUR : un id premium
//      envoyé pour un réseau verrouillé ne doit jamais être retourné tel
//      quel — il retombe sur le modèle autorisé par défaut.
//
// Usage : npm run test:videolock

import {
  VIDEO_MODELS,
  SHORT_FORM_VIDEO_MODELS,
  videoModelsForPlatform,
  isLockedVideoPlatform,
  getVideoModel,
} from "../lib/ai/model-catalog";

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const PREMIUM_IDS = ["google/veo-3", "google/veo-3-fast", "kwaivgi/kling-v2.1", "bytedance/seedance-1-pro"];
const LOCKED_PLATFORMS = ["facebook", "instagram", "linkedin", "instagram_reels"];

async function main() {
  console.log("— 1) La liste verrouillée exclut les API premium —");
  check("1 ou 2 modèles verrouillés (jamais plus)",
    SHORT_FORM_VIDEO_MODELS.length >= 1 && SHORT_FORM_VIDEO_MODELS.length <= 2,
    `${SHORT_FORM_VIDEO_MODELS.length} modèle(s)`);
  for (const premium of PREMIUM_IDS) {
    check(`${premium} absent de la liste verrouillée`,
      !SHORT_FORM_VIDEO_MODELS.some((m) => m.id === premium));
  }
  check("tous les modèles verrouillés existent bien dans le catalogue",
    SHORT_FORM_VIDEO_MODELS.every((m) => VIDEO_MODELS.some((v) => v.id === m.id)));

  console.log("\n— 2) videoModelsForPlatform / isLockedVideoPlatform —");
  for (const p of LOCKED_PLATFORMS) {
    check(`${p} → verrouillé`, isLockedVideoPlatform(p));
    const list = videoModelsForPlatform(p);
    check(`${p} → liste = SHORT_FORM_VIDEO_MODELS`, list.length === SHORT_FORM_VIDEO_MODELS.length &&
      list.every((m, i) => m.id === SHORT_FORM_VIDEO_MODELS[i].id));
  }
  check("tiktok → pas verrouillé", !isLockedVideoPlatform("tiktok"));
  check("tiktok → catalogue complet", videoModelsForPlatform("tiktok").length === VIDEO_MODELS.length);
  check("aucun réseau → catalogue complet", videoModelsForPlatform(undefined).length === VIDEO_MODELS.length);

  console.log("\n— 3) getVideoModel(id, platform) fait foi côté serveur —");
  for (const p of ["facebook", "instagram", "linkedin"]) {
    for (const premium of PREMIUM_IDS) {
      const resolved = getVideoModel(premium, p);
      check(`${p} + id premium (${premium}) → jamais renvoyé tel quel`,
        resolved.id !== premium, `résolu : ${resolved.id}`);
      check(`${p} + id premium (${premium}) → repli sur un modèle verrouillé`,
        SHORT_FORM_VIDEO_MODELS.some((m) => m.id === resolved.id));
    }
    // Un id déjà autorisé pour ce réseau doit rester inchangé.
    const allowedId = SHORT_FORM_VIDEO_MODELS[0].id;
    check(`${p} + id déjà autorisé → conservé`, getVideoModel(allowedId, p).id === allowedId);
  }
  check("tiktok + Veo 3 → conservé (pas de verrou)", getVideoModel("google/veo-3", "tiktok").id === "google/veo-3");
  check("aucun réseau + Veo 3 → conservé (comportement historique)",
    getVideoModel("google/veo-3").id === "google/veo-3");

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
