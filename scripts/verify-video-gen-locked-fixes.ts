// Un utilisateur a remonté : "problème concernant la génération des vidéos
// au niveau des espaces LinkedIn Facebook et Instagram". Investigation :
// trois bugs distincts affectant précisément ces réseaux verrouillés
// (lib/ai/model-catalog.ts : LOCKED_VIDEO_PLATFORMS).
//
// Bug 1 — minimax/hailuo-02 (1er modèle verrouillé, donc utilisé par défaut) :
//   demander 10 s ne fixait jamais `resolution`, qui retombe alors sur le
//   défaut implicite Replicate "1080p" — combo 10s+1080p REJETÉ par l'API
//   (seul 768p ou 512p est accepté à 10 s). Toute génération de 10 s sur
//   Facebook/Instagram/LinkedIn échouait donc systématiquement.
// Bug 2 — minimax/hailuo-02 n'expose AUCUN paramètre `aspect_ratio` en
//   texte→vidéo : il ne peut donc jamais produire de format vertical 9:16,
//   pourtant requis par Instagram (Reels, seul format vidéo dispo) et par un
//   Reel Facebook/LinkedIn. Corrigé en le retirant de la liste verrouillée :
//   seul bytedance/seedance-1-lite (qui respecte fidèlement aspect_ratio)
//   y reste.
// Bug 3 — components/compose/ComposeAgent.tsx forçait `aspect: "9:16"` en dur
//   pour toute vidéo générée par l'agent IA de Compose, quel que soit le
//   réseau ciblé — un post Facebook (16:9 attendu) recevait donc une vidéo
//   verticale. Corrigé avec resolveVideoAspect(videoLockPlatform), comme le
//   fait déjà l'appel image juste en dessous pour son propre format.
//
// Usage : npx tsx scripts/verify-video-gen-locked-fixes.ts

import { readFileSync } from "node:fs";
import { SHORT_FORM_VIDEO_MODELS, getVideoModel } from "../lib/ai/model-catalog";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const read = (p: string) => readFileSync(p, "utf8");

console.log("\n— Bug 1 : Hailuo-02, 10 s ⇒ resolution 768p (jamais le défaut 1080p) —");
{
  const hailuo = getVideoModel("minimax/hailuo-02");
  const at10 = hailuo.buildInput("prompt", { seconds: 10 }) as Record<string, unknown>;
  const at6 = hailuo.buildInput("prompt", { seconds: 6 }) as Record<string, unknown>;
  check("10 s → resolution: 768p", at10.resolution === "768p", JSON.stringify(at10));
  check("10 s → duration: 10", at10.duration === 10);
  check("6 s (défaut) → pas de resolution forcée", at6.resolution === undefined, JSON.stringify(at6));
}

console.log("\n— Bug 2 : réseaux verrouillés (FB/IG/LinkedIn) — Hailuo-02 exclu —");
{
  check(
    "SHORT_FORM_VIDEO_MODELS n'inclut plus minimax/hailuo-02",
    !SHORT_FORM_VIDEO_MODELS.some((m) => m.id === "minimax/hailuo-02")
  );
  check(
    "SHORT_FORM_VIDEO_MODELS conserve bytedance/seedance-1-lite (respecte aspect_ratio)",
    SHORT_FORM_VIDEO_MODELS.some((m) => m.id === "bytedance/seedance-1-lite")
  );
  check("au moins un modèle reste disponible pour ces réseaux", SHORT_FORM_VIDEO_MODELS.length >= 1);
  const seedanceLite = getVideoModel("bytedance/seedance-1-lite", "instagram");
  const out = seedanceLite.buildInput("prompt", { aspect: "9:16" }) as Record<string, unknown>;
  check("le modèle verrouillé par défaut honore bien aspect_ratio: 9:16", out.aspect_ratio === "9:16", JSON.stringify(out));
}

console.log("\n— Bug 3 : ComposeAgent.tsx — aspect vidéo dépendant du réseau ciblé —");
{
  const src = read("components/compose/ComposeAgent.tsx");
  check("importe resolveVideoAspect", /import \{ resolveVideoAspect \} from "@\/lib\/social-formats"/.test(src));
  check(
    "n'utilise plus aspect: \"9:16\" en dur pour la génération vidéo",
    !/aspect:\s*"9:16"/.test(src)
  );
  check(
    "utilise resolveVideoAspect(videoLockPlatform) pour l'aspect vidéo",
    /aspect:\s*resolveVideoAspect\(videoLockPlatform\)/.test(src)
  );
}

console.log(failed === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
