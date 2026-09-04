// Chutier — les médias du projet (audit Editing Bench v4, constat 6).
//
// L'onglet Médias ne savait qu'importer : reposer une vidéo déjà utilisée
// obligeait à la retrouver sur le disque et à la réenvoyer, créant un second
// fichier hébergé pour le même contenu.
//
// La liste est DÉRIVÉE du document, jamais tenue à part — c'est ce que ce
// script vérifie, parce que c'est ce qui garantit qu'elle ne ment jamais :
// un média disparaît dès que le dernier élément qui l'utilisait est supprimé,
// sans qu'aucun code ait à s'en souvenir.
//
// Usage : npm run test:montagechutier

import {
  addAudio, addClip, addImageLayer, emptyProject, mediaName, projectMedia,
  removeClip, type EditorProject,
} from "../lib/editor/project";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function sample(): EditorProject {
  let p = addClip(emptyProject("c", "p"), { id: "a", src: "https://cdn/x/plan-a.mp4", kind: "video", sourceDuration: 6 });
  p = addClip(p, { id: "b", src: "https://cdn/x/plan-b.mp4", kind: "video", sourceDuration: 4 });
  p = addImageLayer(p, "logo", "https://cdn/x/logo.png");
  p = addAudio(p, { id: "musique", src: "https://cdn/x/theme.mp3", name: "Thème.mp3", role: "music" });
  return p;
}

function main() {
  // ── Ce que le chutier contient ──────────────────────────────────────────
  {
    const media = projectMedia(sample());
    check("un média par fichier distinct", media.length === 4, `${media.length}`);
    check("les plans vidéo sont reconnus comme tels",
      media.filter((m) => m.kind === "video").length === 2);
    check("l'incrustation est reconnue comme image", media.some((m) => m.kind === "image" && m.src.endsWith("logo.png")));
    check("le son est reconnu, et garde le nom de son fichier",
      media.some((m) => m.kind === "audio" && m.name === "Thème.mp3"));
    check("la durée native d'un plan est reportée",
      media.find((m) => m.src.endsWith("plan-a.mp4"))?.duration === 6);
  }

  // ── Le même fichier posé deux fois n'est QU'UNE entrée ──────────────────
  {
    let p = sample();
    p = addClip(p, { id: "a2", src: "https://cdn/x/plan-a.mp4", kind: "video", sourceDuration: 6 });
    const media = projectMedia(p);
    check("le même fichier posé deux fois reste une seule entrée", media.length === 4, `${media.length}`);
    check("son nombre d'utilisations est compté",
      media.find((m) => m.src.endsWith("plan-a.mp4"))?.uses === 2,
      `${media.find((m) => m.src.endsWith("plan-a.mp4"))?.uses}`);
  }

  // ── Une durée connue par UN SEUL des usages profite à l'entrée ──────────
  {
    let p = addClip(emptyProject("c", "p"), { id: "x1", src: "https://cdn/x/v.mp4", kind: "video" });
    p = addClip(p, { id: "x2", src: "https://cdn/x/v.mp4", kind: "video", sourceDuration: 12 });
    const entry = projectMedia(p).find((m) => m.src.endsWith("v.mp4"));
    check("une durée connue par un seul usage renseigne l'entrée", entry?.duration === 12, `${entry?.duration}`);
  }

  // ── La liste est DÉRIVÉE : elle suit les suppressions ───────────────────
  {
    const p = sample();
    const after = removeClip(p, "b");
    const media = projectMedia(after);
    check("supprimer le dernier élément qui l'utilisait retire le média du chutier",
      !media.some((m) => m.src.endsWith("plan-b.mp4")), media.map((m) => m.name).join(", "));
    check("les autres médias restent", media.length === 3, `${media.length}`);
  }

  // ── Un média utilisé DEUX fois survit à une suppression ─────────────────
  {
    let p = sample();
    p = addClip(p, { id: "a2", src: "https://cdn/x/plan-a.mp4", kind: "video", sourceDuration: 6 });
    const media = projectMedia(removeClip(p, "a2"));
    const entry = media.find((m) => m.src.endsWith("plan-a.mp4"));
    check("un média encore utilisé ailleurs reste au chutier", Boolean(entry));
    check("son décompte redescend", entry?.uses === 1, `${entry?.uses}`);
  }

  // ── Noms lisibles ───────────────────────────────────────────────────────
  {
    check("le nom vient du dernier segment de l'URL", mediaName("https://cdn/a/b/ma-video.mp4") === "ma-video.mp4");
    check("les paramètres d'URL sont ignorés", mediaName("https://cdn/x/v.mp4?token=abc#t=2") === "v.mp4");
    check("le nom est décodé", mediaName("https://cdn/x/ma%20photo.png") === "ma photo.png");
    check("le préfixe d'unicité de l'hébergeur est retiré",
      mediaName("https://cdn/x/9f2c1ab7d3-affiche.png") === "affiche.png",
      mediaName("https://cdn/x/9f2c1ab7d3-affiche.png"));
    // Un nom ne doit JAMAIS finir vide : une ligne anonyme dans le chutier
    // serait pire qu'un nom laid.
    check("un nom réduit au seul préfixe reste affichable",
      mediaName("https://cdn/x/9f2c1ab7d3-").length > 0, mediaName("https://cdn/x/9f2c1ab7d3-"));
    check("une URL sans segment de fichier reste affichable", mediaName("https://cdn").length > 0);
  }

  // ── Projet vide ─────────────────────────────────────────────────────────
  check("un projet vide n'a pas de chutier", projectMedia(emptyProject("c", "p")).length === 0);

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
