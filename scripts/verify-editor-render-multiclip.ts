// Rendu navigateur multi-plans (audit v4, suite).
//
// Le moteur navigateur ne décrivait qu'UN plan : tout montage assemblé partait
// au serveur, qui ne rend ni les images-clés ni la correction d'image. La
// fonction qu'on venait d'ajouter était donc inutilisable sur un vrai montage.
//
// Ce script tient la chaîne de filtres, qu'aucun œil ne relira jamais en
// entier. Ce qu'il protège, dans l'ordre :
//
//   1. LA DURÉE. Un film monté à 10 s doit sortir à 10 s — transitions
//      comprises. `xfade` consomme la durée de la transition ; c'est le
//      remplissage `tpad` qui la rend, et l'oublier raccourcit le fichier.
//   2. LA PLACE DE CHAQUE SON. Une voix off posée à la douzième seconde doit
//      sonner à la douzième seconde, pas au début.
//   3. L'HOMOGÉNÉITÉ DES FLUX. `concat` et `xfade` refusent deux flux qui
//      diffèrent en cadence, format de pixel ou rapport de pixel — et leur
//      message d'erreur n'apprend rien à personne.
//   4. LE CHEMIN CHOISI. Un montage ordinaire ne doit pas changer de moteur
//      sans raison : ce qui sort bien du serveur aujourd'hui continue d'y aller.
//
// Usage : npm run test:montagemultiplan

import {
  addAudio, addClip, emptyProject, setClipAdjust, setClipTransition, setKeyframe,
  updateAudio, type EditorProject,
} from "../lib/editor/project";
import {
  baseTrackClips, browserOverlays, decideRenderTarget, toBrowserPlan, unrenderableFeatures,
} from "../lib/editor/render-plan";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/**
 * Trois plans bout à bout : 4 s + 3 s + 3 s = 10 s.
 *
 * `addClip` pose un plan MUET et enchaîné par un fondu — ce sont les défauts
 * du modèle, et les épouser ici évite d'écrire des tests qui décrivent un
 * banc imaginaire. Chaque cas rend explicite ce qu'il change.
 */
function threeClips(): EditorProject {
  let p = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 4 });
  p = addClip(p, { id: "b", src: "b.mp4", kind: "video", sourceDuration: 3 });
  p = addClip(p, { id: "d", src: "d.mp4", kind: "video", sourceDuration: 3 });
  return p;
}

/** Le même montage, coupes franches — sans transition d'aucune sorte. */
function hardCuts(): EditorProject {
  let p = threeClips();
  for (const id of ["b", "d"]) p = setClipTransition(p, id, "none");
  return p;
}

/** Le même montage, son des plans activé. */
function audible(p: EditorProject): EditorProject {
  return { ...p, clips: p.clips.map((c) => ({ ...c, muted: false })) };
}
const argsOf = (p: EditorProject) => toBrowserPlan(p, browserOverlays(p)).args.join(" ");

function main() {
  // ── 1. Les plans sont tous décrits ──────────────────────────────────────
  {
    const p = threeClips();
    const plan = toBrowserPlan(p);
    check("un fichier d'entrée par plan",
      plan.inputs.filter((i) => i.name.startsWith("in")).length === 3,
      String(plan.inputs.length));
    const args = plan.args.join(" ");
    check("chaque plan est normalisé avant d'être enchaîné",
      ["[c0]", "[c1]", "[c2]"].every((l) => args.includes(l)), args.slice(0, 200));
    check("les trois flux partagent cadence, format et rapport de pixel",
      (args.match(/fps=30,format=yuv420p,setsar=1/g) ?? []).length === 3, args.slice(0, 300));
    // Le défaut du modèle est un fondu entre plans : c'est ce que l'aperçu
    // montre, et donc ce que le fichier doit contenir.
    check("le fondu par défaut du modèle est bien rendu",
      (args.match(/xfade=transition=fade/g) ?? []).length === 2, args.slice(0, 200));
    const cuts = argsOf(hardCuts());
    check("en coupes franches, les plans sont simplement concaténés",
      cuts.includes("concat=n=3:v=1:a=0") && !cuts.includes("xfade"), cuts.slice(0, 200));
    check("la durée du film est celle du montage, pas du plus long flux",
      args.includes("-t 10.000"), args);
  }

  // ── La durée LUE dans la source suit la vitesse ─────────────────────────
  {
    let p = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 8 });
    p = audible({ ...p, clips: p.clips.map((c) => ({ ...c, speed: 2, length: 4 })) });
    const args = argsOf(p);
    check("un plan accéléré lit deux fois plus de source qu'il n'occupe d'écran",
      args.includes("-t 8.000 -i in0"), args.slice(0, 160));
    check("et son horodatage est recalé en conséquence",
      args.includes("setpts=(PTS-STARTPTS)*0.5000"), args.slice(0, 260));
    check("son SON suit la même vitesse", args.includes("atempo=2.000"), args);
  }

  // ── 2. Transitions : la durée du film ne bouge pas ──────────────────────
  {
    let p = threeClips();
    p = setClipTransition(p, "b", { kind: "dissolve", seconds: 1 });
    const args = argsOf(p);
    check("une transition produit un xfade", args.includes("xfade=transition=dissolve"), args);
    check("le plan sortant est GELÉ pendant la transition",
      args.includes("tpad=stop_mode=clone:stop_duration=1.000"), args);
    check("le fondu démarre à la fin du plan précédent",
      args.includes("offset=4.000"), args);
    // Sans `tpad`, `xfade` amputerait le film de la durée de la transition.
    check("la durée totale du film est INCHANGÉE", args.includes("-t 10.000"), args);

    // Le premier plan n'a rien à quoi s'enchaîner.
    const first = setClipTransition(threeClips(), "a", "dissolve");
    check("le premier plan ne reçoit jamais de transition",
      first.clips.find((c) => c.id === "a")?.transitionIn === "none");
  }

  // ── Coupes franches et transitions dans le même montage ─────────────────
  {
    let p = hardCuts();
    p = setClipTransition(p, "d", { kind: "wipe-left", seconds: 0.5 });
    const args = argsOf(p);
    check("les plans sans transition restent concaténés",
      args.includes("concat=n=2:v=1:a=0"), args.slice(0, 200));
    check("et seule la vraie transition produit un xfade",
      (args.match(/xfade=/g) ?? []).length === 1 && args.includes("transition=wipeleft"), args.slice(0, 200));
    check("le film garde encore sa durée", args.includes("-t 10.000"), args);
  }

  // ── Une durée de transition trop longue est bornée ──────────────────────
  {
    let p = threeClips();
    p = setClipTransition(p, "b", { kind: "fade", seconds: 3 });
    const args = argsOf(p);
    // Le plan « b » dure 3 s : sa transition ne peut pas dépasser 1,5 s sans
    // manger le plan entier.
    check("la transition est bornée à la moitié du plus court des deux plans",
      args.includes("duration=1.500"), args);
  }

  // ── 3. Chaque son à sa place ────────────────────────────────────────────
  {
    let p = audible(threeClips());
    p = addAudio(p, { id: "voix", src: "v.mp3", name: "Voix", role: "voice" });
    p = updateAudio(p, "voix", { start: 6, length: 3 });
    const args = argsOf(p);
    check("une piste posée à la sixième seconde est décalée d'autant",
      args.includes("adelay=6000:all=1"), args);
    check("le mixage ne tronque pas sur la source la plus courte",
      args.includes("duration=longest"), args);
    check("le son embarqué de chaque plan est décalé à son propre début",
      args.includes("adelay=4000:all=1") && args.includes("adelay=7000:all=1"), args);
    check("un plan qui commence à zéro n'est pas décalé inutilement",
      args.includes("[0:a]asetpts=PTS-STARTPTS,volume"), args.slice(0, 400));
  }

  // ── Correction d'image ──────────────────────────────────────────────────
  {
    const p = setClipAdjust(threeClips(), "a", { brightness: 0.2, contrast: 0.1, saturation: -0.5 });
    const args = argsOf(p);
    check("les corrections d'image deviennent un filtre eq",
      args.includes("eq=brightness=0.200:contrast=1.100:saturation=0.500"), args.slice(0, 300));
    check("un plan sans correction n'en reçoit aucun",
      (args.match(/eq=brightness/g) ?? []).length === 1, args.slice(0, 400));
    check("le serveur, lui, ne sait pas les rendre — et on le dit",
      unrenderableFeatures(p, "server").includes("correction d'image"));
    check("le navigateur, si", !unrenderableFeatures(p, "browser").includes("correction d'image"));
  }

  // ── 4. Le chemin choisi ─────────────────────────────────────────────────
  {
    // Un montage ORDINAIRE à plusieurs plans ne change pas de moteur.
    check("un montage ordinaire à trois plans va toujours au serveur",
      decideRenderTarget(threeClips(), 1024).target === "server");

    // Mais dès qu'il utilise une fonction que seul le navigateur rend, il y va.
    const adjusted = setClipAdjust(threeClips(), "a", { saturation: 0.4 });
    check("un montage avec correction d'image passe au navigateur",
      decideRenderTarget(adjusted, 1024).target === "browser",
      decideRenderTarget(adjusted, 1024).reason);

    let animated = threeClips();
    animated = setKeyframe(animated, { kind: "clip", id: "a" }, "opacity", 0, 0);
    animated = setKeyframe(animated, { kind: "clip", id: "a" }, "opacity", 2, 1);
    check("un montage avec images-clés aussi",
      decideRenderTarget(animated, 1024).target === "browser");

    // Une incrustation vidéo — un plan sur une piste supérieure — reste au
    // serveur : le navigateur enchaîne, il ne superpose pas deux flux vidéo.
    let pip = setClipAdjust(threeClips(), "a", { saturation: 0.4 });
    pip = addClip(pip, { id: "pip", src: "p.mp4", kind: "video", sourceDuration: 2, track: 1, start: 1 });
    check("une incrustation vidéo repart au serveur",
      decideRenderTarget(pip, 1024).target === "server", decideRenderTarget(pip, 1024).reason);
    check("et le fait que ses réglages seront perdus est signalé",
      decideRenderTarget(pip, 1024).keyframesFrozen === true);

    check("`baseTrackClips` ne retient que la piste de base",
      baseTrackClips(pip).length === 3, String(baseTrackClips(pip).length));
  }

  // ── Qualité et cadence ──────────────────────────────────────────────────
  {
    const p = audible(threeClips());
    const standard = toBrowserPlan(p, [], {}).args.join(" ");
    check("la qualité par défaut reste celle d'avant", standard.includes("-preset veryfast -crf 23"));
    check("et la cadence aussi", standard.includes("-r 30") && standard.includes("fps=30"));

    const high = toBrowserPlan(p, [], { quality: "high", fps: 60 }).args.join(" ");
    check("la qualité supérieure encode plus lentement et plus finement",
      high.includes("-preset medium -crf 19") && high.includes("-b:a 192k"), high.slice(-200));
    check("60 images par seconde se répercutent sur TOUS les flux",
      high.includes("-r 60") && (high.match(/fps=60/g) ?? []).length === 3, high.slice(0, 300));
  }

  // ── Un montage vide ne produit rien ─────────────────────────────────────
  check("un projet sans plan ne produit aucun argument", toBrowserPlan(emptyProject("c", "p")).args.length === 0);

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
