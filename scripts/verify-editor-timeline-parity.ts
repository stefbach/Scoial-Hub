// Parité de manipulation dans la timeline (itération 3, Lot 2, C-04).
//
// Avant ce chantier, seuls les plans vidéo se rognaient et se déplaçaient à
// la souris ; textes, formes, incrustations et pistes audio ne se réglaient
// qu'au clavier dans le panneau de propriétés. Ces contrôles couvrent les
// fonctions pures qui comblent cet écart : trimLayer, moveLayerTime et les
// duplicateXxx, communes aux quatre familles de calques temporels.
//
// Usage : npm run test:montageparite

import {
  addAudio, addClip, addImageLayer, addShape, addText, duplicateAudio,
  duplicateImageLayer, duplicateShape, duplicateText, emptyProject,
  MIN_CLIP_SECONDS, moveLayerTime, trimLayer, updateAudio, updateImageLayer,
  updateShape, updateText, type EditorProject,
} from "../lib/editor/project";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) < eps;

/** Film de 20 s, un texte sur [4,10]. */
function withText(): EditorProject {
  let p = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 20 });
  p = addText(p, "t1", "Bonjour");
  p = updateText(p, "t1", { start: 4, end: 10 });
  return p;
}

function main() {
  // ── Rognage — quatre familles, même comportement ─────────────────────────
  {
    const p = withText();
    const trimmedHead = trimLayer(p, "text", "t1", "head", 2);
    const t = trimmedHead.texts[0];
    check("rogner le début avance le début, pas la fin", near(t.start, 6) && near(t.end, 10), `${t.start}..${t.end}`);

    const trimmedTail = trimLayer(p, "text", "t1", "tail", 3);
    const tt = trimmedTail.texts[0];
    check("rogner la fin recule la fin, pas le début", near(tt.start, 4) && near(tt.end, 7), `${tt.start}..${tt.end}`);

    const excessive = trimLayer(p, "text", "t1", "head", 999);
    const et = excessive.texts[0];
    check("un rognage excessif laisse une durée plancher",
      et.end - et.start >= MIN_CLIP_SECONDS - 0.001, String(et.end - et.start));

    check("rogner un calque introuvable ne change rien", trimLayer(p, "text", "inexistant", "head", 1) === p);
  }

  // ── Rognage — forme et incrustation suivent la même règle que le texte ───
  {
    let p = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 20 });
    p = addShape(p, "s1", "rect", "#123456");
    p = updateShape(p, "s1", { start: 2, end: 8 });
    const trimmed = trimLayer(p, "shape", "s1", "head", 1);
    check("une forme se rogne comme un texte", near(trimmed.shapes[0].start, 3), String(trimmed.shapes[0].start));

    p = addImageLayer(p, "i1", "logo.png");
    p = updateImageLayer(p, "i1", { start: 2, end: 8 });
    const trimmedImg = trimLayer(p, "image", "i1", "tail", 2);
    check("une incrustation se rogne comme un texte", near(trimmedImg.images[0].end, 6), String(trimmedImg.images[0].end));
  }

  // ── Rognage audio — avance aussi le point d'entrée, comme un plan ────────
  {
    let p = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 20 });
    p = addAudio(p, { id: "m", src: "m.mp3", name: "M", role: "music", sourceDuration: 20 });
    p = updateAudio(p, "m", { start: 0, length: 10, trimStart: 0 });
    const trimmed = trimLayer(p, "audio", "m", "head", 3);
    const a = trimmed.audios[0];
    check("rogner le début d'une piste son avance trimStart", near(a.trimStart, 3), String(a.trimStart));
    check("et raccourcit sans déplacer la fin", near(a.start, 3) && near(a.length, 7), `${a.start}+${a.length}`);
  }

  // ── Déplacement — conserve la durée, quel que soit le type ───────────────
  {
    const p = withText();
    const moved = moveLayerTime(p, "text", "t1", 12);
    const t = moved.texts[0];
    check("déplacer conserve la durée d'origine", near(t.end - t.start, 6), String(t.end - t.start));
    check("déplacer change le début", near(t.start, 12), String(t.start));
    check("un déplacement négatif est ramené à zéro", near(moveLayerTime(p, "text", "t1", -5).texts[0].start, 0));

    let pa = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 20 });
    pa = addAudio(pa, { id: "m", src: "m.mp3", name: "M", role: "music", sourceDuration: 20 });
    pa = updateAudio(pa, "m", { start: 0, length: 5 });
    const movedAudio = moveLayerTime(pa, "audio", "m", 8);
    check("déplacer une piste son conserve sa durée", near(movedAudio.audios[0].length, 5), String(movedAudio.audios[0].length));
  }

  // ── Duplication — les quatre familles, posée juste après l'original ──────
  {
    const p = withText();
    const dup = duplicateText(p, "t1", "t1-copie");
    check("dupliquer un texte insère juste après l'original",
      near(dup.texts[1].start, 10) && near(dup.texts[1].end, 16), `${dup.texts[1].start}..${dup.texts[1].end}`);
    check("l'original reste inchangé", near(dup.texts[0].start, 4) && near(dup.texts[0].end, 10));
    check("dupliquer un texte introuvable ne change rien", duplicateText(p, "inexistant", "x") === p);

    let ps = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 10 });
    ps = addShape(ps, "s1", "round", "#123456");
    check("dupliquer une forme la double", duplicateShape(ps, "s1", "s1-copie").shapes.length === 2);

    let pi = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 10 });
    pi = addImageLayer(pi, "i1", "logo.png");
    check("dupliquer une incrustation la double", duplicateImageLayer(pi, "i1", "i1-copie").images.length === 2);

    let pa = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 20 });
    pa = addAudio(pa, { id: "m", src: "m.mp3", name: "M", role: "music", sourceDuration: 5 });
    const dupAudio = duplicateAudio(pa, "m", "m-copie");
    check("dupliquer une piste son la pose à la suite",
      near(dupAudio.audios[1].start, dupAudio.audios[0].start + dupAudio.audios[0].length),
      `${dupAudio.audios[1].start} vs ${dupAudio.audios[0].start + dupAudio.audios[0].length}`);
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
