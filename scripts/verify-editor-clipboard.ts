// Presse-papier du banc de montage (audit Editing Bench v4, constat 4).
//
// Le clic droit n'ouvrait le menu du banc que sur une sélection de GROUPE ;
// partout ailleurs c'était celui de Chrome. Le menu porte maintenant sur tout
// élément et sur le vide d'une piste, et il apporte avec lui couper/copier/
// coller — des opérations de MODÈLE, vérifiées ici sans passer par l'interface.
//
// Ce que le presse-papier doit garantir, et que ce script prouve :
//   1. couper = copier puis supprimer — le contenu reste collable APRÈS coup ;
//   2. coller pose une COPIE : de nouveaux identifiants, jamais les mêmes ;
//   3. un groupe collé conserve les ÉCARTS de temps entre ses éléments ;
//   4. chaque élément retrouve SA piste, et se rabat sur une piste de sa
//      famille si l'originale a disparu.
//
// Usage : npm run test:montagepressepapier

import {
  addAudio, addClip, addText, copyElements, emptyProject, pasteElements,
  removeTrack, type EditorProject,
} from "../lib/editor/project";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-copie-${(seq += 1)}`;

/** Un montage simple : deux plans bout à bout, un texte et une musique. */
function sample(): EditorProject {
  let p = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 6 });
  p = addClip(p, { id: "b", src: "b.mp4", kind: "video", sourceDuration: 4 });
  p = addText(p, "titre", "Bonjour", 1);
  p = addAudio(p, { id: "musique", src: "m.mp3", name: "Musique", role: "music" });
  return p;
}

function main() {
  // ── Copier ne touche pas au document ────────────────────────────────────
  {
    const p = sample();
    const entries = copyElements(p, [{ kind: "clip", id: "a" }]);
    check("copier prélève bien l'élément désigné", entries.length === 1 && entries[0].kind === "clip");
    check("copier ne retire rien du montage", p.clips.length === 2);
  }

  // ── Coller pose une COPIE, pas l'original ───────────────────────────────
  {
    const p = sample();
    const entries = copyElements(p, [{ kind: "clip", id: "a" }]);
    const after = pasteElements(p, entries, 20, nextId);
    check("coller ajoute un plan", after.clips.length === 3, `${after.clips.length}`);
    const ids = after.clips.map((c) => c.id);
    check("le plan collé porte un identifiant NEUF", new Set(ids).size === ids.length, ids.join(","));
    check("l'original reste en place", ids.includes("a"));
    const copie = after.clips.find((c) => c.id !== "a" && c.id !== "b");
    check("la copie garde la source de l'original", copie?.src === "a.mp4");
  }

  // ── Couper puis coller : le contenu survit à la suppression ─────────────
  {
    const p = sample();
    // Couper = prélever AVANT de supprimer. On simule ici l'ordre exact de
    // l'interface, qui est la seule chose qui rend l'opération sûre : prélever
    // après suppression ne trouverait plus rien.
    const entries = copyElements(p, [{ kind: "text", id: "titre" }]);
    const cut: EditorProject = { ...p, texts: p.texts.filter((l) => l.id !== "titre") };
    check("couper retire le texte du montage", cut.texts.length === 0);

    const pasted = pasteElements(cut, entries, 3, nextId);
    check("le texte coupé reste collable", pasted.texts.length === 1);
    check("le texte collé garde son contenu", pasted.texts[0]?.text === "Bonjour");
    check("le texte collé démarre à l'instant demandé", Math.abs(pasted.texts[0]!.start - 3) < 0.01,
      `${pasted.texts[0]?.start}`);
  }

  // ── Un groupe garde ses écarts de temps ─────────────────────────────────
  {
    const p = sample();
    const titre = p.texts.find((l) => l.id === "titre")!;
    // Un second texte, décalé de 2 s par rapport au premier.
    const withSecond: EditorProject = {
      ...p,
      texts: [...p.texts, { ...titre, id: "sous-titre", text: "Suite", start: titre.start + 2, end: titre.end + 2 }],
    };
    const entries = copyElements(withSecond, [
      { kind: "text", id: "sous-titre" },
      { kind: "text", id: "titre" },
    ]);
    check("le presse-papier est trié par instant de début", entries[0]?.data.start! <= entries[1]?.data.start!);

    const pasted = pasteElements(withSecond, entries, 5, nextId);
    const copies = pasted.texts.filter((l) => l.id !== "titre" && l.id !== "sous-titre").sort((a, b) => a.start - b.start);
    check("les deux textes sont collés", copies.length === 2, `${copies.length}`);
    check("le premier se pose à l'instant demandé", Math.abs(copies[0]!.start - 5) < 0.01, `${copies[0]?.start}`);
    check("le second conserve son écart de 2 s", Math.abs(copies[1]!.start - copies[0]!.start - 2) < 0.01,
      `${copies[1]?.start} - ${copies[0]?.start}`);
  }

  // ── La DURÉE d'un calque est reportée, pas sa borne de fin ──────────────
  {
    const p = sample();
    const titre = p.texts.find((l) => l.id === "titre")!;
    const span = titre.end - titre.start;
    const entries = copyElements(p, [{ kind: "text", id: "titre" }]);

    const pasted = pasteElements(p, entries, 0, nextId);
    const copie = pasted.texts.find((l) => l.id !== "titre")!;
    check("le calque collé garde sa durée quand elle tient dans le film",
      Math.abs((copie.end - copie.start) - span) < 0.01, `${copie.end - copie.start} au lieu de ${span}`);

    // Un calque ne dépasse jamais la fin du film — invariant de `normalize`,
    // pas une particularité du collage. Coller près de la fin le raccourcit
    // donc, plutôt que d'allonger le montage à son insu.
    const late = pasteElements(p, entries, 9, nextId);
    const tardive = late.texts.find((l) => l.id !== "titre")!;
    const total = late.clips.reduce((max, c) => Math.max(max, c.start + c.length), 0);
    check("collé près de la fin, il s'arrête AVEC le film",
      Math.abs(tardive.end - total) < 0.01, `${tardive.end} au lieu de ${total}`);
  }

  // ── Chaque élément retrouve SA piste ────────────────────────────────────
  {
    let p = sample();
    p = addClip(p, { id: "incrust", src: "i.mp4", kind: "video", sourceDuration: 3, track: 1, start: 1 });
    const source = p.clips.find((c) => c.id === "incrust")!;
    const entries = copyElements(p, [{ kind: "clip", id: "incrust" }]);
    const pasted = pasteElements(p, entries, 12, nextId);
    const copie = pasted.clips.find((c) => c.id !== "a" && c.id !== "b" && c.id !== "incrust")!;
    check("la copie reste sur la piste de l'original", copie.trackId === source.trackId,
      `${copie.trackId} au lieu de ${source.trackId}`);
  }

  // ── Piste disparue : repli sur une piste de la même famille ─────────────
  {
    let p = sample();
    p = addClip(p, { id: "incrust", src: "i.mp4", kind: "video", sourceDuration: 3, track: 1, start: 1 });
    const source = p.clips.find((c) => c.id === "incrust")!;
    const entries = copyElements(p, [{ kind: "clip", id: "incrust" }]);

    // La piste d'origine est supprimée APRÈS la copie — exactement le cas du
    // « couper, puis supprimer la piste, puis coller ».
    const shrunk = removeTrack(p, source.trackId);
    check("la piste d'origine a bien disparu", !(shrunk.tracks ?? []).some((tr) => tr.id === source.trackId));

    const pasted = pasteElements(shrunk, entries, 12, nextId);
    const copie = pasted.clips.find((c) => c.src === "i.mp4");
    check("l'élément est quand même collé", Boolean(copie));
    check("il rejoint une piste visuelle existante",
      Boolean(copie && (pasted.tracks ?? []).some((tr) => tr.id === copie.trackId && tr.family === "visual")),
      copie?.trackId);
  }

  // ── Un son collé reste sur une piste SONORE ─────────────────────────────
  {
    const p = sample();
    const entries = copyElements(p, [{ kind: "audio", id: "musique" }]);
    const pasted = pasteElements(p, entries, 2, nextId);
    const copie = pasted.audios.find((a) => a.id !== "musique")!;
    check("le son collé existe", Boolean(copie));
    check("il est posé sur une piste de la famille sonore",
      (pasted.tracks ?? []).some((tr) => tr.id === copie.trackId && tr.family === "audio"), copie?.trackId);
  }

  // ── Presse-papier vide : rien ne bouge ──────────────────────────────────
  {
    const p = sample();
    check("coller un presse-papier vide renvoie le projet inchangé", pasteElements(p, [], 4, nextId) === p);
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
