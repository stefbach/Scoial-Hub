// Robustesse et parité professionnelle (itération 3, Lot 4, chapitre 8.1).
//
// Verrouillage et masquage de piste vidéo : deux boutons par piste, peu
// coûteux, très utilisés dès qu'il y a plus de deux pistes. `visibleProject`
// est le point de filtrage UNIQUE partagé par l'aperçu et par les deux
// projections de rendu — sans lui, masquer une piste dans l'aperçu sans la
// retirer de l'export romprait la parité exigée au chapitre 9, point 10.
//
// Usage : npm run test:montagelot4

import {
  addClip, emptyProject, isTrackHidden, isTrackLocked, setTrackMeta,
  usedTracks, visibleProject, type EditorProject,
} from "../lib/editor/project";
import { decideRenderTarget, toServerEdit } from "../lib/editor/render-plan";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/** Deux pistes vidéo superposées. */
function twoTracks(): EditorProject {
  let p = addClip(emptyProject("c", "p"), { id: "fond", src: "fond.mp4", kind: "video", sourceDuration: 10 });
  p = addClip(p, { id: "incrust", src: "i.mp4", kind: "video", sourceDuration: 6, track: 1, start: 2 });
  return p;
}

function main() {
  // ── Verrouillage ─────────────────────────────────────────────────────────
  {
    const p = twoTracks();
    check("aucune piste verrouillée par défaut", !isTrackLocked(p, 0) && !isTrackLocked(p, 1));

    const locked = setTrackMeta(p, 1, { locked: true });
    check("verrouiller une piste la marque comme telle", isTrackLocked(locked, 1));
    check("les autres pistes restent déverrouillées", !isTrackLocked(locked, 0));
    check("verrouiller ne change rien aux plans", locked.clips.length === p.clips.length);

    const unlocked = setTrackMeta(locked, 1, { locked: false });
    check("déverrouiller retire le verrou", !isTrackLocked(unlocked, 1));
  }

  // ── Masquage ─────────────────────────────────────────────────────────────
  {
    const p = twoTracks();
    check("aucune piste masquée par défaut", !isTrackHidden(p, 0) && !isTrackHidden(p, 1));
    check("un projet sans piste masquée est renvoyé tel quel", visibleProject(p) === p);

    const hidden = setTrackMeta(p, 1, { hidden: true });
    check("masquer une piste la marque comme telle", isTrackHidden(hidden, 1));

    const seen = visibleProject(hidden);
    check("la piste masquée disparaît du montage vu/exporté",
      seen.clips.every((c) => c.track !== 1), JSON.stringify(seen.clips.map((c) => c.track)));
    check("les autres pistes restent visibles", seen.clips.some((c) => c.track === 0));
    check("masquer ne modifie pas le document source", hidden.clips.length === p.clips.length);

    const shown = setTrackMeta(hidden, 1, { hidden: false });
    check("démasquer restaure la piste", visibleProject(shown).clips.some((c) => c.track === 1));
  }

  // ── Verrouillage et masquage sont indépendants ───────────────────────────
  {
    const p = setTrackMeta(twoTracks(), 1, { locked: true, hidden: false });
    check("verrouiller n'implique pas masquer", isTrackLocked(p, 1) && !isTrackHidden(p, 1));
    const p2 = setTrackMeta(p, 1, { hidden: true });
    check("masquer conserve le verrouillage déjà posé", isTrackLocked(p2, 1) && isTrackHidden(p2, 1));
  }

  // ── L'aperçu ET l'export partagent le même filtrage ──────────────────────
  {
    const hidden = setTrackMeta(twoTracks(), 1, { hidden: true });
    const seen = visibleProject(hidden);

    check("la piste masquée ne compte plus dans les pistes utilisées", usedTracks(seen).join(",") === "0", usedTracks(seen).join(","));

    // Le multi-piste vidéo n'est composé que côté SERVEUR (toBrowserPlan ne
    // retient que p.clips[0]) : c'est donc toServerEdit qui prouve la
    // nécessité du filtrage — sans lui, la piste masquée serait quand même
    // envoyée au moteur de rendu.
    const editSeen = JSON.stringify(toServerEdit(seen));
    check("le montage transmis au serveur ne référence pas le média de la piste masquée",
      !editSeen.includes("i.mp4"), editSeen);

    const editUnfiltered = JSON.stringify(toServerEdit(hidden));
    check("sans le filtrage, la piste masquée serait quand même transmise au serveur (preuve que le filtrage est nécessaire)",
      editUnfiltered.includes("i.mp4"));

    // L'aiguillage lui-même doit compter sur le montage FILTRÉ : sans cela,
    // il pourrait basculer au serveur à cause d'une piste que l'export ne
    // contient plus.
    check("l'aiguillage de rendu ignore aussi la piste masquée",
      decideRenderTarget(seen, 1024).target === "browser", decideRenderTarget(seen, 1024).reason);
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
