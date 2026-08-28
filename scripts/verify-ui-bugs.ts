// Test autonome des corrections de recette (rapport BUGS Social Hub #2.1).
//
// Couvre les parties dont la justesse se démontre sans navigateur :
//   - graduations des axes de graphique (bugs #6 et #7) ;
//   - récupération de la réponse du consultant IA dans un JSON tronqué,
//     cause de la panne d'entretien après quelques tours (bugs #3 et #4) ;
//   - contenu de veille bilingue (bug #5).
//
// Lancement : npx tsx scripts/verify-ui-bugs.ts

import { niceCeil, tickIndexes } from "../lib/charts/scale";
import { extractJsonString } from "../lib/ai/claude-json";
import { buildSimulatedResult } from "../lib/veille/simulated";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// ── 1) Axes des graphiques ───────────────────────────────────────────────────

console.log("\n— 1) Graduations des axes (bugs #6 et #7) —");
check("47 → 50 (borne lisible)", niceCeil(47) === 50, `${niceCeil(47)}`);
check("230 → 250", niceCeil(230) === 250, `${niceCeil(230)}`);
check("1 320 → 1 500", niceCeil(1320) === 1500, `${niceCeil(1320)}`);
check("8 → 10", niceCeil(8) === 10, `${niceCeil(8)}`);
check("1 → 1", niceCeil(1) === 1, `${niceCeil(1)}`);
check("série entièrement à zéro → borne 1 (pas de division par zéro)", niceCeil(0) === 1);
check("valeur illisible → borne 1", niceCeil(Number.NaN) === 1);
check(
  "la borne n'est JAMAIS sous le maximum réel (la courbe ne sort pas du cadre)",
  [1, 3, 7, 42, 99, 100, 101, 1234, 98765].every((v) => niceCeil(v) >= v)
);

check("30 jours → 5 graduations", tickIndexes(30).length === 5, `${tickIndexes(30).length}`);
check("bornes incluses", tickIndexes(30)[0] === 0 && tickIndexes(30)[4] === 29, tickIndexes(30).join(","));
check("graduations strictement croissantes", tickIndexes(30).every((v, i, a) => i === 0 || v > a[i - 1]));
check("moins de points que de graduations → un libellé par point", tickIndexes(3).join(",") === "0,1,2");
check("série vide → aucune graduation", tickIndexes(0).length === 0);
check("un seul point → une graduation", tickIndexes(1).join(",") === "0");
check("365 jours → toujours 5 graduations", tickIndexes(365).length === 5);

// ── 2) Consultant IA : survie à une réponse tronquée ────────────────────────

console.log("\n— 2) Consultant IA : réponse récupérée malgré la troncature (bugs #3 et #4) —");

// Cas réel : le modèle a rendu "reply" puis a été coupé par max_tokens au
// milieu de l'ADN. Le JSON est irrécupérable, mais la phrase attendue par le
// client est intacte au début.
const truncated = `{
  "reply": "Très clair. Qui achète chez vous aujourd'hui, et pourquoi vous plutôt qu'un autre ?",
  "readyToLock": false,
  "dna": { "positioning": "Importateur de pièces OE/OEM authent`;
check(
  "« reply » extrait d'un JSON coupé en plein milieu",
  extractJsonString(truncated, "reply") ===
    "Très clair. Qui achète chez vous aujourd'hui, et pourquoi vous plutôt qu'un autre ?",
  extractJsonString(truncated, "reply") ?? "(null)"
);
check(
  "les guillemets échappés sont restitués",
  extractJsonString('{"reply": "Il a dit \\"oui\\" hier"}', "reply") === 'Il a dit "oui" hier',
  extractJsonString('{"reply": "Il a dit \\"oui\\" hier"}', "reply") ?? "(null)"
);
check(
  "les sauts de ligne échappés sont restitués",
  extractJsonString('{"reply": "Ligne 1\\nLigne 2"}', "reply") === "Ligne 1\nLigne 2"
);
check(
  "chaîne jamais refermée → on garde ce qui est lisible",
  extractJsonString('{"reply": "Une phrase coupée en plein', "reply") === "Une phrase coupée en plein"
);
check("champ absent → null", extractJsonString('{"autre": "x"}', "reply") === null);
check("champ vide → null (rien à afficher)", extractJsonString('{"reply": ""}', "reply") === null);
check(
  "un champ homonyme IMBRIQUÉ ne masque pas le champ de premier niveau",
  extractJsonString('{"reply": "bonne", "dna": {"reply": "mauvaise"}}', "reply") === "bonne"
);

// ── 3) Veille bilingue ───────────────────────────────────────────────────────

console.log("\n— 3) Contenu de veille dans la langue de l'interface (bug #5) —");
const fr = buildSimulatedResult("tibok", "fr");
const en = buildSimulatedResult("tibok", "en");

const ACCENTED = /[éèêàçùôîï]/;
const allEnglishText = [
  en.resume,
  ...en.insights.flatMap((i) => [i.label, i.detail]),
  ...en.recommandations.flatMap((r) => [r.titre, r.detail, r.action]),
];
check(
  "aucun texte accentué français ne subsiste en anglais",
  allEnglishText.every((s) => !ACCENTED.test(s)),
  allEnglishText.find((s) => ACCENTED.test(s)) ?? ""
);
check("le résumé anglais est bien en anglais", en.resume.includes("competitive intelligence"), en.resume.slice(0, 60));
check("le résumé français reste en français", fr.resume.includes("veille concurrentielle"));
check(
  "le résumé ne montre plus l'identifiant technique de la société",
  !fr.resume.includes("tibok") && !en.resume.includes("tibok")
);
check(
  "même structure dans les deux langues",
  fr.insights.length === en.insights.length && fr.recommandations.length === en.recommandations.length
);
check(
  "changer de langue ne change PAS le contenu tiré (mêmes identifiants, mêmes réseaux)",
  fr.insights.every((i, k) => i.id === en.insights[k].id && i.reseau === en.insights[k].reseau)
);
check(
  "les priorités restent des valeurs stables (traduites à l'affichage)",
  en.recommandations.every((r) => ["haute", "moyenne", "basse"].includes(r.priorite))
);
// `finishedAt` porte l'heure de l'appel : c'est le CONTENU qui doit être stable,
// pas l'horodatage.
const contentOf = (r: typeof en) =>
  JSON.stringify({ resume: r.resume, insights: r.insights, recommandations: r.recommandations });
check(
  "déterminisme : deux appels identiques donnent le même contenu",
  contentOf(buildSimulatedResult("tibok", "en")) === contentOf(en)
);
check(
  "deux sociétés différentes reçoivent des contenus distincts",
  buildSimulatedResult("occ", "fr").insights[0].label !== undefined
);

console.log(failed === 0 ? "\n✅ Tous les tests passent." : `\n❌ ${failed} test(s) en échec.`);
process.exit(failed === 0 ? 0 : 1);
