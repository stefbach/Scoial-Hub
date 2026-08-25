// Publie le cœur ffmpeg.wasm sous notre propre origine.
//
// L'éditeur chargeait ce moteur depuis unpkg.com : une panne du CDN, ou un
// pare-feu d'entreprise, et le montage devenait impossible sans le moindre
// message (audit A-09). Il est donc servi par /ffmpeg.
//
// Le fichier fait ~32 Mo : il est COPIÉ depuis node_modules à l'installation
// plutôt que versionné. La dépendance @ffmpeg/core est figée dans package.json,
// c'est elle qui fait foi sur la version.
//
// Exécuté par `postinstall` et `prebuild`. Idempotent.

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");
const to = join(root, "public", "ffmpeg");
const FILES = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

if (!existsSync(from)) {
  // Pas une erreur fatale : `npm install --omit=optional` ou une installation
  // partielle ne doivent pas casser le build. L'absence est signalée, et le
  // banc de montage le dira à l'utilisateur au lieu d'échouer en silence.
  console.warn("[ffmpeg] @ffmpeg/core absent — cœur non publié dans /public/ffmpeg");
  process.exit(0);
}

mkdirSync(to, { recursive: true });
for (const name of FILES) {
  const src = join(from, name);
  const dest = join(to, name);
  if (!existsSync(src)) {
    console.warn(`[ffmpeg] introuvable : ${src}`);
    continue;
  }
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
  copyFileSync(src, dest);
  console.log(`[ffmpeg] ${name} publié (${(statSync(dest).size / 1048576).toFixed(1)} Mo)`);
}
