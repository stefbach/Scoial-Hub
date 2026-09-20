// Retour client : « la sélection Higgsfield ne fonctionne pas ». La demande
// est acceptée par l'UI (case « Autoriser les modèles premium » + <select>),
// mais getVideoModel (lib/ai/model-catalog.ts) retombe silencieusement sur un
// autre modèle quand le plan réel de la société ne débride pas le premium
// (lib/plans.ts, vérité serveur) — et la réponse ne disait jusqu'ici jamais
// au client quel modèle avait réellement tourné. La sélection semblait n'avoir
// servi à rien, sans aucun message pour l'expliquer.
//
// Usage : npm run test:videomodelswap

import { videoModelSwapNotice } from "../lib/ai/generate-video-client";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const t = (fr: string, en: string) => fr;

console.log("\n— videoModelSwapNotice —");

check(
  "modèle demandé conservé → aucun message",
  videoModelSwapNotice("higgsfield/veo3.1", "higgsfield/veo3.1", t) === null
);
check(
  "modèle demandé absent (undefined) → aucun message",
  videoModelSwapNotice(undefined, "bytedance/seedance-1-lite", t) === null
);
check(
  "modèle utilisé absent (undefined) → aucun message",
  videoModelSwapNotice("higgsfield/veo3.1", undefined, t) === null
);
check(
  "Higgsfield demandé mais retombé sur un autre modèle → message explicite",
  (() => {
    const msg = videoModelSwapNotice("higgsfield/veo3.1", "bytedance/seedance-1-lite", t);
    return msg !== null && /formule/i.test(msg) && /premium/i.test(msg);
  })()
);
check(
  "le message ne fuite jamais un id de modèle brut à l'écran",
  (() => {
    const msg = videoModelSwapNotice("higgsfield/veo3.1", "bytedance/seedance-1-lite", t) ?? "";
    return !/higgsfield\/veo3\.1/i.test(msg) && !/bytedance\/seedance-1-lite/i.test(msg);
  })()
);

console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
process.exit(failed === 0 ? 0 : 1);
