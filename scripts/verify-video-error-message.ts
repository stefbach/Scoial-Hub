// Retour client (réunion Rosiane, point #8 — « la génération vidéo ne marche
// pas ») : la cause la plus fréquente n'est pas une panne mais une formule
// qui n'inclut pas la vidéo IA (Présence = 0 s/mois) ou un quota mensuel
// épuisé. Le serveur renvoie déjà un message précis pour ce cas
// (lib/quota/video-seconds.ts, refusal()), mais chaque écran appelant
// generateVideoPolling l'ignorait et affichait un message générique de panne
// technique — faisant passer une restriction de formule pour un bug.
//
// Usage : npm run test:videoerrormsg

import { videoGenErrorMessage } from "../lib/ai/generate-video-client";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const t = (fr: string, en: string) => fr;

const QUOTA_REASON =
  "La génération de vidéo par IA n'est pas incluse dans la formule Présence. " +
  "Passez en Studio pour en disposer, ou utilisez le montage de vos propres médias, illimité.";

console.log("\n— videoGenErrorMessage —");

check(
  "une raison SERVEUR réelle (ex. quota/formule) est affichée telle quelle",
  videoGenErrorMessage(QUOTA_REASON, t) === QUOTA_REASON
);
check(
  "un message de quota atteint (avec des chiffres) passe aussi tel quel",
  videoGenErrorMessage("Quota de vidéo IA atteint : 58 s utilisées sur 60 s ce mois-ci.", t).includes("58 s")
);
check("« timeout » (code interne) devient un message de délai, pas le mot brut",
  videoGenErrorMessage("timeout", t) !== "timeout" && /temps/i.test(videoGenErrorMessage("timeout", t)));
check("« network » (code interne) devient un message réseau, pas le mot brut",
  videoGenErrorMessage("network", t) !== "network" && /réseau/i.test(videoGenErrorMessage("network", t)));
check("« no-id » (code interne) ne fuite jamais tel quel à l'écran",
  videoGenErrorMessage("no-id", t) !== "no-id");
check("« failed »/« canceled » (codes internes) ne fuient jamais tels quels",
  videoGenErrorMessage("failed", t) !== "failed" && videoGenErrorMessage("canceled", t) !== "canceled");
check("undefined (aucun détail) retombe sur un message générique, pas vide",
  videoGenErrorMessage(undefined, t).length > 0);

console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
process.exit(failed === 0 ? 0 : 1);
