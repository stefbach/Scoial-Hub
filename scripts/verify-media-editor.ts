// Éditeur média — garanties portées par le banc de montage.
//
// Le lot 0 avait corrigé l'ancien éditeur à passe unique. Celui-ci a été
// remplacé par le banc de montage (lots 1 à 3), qui doit tenir les MÊMES
// garanties : média hébergé, calques accessibles, son d'origine préservé,
// plafond d'import expliqué. Ces contrôles suivent les garanties, pas le
// fichier — c'est ce qui empêche une régression au fil d'une refonte.
//
// La logique de montage elle-même est testée par npm run test:montageproj.
//
// Usage : npm run test:editeur

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const read = (p: string) => readFileSync(p, "utf8");

async function main() {
  const editor = read("components/editor/StudioEditor.tsx");
  const preview = read("components/editor/Preview.tsx");
  const upload = read("components/ui/MediaUpload.tsx");
  const compose = read("app/(organic)/compose/page.tsx");
  const host = read("lib/media/host.ts");

  // ── A-06 · Le rendu est hébergé publiquement (CRITIQUE) ───────────────────
  {
    check("A-06 · aucune URL blob: transmise comme média final", !/onExport\(\{\s*url:\s*URL\.createObjectURL/.test(editor));
    check("A-06 · le rendu passe par l'hébergement public", /await hostMedia\(companyId, blob, "montage\.mp4", "edited"\)/.test(editor));
    check("A-06 · un échec d'hébergement ne remplace pas le média", /Le média n'a pas été remplacé/.test(editor));
    check("A-06 · le composeur transmet la société", /companyId=\{company\.id\}/.test(compose));
    check("A-06 · règle d'hébergement partagée", /export async function hostMedia/.test(host) && /hostMedia\(companyId, file, file\.name, "compose"\)/.test(upload));
    check("A-06 · les médias importés dans l'éditeur sont hébergés aussi", /hostMedia\(companyId, file, file\.name, "editor"\)/.test(editor));
  }

  // ── A-02 · Les calques restent manipulables ───────────────────────────────
  {
    // La cause du bug — un clic qui désélectionnait — ne peut plus exister :
    // la sélection vient de la timeline, pas d'un conteneur d'aperçu.
    check("A-02 · sélection portée par la timeline", /onSelect=\{setSelection\}/.test(editor));
    for (const [nom, motif] of [
      ["contenu", /updateText\(p, selectedText\.id, \{ text:/],
      ["taille", /updateText\(p, selectedText\.id, \{ sizePct:/],
      ["couleur", /updateText\(p, selectedText\.id, \{ color: c \}\)/],
      ["gras", /updateText\(p, selectedText\.id, \{ bold:/],
      ["fond", /updateText\(p, selectedText\.id, \{ bg:/],
      ["suppression", /removeText\(p, selectedText\.id\)/],
    ] as const) {
      check(`A-02 · fonction « ${nom} » atteignable`, motif.test(editor));
    }
    check("A-02 · le texte se déplace toujours à la souris", /onDragText=\{\(id, x, y\)/.test(editor) && /cursor-move/.test(preview));
  }

  // ── A-03 · Le son de la vidéo est audible dans l'éditeur ──────────────────
  {
    check("A-03 · plus de lecture automatique muette", !/autoPlay/.test(preview) && !/\bmuted\b\s*$/m.test(preview));
    check("A-03 · commandes de lecture présentes", /setPlaying\(\(p\) => !p\)/.test(preview));
    check("A-03 · coupure du son et volume réglables", /aria-label=\{muted \?/.test(preview) && /aria-label=\{t\("Volume", "Volume"\)\}/.test(preview));
    check("A-03 · curseur de position", /aria-label=\{t\("Position de lecture", "Playback position"\)\}/.test(preview));
  }

  // ── A-04 · Le son d'origine n'est plus supprimé en silence ────────────────
  {
    const projectSrc = read("lib/editor/project.ts");
    check("A-04 · musique posée sous la voix par défaut", /DEFAULT_MUSIC_VOLUME = 0\.25/.test(projectSrc));
    check("A-04 · le son d'origine n'est coupé que sur demande explicite", /role === "original" && a\.muted/.test(preview));
    check("A-04 · la musique est écoutable avant le rendu", /<audio src=\{selectedAudio\.src\} controls/.test(editor));
    check("A-04 · volume et fondus réglables par piste", /updateAudio\(p, selectedAudio\.id, \{ volume: v \}\)/.test(editor) && /fadeIn: v/.test(editor));
  }

  // ── A-01 · Plafond d'import relevé et expliqué ────────────────────────────
  {
    const { MAX_UPLOAD_BYTES, MEDIA_ACCEPT, formatSize } = await import("../lib/media/host");
    check("A-01 · plafond porté à 100 Mo", MAX_UPLOAD_BYTES === 100 * 1024 * 1024, String(MAX_UPLOAD_BYTES));
    check("A-01 · MOV et WebM acceptés", /video\/quicktime/.test(MEDIA_ACCEPT) && /video\/webm/.test(MEDIA_ACCEPT));
    check("A-01 · taille lisible", formatSize(120 * 1024 * 1024) === "120.0 Mo", formatSize(120 * 1024 * 1024));
    check("A-01 · le rejet explique la cause et la sortie", /dépasse sa mémoire/.test(upload) && /Réduisez la durée ou la définition/.test(upload));
    check("A-01 · l'éditeur applique le même plafond", /file\.size > MAX_UPLOAD_BYTES/.test(editor));
  }

  // ── A-09 · Moteur affranchi du CDN externe ────────────────────────────────
  {
    check("A-09 · cœur ffmpeg servi par notre origine", /const base = "\/ffmpeg"/.test(editor) && !/unpkg\.com/.test(editor));
    check("A-09 · les fichiers du moteur sont livrés", existsSync("public/ffmpeg/ffmpeg-core.js") && existsSync("public/ffmpeg/ffmpeg-core.wasm"));
    check("A-09 · dépendance figée dans le projet", /"@ffmpeg\/core":/.test(read("package.json")));
    check("A-09 · encodage plus compact qu'ultrafast", /-preset", "veryfast/.test(read("lib/editor/render-plan.ts")));
  }

  // ── A-08 · Le libellé annonce ce que l'outil fait ─────────────────────────
  {
    check("A-08 · l'outil s'annonce comme un banc de montage", /Banc de montage/.test(editor));
    check("A-08 · le point d'entrée annonce la découpe", /Monter \(texte, musique, découpe\)/.test(compose));
  }

  // ── A-05 · Édition non destructive ────────────────────────────────────────
  {
    check("A-05 · annuler / rétablir câblés", /setHistory\(undo\)/.test(editor) && /setHistory\(redo\)/.test(editor));
    check("A-05 · raccourcis clavier", /e\.shiftKey \? redo\(h\) : undo\(h\)/.test(editor));
    check("A-05 · enregistrement automatique du projet", /setInterval\(async \(\) => \{/.test(editor) && /api\/editor\/projects/.test(editor));
    check("A-05 · reprise d'un projet existant", /projectId\)\}`\)/.test(editor) || /\?id=\$\{encodeURIComponent\(projectId\)\}/.test(editor));
  }

  // ── A-07 · Composition, formats et reprise (lot 3) ───────────────────────
  {
    const library = read("components/editor/ProjectLibrary.tsx");
    check("A-07 · modèles de marque atteignables", /TEMPLATES\.map\(\(tpl\)/.test(editor) && /applyTemplate\(p, tpl\.key, brand, nextId, lang\)/.test(editor));
    check("A-07 · les modèles se calibrent sur le kit de marque", /brandStyleFrom\(d\?\.kit \?\? null\)/.test(editor));
    check("A-07 · changer de format retranspose les textes", /rescaleTextsForFormat\(\{ \.\.\.p, format \}, p\.format\)/.test(editor));
    check("A-07 · recadrage réglable", /setClipFraming\(p, selectedClip\.id, \{ focusX: v \}\)/.test(editor) && /setClipFraming\(p, selectedClip\.id, \{ fit: "contain" \}\)/.test(editor));
    check("A-07 · transition choisie par plan", /setClipTransition\(p, selectedClip\.id, e\.target\.value as TransitionKind\)/.test(editor));
    check("A-07 · l'aperçu montre le cadrage du rendu", /object-contain" : "object-cover/.test(preview) && /objectPosition/.test(preview));
    check("A-07 · incrustation déplaçable à la souris", /onDragImage=\{\(id, x, y\)/.test(editor) && /onDragImage\?\.\(d\.id, x, y\)/.test(preview));
    check("A-07 · bibliothèque de montages", /<ProjectLibrary/.test(editor) && /api\/editor\/projects\?companyId=/.test(library));
    check("A-07 · un montage se reprend depuis la bibliothèque", /onOpen=\{openProject\}/.test(editor) && /onOpen\(r\.id\)/.test(library));
    check("A-07 · un montage se supprime", /method: "DELETE"/.test(library));
    check("A-07 · le montage porte un nom", /placeholder=\{t\("Nom du montage", "Edit name"\)\}/.test(editor));
    check("A-07 · le rendu est rattaché au projet", /renderUrl: hosted\.url/.test(editor));
  }

  // ── B-01 · Un seul système de coordonnées sur la timeline ────────────────
  {
    const timeline = read("components/editor/Timeline.tsx");
    check("B-01 · une seule conversion temps → pixels", /export function timeToPx/.test(timeline));
    check("B-01 · une seule conversion pixels → temps", /export function pxToTime/.test(timeline));
    check("B-01 · les libellés sont sortis du flux temporel",
      /Colonne des libellés — HORS du flux temporel/.test(timeline) && !/<span className="w-12 shrink-0 text-\[9px\][^>]*>\{label\}/.test(timeline));
    check("B-01 · la tête de lecture partage l'origine des blocs",
      /left: timeToPx\(playhead, pxPerSec\)/.test(timeline));
    check("B-01 · les blocs passent par la conversion partagée",
      /left: timeToPx\(clip\.start, pxPerSec\)/.test(timeline) && /left: timeToPx\(start, pxPerSec\)/.test(timeline));
    check("B-01 · la graduation aussi", /left: timeToPx\(s, pxPerSec\)/.test(timeline));
    check("B-01 · le clic est converti sur l'élément du temps",
      /timeRef\.current[\s\S]{0,220}getBoundingClientRect\(\)[\s\S]{0,160}pxToTime\(clientX - rect\.left, pxPerSec\)/.test(timeline));
    check("B-01 · plus de correction manuelle du défilement", !/scrollLeft/.test(timeline));
    check("B-01 · la tête de lecture se tire à la souris",
      /type: "scrub"/.test(timeline) && /setPointerCapture/.test(timeline));
    check("B-01 · la graduation est une zone de balayage",
      /onPointerDown=\{onScrub\}/.test(timeline));
    check("B-01 · la poignée reste saisissable sous le trait",
      /pointer-events-auto/.test(timeline) && /aria-label=\{t\("Tête de lecture", "Playhead"\)\}/.test(timeline));
    check("B-01 · déplacement au clavier", /e\.key === "ArrowLeft"/.test(timeline));
  }

  // ── C-01 · Le rendu serveur répond à l'appel qu'on lui adresse ───────────
  {
    const route = read("app/api/video/render/route.ts");
    check("C-01 · le banc transmet son document", /body: JSON\.stringify\(\{ companyId, project \}\)/.test(editor));
    check("C-01 · la route accepte le document", /if \(body\.project && Array\.isArray\(body\.project\.clips\)\)/.test(route));
    check("C-01 · la projection est faite côté serveur", /toServerEdit\(project, job\.callback\)/.test(route));
    check("C-01 · le document reçu est normalisé", /const project = normalize\(body\.project\)/.test(route));
    check("C-01 · l'ancien contrat est conservé", /cut et assets requis, ou project/.test(route) && /submitRender\(body\.cut/.test(route));
    check("C-01 · le suivi de rendu profite aux deux appelants", /async function openRenderJob/.test(route));
  }

  // ── C-02 / C-03 · L'export grave ce que l'aperçu montre ──────────────────
  {
    const draw = read("lib/editor/draw.ts");
    check("C-02 · un calque par intervalle de temps", /const intervals = overlayIntervals\(project\)/.test(editor));
    check("C-02 · la composition ne suit plus la tête de lecture",
      !/textsAt\(project, playhead\)/.test(editor));
    check("C-02 · chaque calque est activé sur ses bornes",
      /enable='between\(t,/.test(read("lib/editor/render-plan.ts")));
    check("C-03 · les incrustations sont dessinées", /drawImages\(ctx, width, height, images, loaded\)/.test(editor));
    check("C-03 · le dessin des images existe", /export function drawImages/.test(draw));
    check("C-03 · une image d'un autre domaine ne souille pas le canevas",
      /img\.crossOrigin = "anonymous"/.test(draw));
    check("C-03 · une incrustation introuvable ne perd pas l'export",
      /img\.onerror = \(\) => resolve\(null\)/.test(draw));
    check("dessin partagé entre l'aperçu et le rendu",
      /from "@\/lib\/editor\/draw"/.test(editor) && /export function drawTexts/.test(draw));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
