// Socle du banc de montage — document de projet, historique, plans de rendu.
//
// L'audit exige une couverture de la logique de montage supérieure à 80 % :
// c'est elle qui porte la non-destructivité, le minutage et la reprise de
// travail. Ces contrôles vérifient le COMPORTEMENT, pas la présence de code.
//
// Usage : npm run test:montageproj

import {
  addAudio, addClip, addText, clipAt, duplicateClip, emptyProject, imagesAt,
  addImageLayer, MIN_CLIP_SECONDS, normalize, projectDuration, removeClip,
  reorderClip, setClipFraming, setClipSpeed, setClipTransition, splitAt, textsAt,
  trimClip, updateAudio, updateText,
  type Clip, type EditorProject,
} from "../lib/editor/project";
import { canRedo, canUndo, HISTORY_LIMIT, initHistory, push, redo, undo } from "../lib/editor/history";
import {
  BROWSER_LIMITS, decideRenderTarget, frameFilterSteps, toBrowserPlan, toServerEdit,
} from "../lib/editor/render-plan";
import {
  applyTemplate, brandStyleFrom, rescaleTextsForFormat, sizePctFor, TEMPLATES,
} from "../lib/editor/templates";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) < eps;

/** Projet de départ : deux plans vidéo de 10 s. */
function twoClips(): EditorProject {
  let p = emptyProject("c1", "p1");
  p = addClip(p, { id: "a", src: "a.mp4", kind: "video", sourceDuration: 10 });
  p = addClip(p, { id: "b", src: "b.mp4", kind: "video", sourceDuration: 10 });
  return p;
}

function main() {
  // ── Construction et invariants ───────────────────────────────────────────
  {
    const p = twoClips();
    check("durée = somme des plans", near(projectDuration(p), 20), String(projectDuration(p)));
    check("les plans sont bout à bout, sans trou", near(p.clips[0].start, 0) && near(p.clips[1].start, 10));
    check("une photo reçoit une durée par défaut", near(projectDuration(addClip(emptyProject("c", "p"), { id: "i", src: "i.jpg", kind: "image" })), 4));

    // La normalisation doit RÉPARER un état incohérent, pas le propager.
    const bancal: EditorProject = { ...p, clips: [{ ...p.clips[0], start: 999 }, { ...p.clips[1], start: -5 }] };
    const fixed = normalize(bancal);
    check("un projet incohérent est remis d'aplomb", near(fixed.clips[0].start, 0) && near(fixed.clips[1].start, 10));
  }

  // ── Le média source n'est JAMAIS modifié ─────────────────────────────────
  {
    const p = twoClips();
    const after = trimClip(setClipSpeed(splitAt(p, 5, (id) => `${id}-2`), "a", 2), "b", { head: 2 });
    const sources = after.clips.map((c) => c.src).sort();
    check(
      "toutes les opérations préservent la source",
      sources.every((s) => s === "a.mp4" || s === "b.mp4"),
      sources.join(",")
    );
  }

  // ── Rognage ──────────────────────────────────────────────────────────────
  {
    const p = twoClips();
    const t = trimClip(p, "a", { head: 3 });
    const a = t.clips.find((c) => c.id === "a")!;
    check("rogner le début avance le point d'entrée", near(a.trimStart, 3) && near(a.length, 7));
    check("le plan suivant se recale", near(t.clips[1].start, 7), String(t.clips[1].start));

    const tail = trimClip(p, "a", { tail: 4 });
    check("rogner la fin raccourcit sans toucher l'entrée", near(tail.clips[0].trimStart, 0) && near(tail.clips[0].length, 6));

    const excessive = trimClip(p, "a", { head: 100 });
    check("un rognage excessif laisse un plan valide", excessive.clips[0].length >= MIN_CLIP_SECONDS, String(excessive.clips[0].length));

    // Un plan ne peut pas montrer plus que ce que sa source contient.
    const beyond = trimClip(trimClip(p, "a", { head: 8 }), "a", { tail: -50 });
    const clipA = beyond.clips.find((c) => c.id === "a")!;
    check("impossible de dépasser la durée de la source", clipA.trimStart + clipA.length <= 10.01, `${clipA.trimStart}+${clipA.length}`);
  }

  // ── Scission ─────────────────────────────────────────────────────────────
  {
    const p = twoClips();
    const s = splitAt(p, 4, (id) => `${id}-2`);
    check("scinder produit deux plans", s.clips.length === 3, String(s.clips.length));
    check("la durée totale est inchangée", near(projectDuration(s), 20), String(projectDuration(s)));
    const [left, right] = [s.clips[0], s.clips[1]];
    check("la moitié gauche s'arrête au point de coupe", near(left.length, 4));
    check("la moitié droite reprend au bon endroit dans la source", near(right.trimStart, 4), String(right.trimStart));
    check("les deux moitiés partagent la même source", left.src === right.src);

    check("scinder hors d'un plan ne change rien", splitAt(p, 0, (i) => i) === p);
    check("scinder trop près d'un bord ne change rien", splitAt(p, 0.02, (i) => i) === p);
  }

  // ── Suppression, réordonnancement, duplication ───────────────────────────
  {
    const p = twoClips();
    const removed = removeClip(p, "a");
    check("supprimer un plan recale le reste", removed.clips.length === 1 && near(removed.clips[0].start, 0));

    const reordered = reorderClip(p, "b", 0);
    check("réordonner change l'ordre de lecture", reordered.clips[0].id === "b" && near(reordered.clips[0].start, 0));

    const dup = duplicateClip(p, "a", "a-copie");
    check("dupliquer insère juste après l'original", dup.clips[1].id === "a-copie" && near(projectDuration(dup), 30));
  }

  // ── Vitesse ──────────────────────────────────────────────────────────────
  {
    const p = twoClips();
    const fast = setClipSpeed(p, "a", 2);
    check("doubler la vitesse divise la durée par deux", near(fast.clips[0].length, 5), String(fast.clips[0].length));
    const slow = setClipSpeed(p, "a", 0.5);
    check("ralentir allonge la durée", near(slow.clips[0].length, 20), String(slow.clips[0].length));
    check("la vitesse reste dans les bornes", setClipSpeed(p, "a", 99).clips[0].speed === 2);
  }

  // ── Calques temporels ────────────────────────────────────────────────────
  {
    let p = twoClips();
    p = addText(p, "t1", "Bonjour");
    p = updateText(p, "t1", { start: 0, end: 3 });
    p = addText(p, "t2", "Au revoir");
    p = updateText(p, "t2", { start: 15, end: 20 });

    check("un texte n'est visible que dans ses bornes", textsAt(p, 1).length === 1 && textsAt(p, 1)[0].id === "t1");
    check("deux textes ne s'affichent plus simultanément", textsAt(p, 10).length === 0, String(textsAt(p, 10).length));
    check("le second texte apparaît en fin de film", textsAt(p, 17).map((l) => l.id).join() === "t2");

    // Une borne au-delà du film est ramenée à la durée réelle.
    p = updateText(p, "t2", { end: 999 });
    check("une borne hors film est ramenée à la durée", near(p.texts.find((l) => l.id === "t2")!.end, 20));

    p = addImageLayer(p, "img", "logo.png");
    check("une incrustation suit les mêmes règles", imagesAt(p, 5).length === 1 && imagesAt(p, 25).length === 0);
  }

  // ── Lecture : quel plan à quel instant ───────────────────────────────────
  {
    const p = trimClip(twoClips(), "a", { head: 2 });
    const at1 = clipAt(p, 1);
    check("l'instant 1 s joue le premier plan", at1?.clip.id === "a");
    check("la position dans la source tient compte du rognage", near(at1!.sourceTime, 3), String(at1?.sourceTime));
    check("l'instant après le premier plan joue le second", clipAt(p, 10)?.clip.id === "b");
    check("aucun plan sur un projet vide", clipAt(emptyProject("c", "p"), 0) === null);

    const fast = setClipSpeed(twoClips(), "a", 2);
    check("la vitesse accélère la lecture de la source", near(clipAt(fast, 2)!.sourceTime, 4), String(clipAt(fast, 2)?.sourceTime));
  }

  // ── Audio ────────────────────────────────────────────────────────────────
  {
    let p = twoClips();
    p = addAudio(p, { id: "m", src: "m.mp3", name: "Musique", role: "music", sourceDuration: 60 });
    const music = p.audios[0];
    check("la musique arrive sous la voix, pas à égalité", music.volume === 0.25, String(music.volume));
    check("la musique est bornée à la durée du film", near(music.length, 20), String(music.length));
    check("fondus posés par défaut sur une musique", music.fadeIn > 0 && music.fadeOut > 0);

    p = addAudio(p, { id: "v", src: "v.mp3", name: "Voix", role: "voice", sourceDuration: 10 });
    check("une voix off garde son niveau", p.audios[1].volume === 1);
    check("le volume reste borné", updateAudio(p, "m", { volume: 5 }).audios[0].volume === 1);
  }

  // ── Historique ───────────────────────────────────────────────────────────
  {
    const p0 = twoClips();
    let h = initHistory(p0);
    check("rien à annuler au départ", !canUndo(h) && !canRedo(h));

    const p1 = removeClip(p0, "a");
    h = push(h, p1);
    const p2 = addText(p1, "t", "x");
    h = push(h, p2);

    h = undo(h);
    check("annuler restaure l'état précédent", h.present === p1 && canRedo(h));
    h = undo(h);
    check("annuler deux fois revient au départ", h.present === p0 && !canUndo(h));
    h = redo(h);
    check("rétablir rejoue l'action annulée", h.present === p1);

    // Une action neuve après annulation abandonne la branche rétablissable.
    h = push(h, removeClip(p1, "b"));
    check("une action neuve invalide le rétablissement", !canRedo(h));

    // La pile est bornée : 60 actions ne gardent que les 50 dernières.
    let deep = initHistory(p0);
    for (let i = 0; i < 60; i++) deep = push(deep, addText(deep.present, `t${i}`, "x"));
    check("la pile d'historique est bornée", deep.past.length === HISTORY_LIMIT, String(deep.past.length));

    check("annuler sur pile vide ne casse rien", undo(initHistory(p0)).present === p0);
  }

  // ── Aiguillage du rendu ──────────────────────────────────────────────────
  {
    const light = twoClips();
    check("montage léger → navigateur", decideRenderTarget({ ...light, clips: [light.clips[0]] }, 5 * 1024 * 1024).target === "browser");
    check("sources volumineuses → serveur", decideRenderTarget(light, BROWSER_LIMITS.maxBytes + 1).target === "server");

    let many = emptyProject("c", "p");
    for (let i = 0; i < 5; i++) many = addClip(many, { id: `c${i}`, src: `${i}.mp4`, kind: "video", sourceDuration: 5 });
    check("plusieurs plans → serveur", decideRenderTarget(many, 1024).target === "server");

    const longP = addClip(emptyProject("c", "p"), { id: "l", src: "l.mp4", kind: "video", sourceDuration: 300 });
    check("film long → serveur", decideRenderTarget(longP, 1024).target === "server");
    check("le motif du basculement est explicite", decideRenderTarget(longP, 1024).reason.length > 0);
  }

  // ── Projection serveur ───────────────────────────────────────────────────
  {
    let p = twoClips();
    p = updateText(addText(p, "t", "Titre"), "t", { start: 0, end: 3 });
    p = addAudio(p, { id: "m", src: "m.mp3", name: "M", role: "music", sourceDuration: 60 });
    const edit = toServerEdit(p, "https://exemple/callback") as {
      timeline: { tracks: { clips: { start: number; length: number; asset: Record<string, unknown> }[] }[] };
      output: { size: { width: number; height: number } };
      callback?: string;
    };
    check("format traduit en dimensions", edit.output.size.width === 1080 && edit.output.size.height === 1920);
    check("le texte porte SES bornes, pas toute la durée", edit.timeline.tracks[0].clips[0].length === 3);
    check("les textes passent au-dessus des plans", edit.timeline.tracks[0].clips[0].asset.type === "title");
    check("le rognage est transmis au moteur", (toServerEdit(trimClip(p, "a", { head: 2 })) as { timeline: { tracks: { clips: { asset: Record<string, unknown> }[] }[] } }).timeline.tracks[1].clips[0].asset.trim === 2);
    check("le callback est transmis", edit.callback === "https://exemple/callback");
  }

  // ── Projection navigateur ────────────────────────────────────────────────
  {
    let p = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 10 });
    p = trimClip(p, "a", { head: 2 });
    p = addAudio(p, { id: "m", src: "m.mp3", name: "M", role: "music", sourceDuration: 60 });
    const plan = toBrowserPlan(p, "ov.png");
    const args = plan.args.join(" ");

    check("le rognage positionne la lecture avant le décodage", args.indexOf("-ss") < args.indexOf("-i"), args.slice(0, 40));
    check("les calques sont incrustés", /overlay=0:0/.test(args));
    check("le volume de la musique est appliqué", /volume=0\.25/.test(args), args);
    check("les fondus sont appliqués", /afade=t=in/.test(args) && /afade=t=out/.test(args));
    check("le mixage ne rabaisse plus la voix", /normalize=0/.test(args));
    check("encodage plus compact qu'ultrafast", /-preset veryfast/.test(args) && /-crf 23/.test(args));
    check("lecture progressive facilitée", /\+faststart/.test(args));
    check("les entrées suivent l'ordre des -i", plan.inputs.map((i) => i.name).join(",") === "in0,ov.png,aud0", plan.inputs.map((i) => i.name).join(","));

    const muted = toBrowserPlan(updateAudio(p, "m", { muted: true }), null);
    check("une piste coupée n'est pas envoyée au moteur", !muted.args.join(" ").includes("aud0"));
    check("projet vide → plan vide", toBrowserPlan(emptyProject("c", "p"), null).args.length === 0);
  }

  // ── Cadrage et formats (lot 3) ───────────────────────────────────────────
  {
    let p = twoClips();
    check("un plan est cadré « remplir » par défaut", p.clips[0].fit === "cover");
    check("le point d'intérêt part du centre", p.clips[0].focusX === 0.5 && p.clips[0].focusY === 0.5);

    p = setClipFraming(p, "a", { fit: "contain", focusX: 0.2, focusY: 0.9 });
    check("le cadrage se change", p.clips[0].fit === "contain");
    check("le point d'intérêt se déplace", near(p.clips[0].focusX, 0.2) && near(p.clips[0].focusY, 0.9));
    check("le point d'intérêt reste dans le cadre",
      setClipFraming(p, "a", { focusX: 3 }).clips[0].focusX === 1);
    check("recadrer ne touche pas la source",
      p.clips[0].src === "a.mp4" && p.clips[0].trimStart === 0 && p.clips[0].length === 10);

    // Un document enregistré avant le cadrage doit se rouvrir, pas échouer.
    const legacy = normalize({
      ...twoClips(),
      clips: twoClips().clips.map((c) => {
        const { fit, focusX, focusY, ...rest } = c;
        void fit; void focusX; void focusY;
        return rest as Clip;
      }),
    });
    check("un ancien projet reprend un cadrage par défaut",
      legacy.clips.every((c) => c.fit === "cover" && c.focusX === 0.5 && c.focusY === 0.5));

    const trans = setClipTransition(twoClips(), "b", "dissolve");
    check("la transition se choisit", trans.clips[1].transitionIn === "dissolve");
    check("le premier plan ne prend pas de transition",
      setClipTransition(twoClips(), "a", "dissolve").clips[0].transitionIn === "none");
  }

  // ── Le format se retrouve dans les DEUX rendus ───────────────────────────
  {
    const p = { ...twoClips(), format: "9:16" as const };
    const cover = frameFilterSteps(p.clips[0], { width: 1080, height: 1920 }).join(",");
    check("le rendu remplit le cadre puis rogne", /scale=1080:1920/.test(cover) && /crop=1080:1920/.test(cover), cover);
    check("le rognage suit le point d'intérêt", /crop=1080:1920:\(in_w-out_w\)\*0\.500/.test(cover), cover);
    const off = frameFilterSteps(setClipFraming(p, "a", { focusX: 0.2 }).clips[0], { width: 1080, height: 1920 }).join(",");
    check("un point d'intérêt décalé décale le rognage", /\(in_w-out_w\)\*0\.200/.test(off), off);
    const contain = frameFilterSteps(setClipFraming(p, "a", { fit: "contain" }).clips[0], { width: 1080, height: 1920 }).join(",");
    check("« entier » complète par des bandes", /force_original_aspect_ratio=decrease/.test(contain) && /pad=1080:1920/.test(contain), contain);

    const single = addClip(emptyProject("c", "p", "9:16"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 8 });
    const args = toBrowserPlan(single, null).args.join(" ");
    check("le rendu navigateur applique enfin le format", /scale=1080:1920/.test(args), args);

    const photo = addClip(emptyProject("c", "p", "1:1"), { id: "i", src: "i.jpg", kind: "image" });
    const pargs = toBrowserPlan(photo, null).args;
    check("une photo est bouclée puis bornée",
      pargs.indexOf("-loop") >= 0 && pargs.indexOf("-loop") < pargs.indexOf("-i") && pargs.includes("-t"));
    check("une photo reçoit une cadence", pargs.includes("-r"));

    const edit = toServerEdit(setClipFraming(p, "a", { focusX: 0.2, focusY: 0.8 })) as {
      timeline: { tracks: { clips: { fit?: string; offset?: { x: number; y: number } }[] }[] };
    };
    const videoTrack = edit.timeline.tracks[edit.timeline.tracks.length - 1].clips[0];
    check("le rendu serveur transmet le cadrage", videoTrack.fit === "cover");
    check("le rendu serveur ramène le point d'intérêt au centre",
      near(videoTrack.offset?.x ?? 0, 0.3) && near(videoTrack.offset?.y ?? 0, 0.3),
      JSON.stringify(videoTrack.offset));
  }

  // ── Modèles de marque (lot 3) ────────────────────────────────────────────
  {
    const brand = brandStyleFrom({ palette: ["#123456", "#abcdef"], recommendedTextColor: "#ffee00", logoUrl: "logo.png" });
    check("le kit de marque est relu", brand.palette.length === 2 && brand.textColor === "#ffee00");
    check("un kit absent ne casse rien",
      brandStyleFrom(null).textColor === "#ffffff" && brandStyleFrom(null).palette.length === 0);
    check("une couleur invalide est écartée",
      brandStyleFrom({ palette: ["rouge", "#123456"] }).palette.length === 1);

    let seq = 0;
    const idFor = (prefix: string) => `${prefix}${(seq += 1)}`;
    const base = twoClips();
    const hooked = applyTemplate(base, "hook", brand, idFor);
    check("un modèle pose ses calques", hooked.texts.length === 1);
    check("le modèle prend la couleur de marque", hooked.texts[0].color === "#ffee00");
    check("une accroche ne tient pas tout le film", hooked.texts[0].end < projectDuration(base));
    check("un modèle n'écrase pas le montage", hooked.clips.length === base.clips.length);

    const cta = applyTemplate(base, "cta", brand, idFor);
    check("l'appel à l'action prend la couleur structurante", cta.texts[0].color === "#123456");
    check("le logo est incrusté quand il existe", cta.images.length === 1 && cta.images[0].src === "logo.png");
    check("pas de logo fantôme sans kit",
      applyTemplate(base, "cta", brandStyleFrom(null), idFor).images.length === 0);
    check("un modèle inconnu ne change rien", applyTemplate(base, "inexistant", brand, idFor) === base);
    check("les modèles sont libellés dans les deux langues",
      TEMPLATES.every((x) => x.label.fr && x.label.en && x.hint.fr && x.hint.en));
    check("le texte anglais est repris en anglais",
      applyTemplate(base, "hook", brand, idFor, "en").texts[0].text === "Your hook");

    // La taille se mesure en largeur : le même modèle doit rester lisible
    // quel que soit le cadre.
    check("la taille se transpose d'un format à l'autre",
      sizePctFor(0.1, "9:16") < sizePctFor(0.1, "16:9"),
      `${sizePctFor(0.1, "9:16")} vs ${sizePctFor(0.1, "16:9")}`);
    check("la taille reste dans les bornes de l'interface",
      sizePctFor(5, "16:9") <= 0.2 && sizePctFor(0.0001, "9:16") >= 0.03);

    const wide = rescaleTextsForFormat({ ...hooked, format: "16:9" }, "9:16");
    check("changer de format retranspose les textes", wide.texts[0].sizePct > hooked.texts[0].sizePct,
      `${hooked.texts[0].sizePct} → ${wide.texts[0].sizePct}`);
    check("un format inchangé ne retouche rien", rescaleTextsForFormat(hooked, "9:16") === hooked);
    check("changer de format ne perd aucun calque", wide.texts.length === hooked.texts.length);
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
