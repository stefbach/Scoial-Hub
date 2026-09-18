// Vérifie l'intégration Higgsfield en option supplémentaire (lib/ai/higgsfield.ts
// + lib/ai/model-catalog.ts) — sans clé configurée dans cet environnement.
//
// Ce qui est vérifié :
//   1. Dégradation gracieuse : sans identifiants, aucune des fonctions publiques
//      ne lance d'appel réseau — elles renvoient un résultat "simulated".
//   2. Résolution des identifiants : HF_CREDENTIALS / HF_KEY (SDK officiel) ET
//      HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET (repli REST direct)
//      activent tous deux `isHiggsfieldConfigured`.
//   3. Le catalogue expose bien les modèles Higgsfield avec un `path` valide,
//      et ils restent trouvables via getImageModel / getVideoModel.
//
// Usage : npx tsx scripts/verify-higgsfield.ts

import { execFileSync } from "node:child_process";

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/**
 * `isHiggsfieldConfigured` est figé au chargement du module : le vérifier pour
 * plusieurs combinaisons d'env nécessite un process Node séparé par cas (le
 * cache module de tsx/Node ne se laisse pas invalider par un import dynamique
 * dans le même process).
 */
function isConfiguredWithEnv(extraEnv: Record<string, string>): boolean {
  const out = execFileSync(
    process.execPath,
    ["--import", "tsx", "-e", "import('./lib/ai/higgsfield').then(m => console.log((m.default ?? m).isHiggsfieldConfigured))"],
    { cwd: `${__dirname}/..`, env: { ...process.env, ...extraEnv }, encoding: "utf8" }
  );
  return out.trim() === "true";
}

async function main() {
  // Isole l'environnement : ces tests doivent passer que le poste de dev ait
  // ou non des clés Higgsfield déjà exportées dans le shell.
  delete process.env.HF_CREDENTIALS;
  delete process.env.HF_KEY;
  delete process.env.HIGGSFIELD_API_KEY_ID;
  delete process.env.HIGGSFIELD_API_KEY_SECRET;

  console.log("— 1) Dégradation gracieuse (aucune clé) —");
  const {
    isHiggsfieldConfigured,
    generateHiggsfieldImage,
    startHiggsfieldVideo,
    getHiggsfieldVideo,
  } = await import("../lib/ai/higgsfield");

  check("isHiggsfieldConfigured === false sans clé", isHiggsfieldConfigured === false);

  const img = await generateHiggsfieldImage("/higgsfield-ai/soul/standard", { prompt: "test" });
  check("generateHiggsfieldImage → simulated, aucune image", img.simulated === true && img.images.length === 0);

  const vid = await startHiggsfieldVideo("/veo3.1", { prompt: "test" });
  check("startHiggsfieldVideo → simulated", vid.status === "simulated" && vid.simulated === true);

  const status = await getHiggsfieldVideo("fake-id");
  check("getHiggsfieldVideo → simulated", status.status === "simulated" && status.simulated === true);

  console.log("\n— 2) Résolution des identifiants (deux formats) —");
  check("HF_CREDENTIALS seul → configuré", isConfiguredWithEnv({ HF_CREDENTIALS: "id:secret" }));
  check(
    "HIGGSFIELD_API_KEY_ID + SECRET → configuré",
    isConfiguredWithEnv({ HIGGSFIELD_API_KEY_ID: "id", HIGGSFIELD_API_KEY_SECRET: "secret" })
  );
  check("HF_CREDENTIALS mal formé (sans ':') → pas configuré", !isConfiguredWithEnv({ HF_CREDENTIALS: "sans-separateur" }));
  check("aucune variable → pas configuré", !isConfiguredWithEnv({}));

  console.log("\n— 3) Catalogue (lib/ai/model-catalog.ts) —");
  const { IMAGE_MODELS, VIDEO_MODELS, getImageModel, getVideoModel } = await import("../lib/ai/model-catalog");

  const hfImageModels = IMAGE_MODELS.filter((m) => m.provider === "higgsfield");
  check("au moins 1 modèle image Higgsfield", hfImageModels.length >= 1);
  check("modèles image Higgsfield ont un `path`", hfImageModels.every((m) => Boolean(m.path)));

  const hfVideoModels = VIDEO_MODELS.filter((m) => m.provider === "higgsfield");
  check("au moins 1 modèle vidéo Higgsfield", hfVideoModels.length >= 1);
  check("modèles vidéo Higgsfield ont un `path`", hfVideoModels.every((m) => Boolean(m.path)));

  for (const m of hfImageModels) {
    check(`getImageModel("${m.id}") résout le bon modèle`, getImageModel(m.id).id === m.id);
  }
  for (const m of hfVideoModels) {
    // allowPremium requis : ces modèles ne sont pas dans la liste verrouillée.
    check(`getVideoModel("${m.id}") résout le bon modèle (allowPremium)`,
      getVideoModel(m.id, undefined, { allowPremium: true }).id === m.id);
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
