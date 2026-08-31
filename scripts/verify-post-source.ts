// Retour client (réunion Rosiane, points #3 et #4) :
//
// #3 — Les publications créées via « Post Series » apparaissaient comme
//      « Manual » dans l'historique : PostSource n'avait pas de valeur dédiée,
//      et la trace écrite dans l'historique re-dérivait la provenance depuis
//      `automationName` seul, écrasant toujours en « manual » ce qui n'était
//      pas une automatisation.
// #4 — Documenté séparément (app/(organic)/compose/page.tsx) : modifier une
//      publication programmée PATCHe désormais la ligne d'origine au lieu
//      d'en créer une nouvelle. Pas de logique pure à isoler ici (dépend du
//      DOM/routeur) — vérifié en lecture de code, pas par ce script.
//
// Lancement : npm run test:postsource

import { postSourceLabel } from "../lib/types";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const t = (fr: string, en: string) => fr; // langue fixée au français pour le test

console.log("\n— postSourceLabel (bug #3) —");
check("« series » a son propre libellé, distinct de « manual »",
  postSourceLabel("series", t) === "Depuis une série");
check("« manual » reste « Manuel »", postSourceLabel("manual", t) === "Manuel");
check("« automation » sans nom reste générique", postSourceLabel("automation", t) === "Automatisation");
check("« automation » avec nom l'inclut",
  postSourceLabel("automation", t, "Relance panier").includes("Relance panier"));
check("une valeur inconnue (ancienne donnée, jamais 'series' avant ce correctif) replie sur Manuel",
  postSourceLabel("", t) === "Manuel");

console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
process.exit(failed === 0 ? 0 : 1);
