// Un utilisateur a remonté : "LinkedIn a refusé le token du compte" lors
// d'une publication immédiate (via /api/linkedin/publish, le bouton
// "Publier" de la page /linkedin ou d'ArticleStudio). Le token LinkedIn était
// bien mort côté LinkedIn (expiration à 60 j sans refresh token sur ce
// périmètre de scopes, ou révocation) — comportement normal — mais l'app ne
// marquait la connexion comme déconnectée QUE sur le flux cron
// (lib/publishing/publish-scheduled.ts), jamais sur la publication immédiate :
// /accounts et /linkedin continuaient donc d'afficher "Connecté ✓" après
// l'échec, cachant le vrai problème.
//
// Verrouille les deux correctifs :
// 1. app/api/linkedin/publish/route.ts invalide la connexion (comme le cron)
//    quand LinkedIn rejette le token.
// 2. app/api/linkedin/account/route.ts se fie au statut réel de la connexion,
//    pas seulement à la présence d'un token en base (que
//    markConnectionDisconnected conserve volontairement pour diagnostic).
//
// Usage : npx tsx scripts/verify-linkedin-auth-invalidation.ts

import { readFileSync } from "node:fs";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const read = (p: string) => readFileSync(p, "utf8");

console.log("\n— app/api/linkedin/publish/route.ts : invalide la connexion sur token rejeté —");
{
  const route = read("app/api/linkedin/publish/route.ts");
  check("importe isConnectorAuthError", /import \{ isConnectorAuthError \} from "@\/lib\/connectors\/types"/.test(route));
  check("importe markConnectionDisconnected", /markConnectionDisconnected/.test(route));
  check("appelle markConnectionDisconnected uniquement pour une erreur d'authentification (isConnectorAuthError)", /if \(uuid && isConnectorAuthError\(e\)\)/.test(route));
  check("marque le canal \"linkedin\" (pas une autre plateforme par erreur)", /markConnectionDisconnected\(uuid, "linkedin", message\)/.test(route));
}

console.log("\n— app/api/linkedin/account/route.ts : le statut prime sur la présence d'un token —");
{
  const route = read("app/api/linkedin/account/route.ts");
  check("vérifie conn.status === \"connected\", pas seulement le token", /conn\.status !== "connected"/.test(route));
}

console.log(failed === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
