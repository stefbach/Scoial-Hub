// Test autonome (sans navigateur) de la géométrie de déclinaison du Studio Affiche.
// Vérifie : dimensions correctes des formats réseaux + propriété « aucune coupe »
// du mode déclinaison (containRect) vs recadrage du mode plein cadre (coverRect).
// Lancement : npx tsx scripts/verify-affiche-layout.ts

import { DECLINE_SET, coverRect, containRect, FORMATS } from "../lib/affiche/layout";

let failed = 0;
const EPS = 0.5;
function check(name: string, cond: boolean, detail = "") {
  const ok = cond;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// Dimensions officielles attendues par plateforme.
const EXPECTED: Record<string, [number, number]> = {
  "ig-pt": [1080, 1350], "ig-sq": [1080, 1080], "ig-story": [1080, 1920],
  "fb-feed": [1080, 1350], "fb-land": [1200, 630], "fb-story": [1080, 1920],
  "li-land": [1200, 627], "li-sq": [1080, 1080], "li-pt": [1080, 1350],
};

console.log("\n— 1) Dimensions des formats réseaux —");
for (const f of DECLINE_SET) {
  const exp = EXPECTED[f.id];
  check(`format ${f.id} = ${f.w}×${f.h}`, !!exp && f.w === exp[0] && f.h === exp[1], exp ? `attendu ${exp[0]}×${exp[1]}` : "inconnu");
}
check("9 formats déclinés", DECLINE_SET.length === 9, `${DECLINE_SET.length}`);
check("tous les ids existent dans FORMATS", DECLINE_SET.every((f) => FORMATS.some((g) => g.id === f.id)));

// Sources types : portrait 4:5, carré 1:1, paysage 16:9, story 9:16.
const SOURCES: [string, number, number][] = [
  ["portrait 4:5", 1024, 1280], ["carré 1:1", 1024, 1024],
  ["paysage 16:9", 1280, 720], ["story 9:16", 720, 1280],
];

console.log("\n— 2) Mode déclinaison (containRect) : AUCUNE coupe —");
for (const [sname, iw, ih] of SOURCES) {
  for (const f of DECLINE_SET) {
    const r = containRect(iw, ih, f.w, f.h);
    // L'image entière doit tenir dans le cadre (rien ne dépasse → rien n'est coupé).
    const insideW = r.dw <= f.w + EPS;
    const insideH = r.dh <= f.h + EPS;
    // Et elle doit toucher au moins un bord (occupe le cadre au mieux, centrée).
    const fills = Math.abs(r.dw - f.w) < EPS || Math.abs(r.dh - f.h) < EPS;
    const centered = Math.abs(r.dx - (f.w - r.dw) / 2) < EPS && Math.abs(r.dy - (f.h - r.dh) / 2) < EPS;
    check(`${sname} → ${f.id} : image entière visible`, insideW && insideH && fills && centered,
      `dessin ${Math.round(r.dw)}×${Math.round(r.dh)} dans ${f.w}×${f.h}`);
  }
}

console.log("\n— 3) Mode plein cadre (coverRect) : remplit tout le cadre —");
for (const [sname, iw, ih] of SOURCES) {
  for (const f of DECLINE_SET) {
    const r = coverRect(iw, ih, f.w, f.h);
    const covers = r.dw >= f.w - EPS && r.dh >= f.h - EPS;
    check(`${sname} → ${f.id} : cadre rempli`, covers, `dessin ${Math.round(r.dw)}×${Math.round(r.dh)}`);
  }
}

console.log("\n— 4) Preuve du bug corrigé : cover recadre, contain non (1:1 → 9:16) —");
{
  const story = DECLINE_SET.find((f) => f.id === "ig-story")!;
  const cov = coverRect(1024, 1024, story.w, story.h);
  const con = containRect(1024, 1024, story.w, story.h);
  // cover recadre dès qu'une dimension dépasse le cadre (ici la largeur).
  check("cover déborde (donc recadre) en 9:16", cov.dw > story.w + EPS || cov.dh > story.h + EPS,
    `dessin ${Math.round(cov.dw)}×${Math.round(cov.dh)} dans ${story.w}×${story.h}`);
  check("contain ne déborde pas (aucune coupe)", con.dw <= story.w + EPS && con.dh <= story.h + EPS,
    `dessin ${Math.round(con.dw)}×${Math.round(con.dh)}`);
}

console.log(`\n${failed === 0 ? "✅ TOUS LES TESTS PASSENT" : `❌ ${failed} test(s) en échec`}\n`);
process.exit(failed === 0 ? 0 : 1);
