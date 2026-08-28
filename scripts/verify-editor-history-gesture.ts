// Historique groupé par GESTE, pas par tic de pointeur (itération 3, chapitre
// 9, point 3 ; Lot 2).
//
// Un glissement continu à la souris (déplacer un plan, rogner un calque,
// redimensionner une forme) appelait `push` à chaque déplacement du pointeur
// — sur un geste de deux secondes, cela pouvait produire des dizaines
// d'entrées, et une annulation ne défaisait alors qu'un pixel à la fois.
// `replacePresent`/`commitGesture` sont les fonctions pures qui corrigent
// cela : voir leur usage dans components/editor/StudioEditor.tsx.
//
// Usage : npm run test:montagegeste

import { addText, emptyProject, updateText } from "../lib/editor/project";
import { canUndo, commitGesture, HISTORY_LIMIT, initHistory, push, replacePresent, undo } from "../lib/editor/history";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function main() {
  const p0 = emptyProject("c", "p");
  const p1 = addText(p0, "t", "Bonjour");

  // ── Un geste simulé : dix ticks de glissement ────────────────────────────
  {
    let h = initHistory(p1);
    const baseline = h.present;
    for (let x = 0; x < 10; x += 1) {
      h = replacePresent(h, updateText(h.present, "t", { x: x / 100 }));
    }
    check("les tics intermédiaires ne créent aucune entrée", h.past.length === 0, String(h.past.length));
    check("l'état courant reflète le dernier tic", h.present.texts[0].x === 0.09, String(h.present.texts[0].x));

    h = commitGesture(h, baseline);
    check("la clôture du geste ajoute UNE SEULE entrée", h.past.length === 1, String(h.past.length));
    check("cette entrée est l'état d'AVANT le geste", h.past[0] === baseline);

    h = undo(h);
    check("annuler défait le geste ENTIER, pas un pixel", h.present === baseline);
    check("plus rien à annuler après un seul geste", !canUndo(h));
  }

  // ── Un clic sans glisser ne doit rien empiler ────────────────────────────
  {
    let h = initHistory(p1);
    const baseline = h.present;
    h = replacePresent(h, h.present); // aucun changement réel
    h = commitGesture(h, baseline);
    check("un geste sans effet ne crée aucune entrée", h.past.length === 0, String(h.past.length));
  }

  // ── Deux gestes consécutifs restent deux entrées distinctes ──────────────
  {
    let h = initHistory(p1);
    const b1 = h.present;
    h = replacePresent(h, updateText(h.present, "t", { x: 0.5 }));
    h = commitGesture(h, b1);
    const afterFirst = h.present;

    const b2 = h.present;
    h = replacePresent(h, updateText(h.present, "t", { y: 0.5 }));
    h = commitGesture(h, b2);

    check("deux gestes distincts produisent deux entrées", h.past.length === 2, String(h.past.length));
    h = undo(h);
    check("annuler le second geste restaure l'état après le premier", h.present === afterFirst);
  }

  // ── Un geste peut suivre une action normale (push) sans les mélanger ─────
  {
    let h = initHistory(p1);
    h = push(h, addText(h.present, "t2", "Deuxième"));
    const afterPush = h.present;

    const baseline = h.present;
    h = replacePresent(h, updateText(h.present, "t2", { x: 0.3 }));
    h = commitGesture(h, baseline);

    check("le push précédent reste sa propre entrée", h.past[0] === p1);
    check("le geste suivant devient une entrée séparée", h.past[1] === afterPush, String(h.past.length));
  }

  // ── replacePresent respecte aussi la borne de profondeur au moment du commit ──
  {
    let h = initHistory(p1);
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) h = push(h, addText(h.present, `pad${i}`, "x"));
    const baseline = h.present;
    h = replacePresent(h, updateText(h.present, "t", { x: 0.7 }));
    h = commitGesture(h, baseline);
    check("la pile reste bornée après un geste", h.past.length === HISTORY_LIMIT, String(h.past.length));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
