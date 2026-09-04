// Images-clés (audit Editing Bench v4, constat 7).
//
// Ce que ce script protège, dans l'ordre d'importance :
//
//   1. UN CALQUE SANS CLÉ NE CHANGE PAS. C'est la garantie de rétrocompatibilité :
//      des centaines de montages existent, aucun ne doit bouger d'un pixel.
//   2. L'INTERPOLATION est celle qu'on attend — bornes comprises, où beaucoup
//      d'implémentations sautent à une valeur fixe oubliée.
//   3. ÉCRIRE sur une propriété animée pose une CLÉ, jamais une valeur fixe :
//      sans cette règle, aucune clé ne serait modifiable après coup.
//   4. L'APERÇU ET L'EXPORT lisent la même chose. La parité est le seul
//      invariant que cet éditeur ne peut pas se permettre de perdre.
//
// Usage : npm run test:montagekeyframes

import {
  addAudio, addClip, addText, clearKeyframes, clipsAt, duplicateText, emptyProject, hasKeyframes,
  imagesAt, keyframeTimes, keyframesOf, moveElement, patchAnimated, projectHasKeyframes,
  removeKeyframe, setKeyframe, shapesAt, textsAt, updateText, valueAt, animatableProps,
  type EditorProject,
} from "../lib/editor/project";
import {
  browserOverlays, decideRenderTarget, keyframeFrameCount, toBrowserPlan,
  unrenderableKeyframes, volumeExpression,
} from "../lib/editor/render-plan";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

/** Un plan de 10 s et un texte qui court dessus. */
function sample(): EditorProject {
  let p = addClip(emptyProject("c", "p"), { id: "plan", src: "a.mp4", kind: "video", sourceDuration: 10 });
  p = addText(p, "titre", "Bonjour", 0);
  p = updateText(p, "titre", { start: 0, end: 10, x: 0.1, y: 0.5, opacity: 1 });
  return p;
}
const titre = (p: EditorProject) => p.texts.find((l) => l.id === "titre")!;
const SEL = { kind: "text" as const, id: "titre" };

function main() {
  // ── 1. Un calque sans clé ne change pas ─────────────────────────────────
  {
    const p = sample();
    const l = titre(p);
    check("un calque neuf n'a aucune image-clé", !hasKeyframes(l));
    check("un projet neuf n'en a pas non plus", !projectHasKeyframes(p));
    check("sans clé, la valeur lue est la valeur fixe", valueAt(l, "x", 5) === l.x);
    // `textsAt` renvoie la MÊME référence : aucun rendu inutile déclenché en
    // aval, et aucune copie qui pourrait diverger.
    check("sans clé, `textsAt` renvoie le calque tel quel", textsAt(p, 5)[0] === l);
    check("écrire sur un calque sans clé reste une valeur fixe",
      patchAnimated(p, SEL, { x: 0.4 }, 5).texts[0].x === 0.4 &&
      !hasKeyframes(patchAnimated(p, SEL, { x: 0.4 }, 5).texts[0]));
  }

  // ── 2. Interpolation ────────────────────────────────────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 0, 0);
    p = setKeyframe(p, SEL, "x", 10, 1);
    const l = titre(p);
    check("au départ, la valeur de la première clé", near(valueAt(l, "x", 0), 0));
    check("à l'arrivée, la valeur de la dernière", near(valueAt(l, "x", 10), 1));
    check("au milieu, la moyenne (linéaire)", near(valueAt(l, "x", 5), 0.5), `${valueAt(l, "x", 5)}`);
    check("au quart, le quart", near(valueAt(l, "x", 2.5), 0.25));
    // Une animation TIENT au-delà de ses bornes : sauter à la valeur fixe
    // ferait clignoter le calque à l'entrée et à la sortie.
    check("avant la première clé, la valeur tient", near(valueAt(l, "x", -3), 0));
    check("après la dernière, elle tient aussi", near(valueAt(l, "x", 99), 1));
  }

  // ── Accélérations ───────────────────────────────────────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 0, 0, "ease-in");
    p = setKeyframe(p, SEL, "x", 10, 1);
    check("un départ doux est EN DESSOUS du linéaire à mi-course",
      valueAt(titre(p), "x", 5) < 0.5, `${valueAt(titre(p), "x", 5)}`);

    let q = setKeyframe(sample(), SEL, "x", 0, 0, "ease-out");
    q = setKeyframe(q, SEL, "x", 10, 1);
    check("une arrivée douce est AU DESSUS", valueAt(titre(q), "x", 5) > 0.5, `${valueAt(titre(q), "x", 5)}`);

    let r = setKeyframe(sample(), SEL, "x", 0, 0, "ease-in-out");
    r = setKeyframe(r, SEL, "x", 10, 1);
    check("doux aux deux bouts reste symétrique au milieu", near(valueAt(titre(r), "x", 5), 0.5));
    check("toutes les accélérations partent et arrivent aux mêmes valeurs",
      near(valueAt(titre(r), "x", 0), 0) && near(valueAt(titre(r), "x", 10), 1));
  }

  // ── Pose, remplacement, retrait ─────────────────────────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 3, 0.2);
    check("une clé posée existe", keyframesOf(titre(p), "x").length === 1);
    p = setKeyframe(p, SEL, "x", 3, 0.8);
    check("reposer une clé au même instant la REMPLACE, sans empiler",
      keyframesOf(titre(p), "x").length === 1 && keyframesOf(titre(p), "x")[0].value === 0.8);

    p = setKeyframe(p, SEL, "x", 1, 0.1);
    check("les clés restent triées par instant",
      keyframesOf(titre(p), "x").map((k) => k.time).join(",") === "1,3");

    p = removeKeyframe(p, SEL, "x", 1);
    check("une clé retirée disparaît", keyframesOf(titre(p), "x").length === 1);
    p = removeKeyframe(p, SEL, "x", 3);
    check("le calque redevient indiscernable d'un calque jamais animé",
      !hasKeyframes(titre(p)) && titre(p).keyframes === undefined);
  }

  // ── 3. Écrire sur une propriété animée pose une clé ─────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 0, 0);
    p = setKeyframe(p, SEL, "x", 10, 1);
    const before = titre(p).x;

    const after = patchAnimated(p, SEL, { x: 0.9 }, 5);
    check("la valeur fixe n'est pas touchée", titre(after).x === before);
    check("une clé apparaît à la tête de lecture",
      keyframesOf(titre(after), "x").some((k) => near(k.time, 5) && k.value === 0.9));
    check("elle est bien prise en compte", near(valueAt(titre(after), "x", 5), 0.9));

    // Une propriété NON animée du même calque reste fixe : l'animation de X
    // ne doit pas contaminer Y.
    const mixed = patchAnimated(after, SEL, { y: 0.7 }, 5);
    check("une propriété non animée du même calque reste fixe",
      titre(mixed).y === 0.7 && !hasKeyframes(titre(mixed), "y"));
    // Et tout champ étranger aux images-clés passe sans encombre.
    const bounds = patchAnimated(after, SEL, { end: 8 }, 5);
    check("les champs non animables passent au travers", titre(bounds).end === 8);
  }

  // ── Figer une animation ─────────────────────────────────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 0, 0);
    p = setKeyframe(p, SEL, "x", 10, 1);
    const frozen = clearKeyframes(p, SEL, "x", 7.5);
    check("figer retire toutes les clés", !hasKeyframes(titre(frozen), "x"));
    // Sans cette reprise, le calque sauterait à la valeur fixe d'origine —
    // une position oubliée depuis longtemps.
    check("figer conserve la valeur VUE à cet instant", near(titre(frozen).x, 0.75), `${titre(frozen).x}`);
  }

  // ── Repères de la timeline ──────────────────────────────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 1, 0);
    p = setKeyframe(p, SEL, "opacity", 1, 0.5);
    p = setKeyframe(p, SEL, "y", 4, 0.2);
    check("deux propriétés au même instant ne donnent qu'UN repère",
      keyframeTimes(titre(p)).join(",") === "1,4", keyframeTimes(titre(p)).join(","));
  }

  // ── Propriétés animables par type ───────────────────────────────────────
  {
    check("un texte n'a pas d'échelle animable", !animatableProps("text").includes("scale"));
    check("une forme non plus", !animatableProps("shape").includes("scale"));
    check("une incrustation, si", animatableProps("image").includes("scale"));
    check("les trois partagent position, opacité et rotation",
      (["x", "y", "opacity", "rotation"] as const).every((k) =>
        animatableProps("text").includes(k) && animatableProps("shape").includes(k) && animatableProps("image").includes(k)));
  }

  // ── 4. Parité aperçu / export ───────────────────────────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 0, 0);
    p = setKeyframe(p, SEL, "x", 10, 1);

    // L'aperçu et la composition des calques passent par le MÊME entonnoir.
    check("`textsAt` résout les images-clés", near(textsAt(p, 5)[0].x, 0.5), `${textsAt(p, 5)[0].x}`);
    check("`imagesAt` et `shapesAt` suivent la même règle",
      imagesAt(p, 5).length === 0 && shapesAt(p, 5).length === 0);

    const overlays = browserOverlays(p);
    const animated = overlays.find((o) => o.layerId === "titre")!;
    check("un calque animé est composé en SÉQUENCE, pas en image fixe", animated.frames > 1, `${animated.frames}`);
    check("son nom est un motif de séquence", animated.name.includes("%03d"), animated.name);
    check("la cadence est portée par le calque", animated.fps > 0);

    const plan = toBrowserPlan(p, overlays);
    const args = plan.args.join(" ");
    check("le plan lit la séquence à sa cadence", args.includes(`-framerate ${animated.fps}`), args);
    check("il ne la boucle PAS comme une image fixe",
      !args.includes(`-loop 1 -i ${animated.name}`), args);

    // Un calque FIXE, lui, ne change pas de traitement.
    let q = addText(sample(), "fixe", "Fixe", 0);
    const fixed = browserOverlays(q).find((o) => o.layerId === "fixe")!;
    check("un calque sans clé reste une image unique bouclée",
      fixed.frames === 1 && !fixed.name.includes("%03d") &&
      toBrowserPlan(q, browserOverlays(q)).args.join(" ").includes(`-loop 1 -i ${fixed.name}`));
  }

  // ── Recalage temporel d'une séquence ────────────────────────────────────
  {
    let p = sample();
    p = updateText(p, "titre", { start: 4, end: 9 });
    p = setKeyframe(p, SEL, "x", 4, 0);
    p = setKeyframe(p, SEL, "x", 9, 1);
    const args = toBrowserPlan(p, browserOverlays(p)).args.join(" ");
    // Sans ce décalage, un calque animé apparaissant à la quatrième seconde
    // jouerait son animation dès la première, puis figerait.
    check("la séquence est recalée sur l'instant d'apparition du calque",
      args.includes("setpts=PTS+4.00/TB"), args);
  }

  // ── L'aiguillage de rendu dit la vérité ─────────────────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 0, 0);
    p = setKeyframe(p, SEL, "x", 10, 1);
    const light = decideRenderTarget(p, 1024);
    check("un montage animé léger part au NAVIGATEUR — seul à savoir les rendre",
      light.target === "browser", `${light.target} · ${light.reason}`);
    check("aucun avertissement dans ce cas", !light.keyframesFrozen);

    // Sources trop lourdes : le serveur reprend la main, et il ne sait pas
    // rendre les images-clés. Le taire livrerait un fichier amputé.
    const heavy = decideRenderTarget(p, 500 * 1024 * 1024);
    check("un montage animé poussé au serveur est SIGNALÉ",
      heavy.target === "server" && heavy.keyframesFrozen === true, `${heavy.target} · ${heavy.keyframesFrozen}`);

    const plain = decideRenderTarget(sample(), 500 * 1024 * 1024);
    check("un montage SANS clé poussé au serveur n'affiche aucun avertissement",
      plain.target === "server" && !plain.keyframesFrozen);

    check("le nombre d'images à composer est mesurable", keyframeFrameCount(p) > 0);
    check("un montage sans clé n'en compose aucune", keyframeFrameCount(sample()) === 0);
  }

  // ── L'animation SUIT son élément ────────────────────────────────────────
  {
    let p = setKeyframe(sample(), SEL, "x", 0, 0);
    p = setKeyframe(p, SEL, "x", 4, 1);
    const moved = moveElement(p, { kind: "text", id: "titre" }, { start: 3 });
    const keys = keyframesOf(titre(moved), "x").map((k) => k.time);
    // Sans ce report, le texte partirait d'un côté et son animation
    // resterait de l'autre — elle se jouerait quand il n'est plus là.
    check("déplacer un calque emporte ses images-clés", keys.join(",") === "3,7", keys.join(","));
    check("la forme de l'animation est intacte", near(valueAt(titre(moved), "x", 5), 0.5), `${valueAt(titre(moved), "x", 5)}`);

    const back = moveElement(moved, { kind: "text", id: "titre" }, { start: 0 });
    check("le retour à la position d'origine les ramène aussi",
      keyframesOf(titre(back), "x").map((k) => k.time).join(",") === "0,4");

    // Une copie emporte l'animation, recalée sur son propre début.
    const dup = duplicateText(p, "titre", "copie");
    const copy = dup.texts.find((l) => l.id === "copie")!;
    check("une copie emporte l'animation, décalée d'autant",
      keyframesOf(copy, "x").map((k) => k.time).join(",") === `${copy.start},${copy.start + 4}`,
      keyframesOf(copy, "x").map((k) => k.time).join(","));
  }

  // ── Tous les types d'éléments, pas seulement les calques ────────────────
  {
    const CLIP = { kind: "clip" as const, id: "plan" };
    let p = setKeyframe(sample(), CLIP, "opacity", 0, 0);
    p = setKeyframe(p, CLIP, "opacity", 5, 1);
    const clip = p.clips.find((c) => c.id === "plan")!;
    check("un PLAN porte des images-clés", hasKeyframes(clip));
    check("son opacité s'interpole", near(valueAt(clip, "opacity", 2.5), 0.5), `${valueAt(clip, "opacity", 2.5)}`);
    check("`clipsAt` les résout comme pour un calque",
      near(clipsAt(p, 2.5)[0].clip.opacity, 0.5), `${clipsAt(p, 2.5)[0].clip.opacity}`);
    check("déplacer un plan emporte ses clés",
      keyframesOf(moveElement(p, CLIP, { start: 2 }).clips.find((c) => c.id === "plan")!, "opacity")
        .map((k) => k.time).join(",") === "2,7");

    let q = addAudio(sample(), { id: "mus", src: "m.mp3", name: "M", role: "music" });
    const AUD = { kind: "audio" as const, id: "mus" };
    q = setKeyframe(q, AUD, "volume", 0, 1);
    q = setKeyframe(q, AUD, "volume", 4, 0.2);
    const aud = q.audios.find((a) => a.id === "mus")!;
    check("un SON porte des images-clés de volume", hasKeyframes(aud, "volume"));
    check("son volume s'interpole", near(valueAt(aud, "volume", 2), 0.6), `${valueAt(aud, "volume", 2)}`);

    // Le volume est la seule propriété animée que la chaîne de filtres rend
    // NATIVEMENT — sans séquence d'images.
    const expr = volumeExpression(aud, aud.start);
    check("un volume animé produit une expression ffmpeg", Boolean(expr) && expr!.includes("if(lt("), String(expr));
    const args = toBrowserPlan(q, browserOverlays(q)).args.join(" ");
    check("l'expression est bien posée sur le filtre volume", args.includes("volume=volume='"), args.slice(0, 300));
    check("un son NON animé garde un volume constant",
      toBrowserPlan(sample(), []).args.join(" ").includes("volume=volume='") === false);
  }

  // ── L'avertissement nomme précisément ce qui ne sera pas rendu ───────────
  {
    // Le cadre d'un plan : ni le navigateur ni le serveur ne l'animent.
    let p = setKeyframe(sample(), { kind: "clip", id: "plan" }, "x", 0, 0);
    p = setKeyframe(p, { kind: "clip", id: "plan" }, "x", 5, 0.5);
    check("le cadre animé d'un plan est signalé comme non rendu par le navigateur",
      unrenderableKeyframes(p, "browser").includes("x"), unrenderableKeyframes(p, "browser").join(","));
    check("et la décision de rendu le répercute", decideRenderTarget(p, 1024).keyframesFrozen === true);

    // Un volume animé, lui, est rendu par le navigateur.
    let q = addAudio(sample(), { id: "mus", src: "m.mp3", name: "M", role: "music" });
    q = setKeyframe(q, { kind: "audio", id: "mus" }, "volume", 0, 1);
    q = setKeyframe(q, { kind: "audio", id: "mus" }, "volume", 3, 0);
    check("un volume animé n'est PAS signalé côté navigateur",
      unrenderableKeyframes(q, "browser").length === 0, unrenderableKeyframes(q, "browser").join(","));
    check("le serveur, lui, n'en rend aucun",
      unrenderableKeyframes(q, "server").includes("volume"));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
