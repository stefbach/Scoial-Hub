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
  const studio = read("components/editor/StudioEditor.tsx");
  const panel = read("components/editor/PropertyPanel.tsx");
  const gallery = read("components/editor/TemplateGallery.tsx");
  const timeline = read("components/editor/Timeline.tsx");
  const preview = read("components/editor/Preview.tsx");
  const upload = read("components/ui/MediaUpload.tsx");
  const compose = read("app/(organic)/compose/page.tsx");
  const host = read("lib/media/host.ts");
  const draw = read("lib/editor/draw.ts");
  const plan = read("lib/editor/render-plan.ts");

  // Les garanties portent sur ce que l'ÉDITEUR permet, pas sur le fichier où
  // le code se trouve : découper un composant de 740 lignes en panneaux ne doit
  // pas faire échouer un contrôle, ni en faire passer un à tort.
  const editor = [studio, panel, gallery, timeline, preview].join("\n");

  // ── A-06 · Le rendu est hébergé publiquement (CRITIQUE) ───────────────────
  {
    check("A-06 · aucune URL blob: transmise comme média final", !/onExport\(\{\s*url:\s*URL\.createObjectURL/.test(editor));
    check("A-06 · le rendu passe par l'hébergement public", /await hostMedia\(companyId, blob, "montage\.mp4", "edited"\)/.test(studio));
    check("A-06 · un échec d'hébergement ne remplace pas le média", /Le média n'a pas été remplacé/.test(editor));
    check("A-06 · le composeur transmet la société", /companyId=\{company\.id\}/.test(compose));
    check("A-06 · règle d'hébergement partagée", /export async function hostMedia/.test(host) && /hostMedia\(companyId, file, file\.name, "compose"\)/.test(upload));
    check("A-06 · les médias importés dans l'éditeur sont hébergés aussi", /hostMedia\(companyId, file, file\.name, "editor"\)/.test(studio));
    // Sans ceci, un import qui échouait à s'héberger restait choisi via son
    // URL blob: locale — inatteignable par le moteur de rendu comme par les
    // réseaux sociaux (audit Editing Bench, P0-1b).
    check("A-06 · un import qui échoue à s'héberger dans MediaUpload est annulé",
      /if \(res\.url\)[\s\S]{0,200}\} else \{[\s\S]{0,400}onChange\(null\)[\s\S]{0,200}setError/.test(upload));
  }

  // ── A-02 · Les calques restent manipulables ───────────────────────────────
  {
    // La cause du bug — un clic qui désélectionnait — ne peut plus exister :
    // la sélection vient de la timeline, pas d'un conteneur d'aperçu.
    check("A-02 · sélection portée par la timeline", /onSelect=\{setSelection\}/.test(studio));
    for (const [nom, motif] of [
      ["contenu", /updateText\(p, text\.id, \{ text: e\.target\.value \}\)/],
      ["taille", /updateText\(p, text\.id, \{ sizePct: v \}\)/],
      ["couleur", /updateText\(p, text\.id, \{ color: c \}\)/],
      ["gras", /updateText\(p, text\.id, \{ bold:/],
      ["fond", /updateText\(p, text\.id, \{ bg:/],
      ["suppression", /removeText\(p, sel\.id\)/],
    ] as const) {
      check(`A-02 · fonction « ${nom} » atteignable`, motif.test(editor));
    }
    check("A-02 · le texte se déplace toujours à la souris", /onLayerChange=\{onLayerChange\}/.test(studio) && /cursor-move/.test(preview));
  }

  // ── A-03 · Le son de la vidéo est audible dans l'éditeur ──────────────────
  {
    check("A-03 · plus de lecture automatique muette", !/autoPlay/.test(preview) && !/\bmuted\b\s*$/m.test(preview));
    // Itération 3 (C-05) : la lecture est remontée au niveau de l'éditeur —
    // la barre d'espace doit pouvoir la piloter depuis n'importe où — donc
    // `playing` est un prop contrôlé, plus un état local à l'aperçu.
    check("A-03 · commandes de lecture présentes", /onClick=\{\(\) => onPlayingChange\(!playing\)\}/.test(preview));
    check("A-03 · coupure du son et volume réglables", /aria-label=\{muted \?/.test(preview) && /aria-label=\{t\("Volume", "Volume"\)\}/.test(preview));
    check("A-03 · curseur de position", /aria-label=\{t\("Position de lecture", "Playback position"\)\}/.test(preview));
  }

  // ── A-04 · Le son d'origine n'est plus supprimé en silence ────────────────
  {
    const projectSrc = read("lib/editor/project.ts");
    check("A-04 · musique posée sous la voix par défaut", /DEFAULT_MUSIC_VOLUME = 0\.25/.test(projectSrc));
    check("A-04 · le son d'origine n'est coupé que sur demande explicite", /role === "original" && a\.muted/.test(preview));
    check("A-04 · la musique est écoutable avant le rendu", /<audio src=\{audio\.src\} controls/.test(panel) && /audioRefs/.test(preview));
    check("A-04 · volume et fondus réglables par piste", /updateAudio\(p, audio\.id, \{ volume: v \}\)/.test(panel) && /fadeIn: v/.test(panel));
  }

  // ── A-01 · Plafond d'import relevé et expliqué ────────────────────────────
  {
    const { MAX_UPLOAD_BYTES, MEDIA_ACCEPT, formatSize } = await import("../lib/media/host");
    check("A-01 · plafond porté à 100 Mo", MAX_UPLOAD_BYTES === 100 * 1024 * 1024, String(MAX_UPLOAD_BYTES));
    check("A-01 · MOV et WebM acceptés", /video\/quicktime/.test(MEDIA_ACCEPT) && /video\/webm/.test(MEDIA_ACCEPT));
    check("A-01 · taille lisible", formatSize(120 * 1024 * 1024) === "120.0 Mo", formatSize(120 * 1024 * 1024));
    check("A-01 · le rejet explique la cause et la sortie", /dépasse sa mémoire/.test(upload) && /Réduisez la durée ou la définition/.test(upload));
    check("A-01 · l'éditeur applique le même plafond", /file\.size > MAX_UPLOAD_BYTES/.test(studio));
  }

  // ── A-09 · Moteur affranchi du CDN externe ────────────────────────────────
  {
    check("A-09 · cœur ffmpeg servi par notre origine", /const base = "\/ffmpeg"/.test(studio) && !/unpkg\.com/.test(editor));
    check("A-09 · les fichiers du moteur sont livrés", existsSync("public/ffmpeg/ffmpeg-core.js") && existsSync("public/ffmpeg/ffmpeg-core.wasm"));
    check("A-09 · dépendance figée dans le projet", /"@ffmpeg\/core":/.test(read("package.json")));
    check("A-09 · encodage plus compact qu'ultrafast", /-preset", "veryfast/.test(read("lib/editor/render-plan.ts")));
  }

  // ── A-08 · Le libellé annonce ce que l'outil fait ─────────────────────────
  {
    check("A-08 · l'outil s'annonce comme un banc de montage", /Banc de montage/.test(studio));
    check("A-08 · le point d'entrée annonce la découpe", /Monter \(texte, musique, découpe\)/.test(compose));
  }

  // ── A-05 · Édition non destructive ────────────────────────────────────────
  {
    check("A-05 · annuler / rétablir câblés", /setHistory\(undo\)/.test(studio) && /setHistory\(redo\)/.test(studio));
    check("A-05 · raccourcis clavier", /e\.shiftKey \? redo\(h\) : undo\(h\)/.test(studio));
    // Itération 3 : `saveNow` est extraite pour être réutilisable par Ctrl+S
    // (chapitre 6) — l'intervalle l'appelle plutôt que de porter sa propre
    // requête, mais le contrat (sauvegarde périodique vers l'API) est le même.
    check("A-05 · enregistrement automatique du projet",
      /setInterval\(\(\) => \{/.test(studio) && /void saveNow\(\)/.test(studio) && /api\/editor\/projects/.test(studio));
    check("A-05 · reprise d'un projet existant", /\?id=\$\{encodeURIComponent\(projectId\)\}/.test(studio));
  }

  // ── A-07 · Composition, formats et reprise (lot 3) ───────────────────────
  {
    const library = read("components/editor/ProjectLibrary.tsx");
    check("A-07 · modèles de marque atteignables", /templates\.map\(\(tpl\)/.test(gallery) && /applyTemplate\(p, key, brand, nextId, lang\)/.test(studio));
    check("A-07 · les modèles se calibrent sur le kit de marque", /brandStyleFrom\(d\?\.kit \?\? null\)/.test(studio));
    check("A-07 · changer de format retranspose les textes", /rescaleTextsForFormat\(\{ \.\.\.p, format \}, p\.format\)/.test(studio));
    check("A-07 · recadrage réglable", /setClipFraming\(p, clip\.id, \{ focusX: v \}\)/.test(panel) && /setClipFraming\(p, clip\.id, \{ fit: "contain" \}\)/.test(panel));
    check("A-07 · transition choisie par plan", /setClipTransition\(p, clip\.id, v as TransitionKind\)/.test(panel));
    check("A-07 · l'aperçu montre le cadrage du rendu", /object-contain" : "object-cover/.test(preview) && /objectPosition/.test(preview));
    check("A-07 · incrustation déplaçable à la souris", /startMove\(e, \{ kind: "image", id: l\.id \}, l\)/.test(preview));
    check("A-07 · bibliothèque de montages", /<ProjectLibrary/.test(studio) && /api\/editor\/projects\?companyId=/.test(library));
    check("A-07 · un montage se reprend depuis la bibliothèque", /onOpen=\{openProject\}/.test(studio) && /onOpen\(r\.id\)/.test(library));
    check("A-07 · un montage se supprime", /method: "DELETE"/.test(library));
    check("A-07 · le montage porte un nom", /placeholder=\{t\("Nom du montage", "Edit name"\)\}/.test(studio));
    check("A-07 · le rendu est rattaché au projet", /renderUrl: hosted\.url/.test(studio));
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
    // Itération 3 (Lot 1) : `scrollLeft` réapparaît légitimement — suivi de
    // la tête de lecture, Maj+molette, ajustement à la fenêtre — mais la
    // conversion clic → temps continue de s'appuyer SEULEMENT sur
    // `getBoundingClientRect()`, jamais sur une correction manuelle : c'est
    // elle qui doit rester libre de toute référence à `scrollLeft`.
    {
      const timeFromEvent = timeline.match(/const timeFromEvent = useCallback\(([\s\S]*?)\n {2}\);/)?.[1] ?? "";
      check("B-01 · la conversion clic → temps n'a pas besoin de corriger le défilement",
        timeFromEvent.length > 0 && !/scrollLeft/.test(timeFromEvent));
    }
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
    // Itération 3 (Lot 4) : c'est `displayProject` qui part au serveur — le
    // même montage filtré des pistes masquées que celui affiché à l'écran
    // (chapitre 9, point 10) — et non plus le document brut.
    check("C-01 · le banc transmet son document",
      /body: JSON\.stringify\(\{ companyId, project: displayProject \}\)/.test(studio));
    check("C-01 · la route accepte le document", /if \(body\.project && Array\.isArray\(body\.project\.clips\)\)/.test(route));
    check("C-01 · la projection est faite côté serveur", /toServerEdit\(project, job\.callback\)/.test(route));
    check("C-01 · le document reçu est normalisé", /const project = normalize\(body\.project\)/.test(route));
    check("C-01 · l'ancien contrat est conservé", /cut et assets requis, ou project/.test(route) && /submitRender\(body\.cut/.test(route));
    check("C-01 · le suivi de rendu profite aux deux appelants", /async function openRenderJob/.test(route));
  }

  // ── C-02 / C-03 · L'export grave ce que l'aperçu montre ──────────────────
  {
    check("C-02 · un calque composé par calque", /const wanted = browserOverlays\(project\)/.test(studio));
    check("C-02 · la composition ne suit plus la tête de lecture",
      !/textsAt\(project, playhead\)/.test(studio));
    check("C-02 · chaque calque est activé sur ses bornes", /enable='between\(t,/.test(plan));
    check("C-03 · les incrustations sont dessinées", /drawImages\(ctx, width, height, \[l\], loaded\)/.test(studio));
    check("C-03 · le dessin des images existe", /export function drawImages/.test(draw));
    check("C-03 · une image d'un autre domaine ne souille pas le canevas",
      /img\.crossOrigin = "anonymous"/.test(draw));
    check("C-03 · une incrustation introuvable ne perd pas l'export",
      /img\.onerror = \(\) => resolve\(null\)/.test(draw));
    check("dessin partagé entre l'aperçu et le rendu",
      /from "@\/lib\/editor\/draw"/.test(editor) && /export function drawTexts/.test(draw));
  }

  // ── B-11 · L'interface occupe l'écran d'un ordinateur ────────────────────
  {
    check("B-11 · plus de modale plafonnée", !/max-w-6xl/.test(studio) && /fixed inset-0 z-50 flex flex-col/.test(studio));
    check("B-11 · trois zones", /lg:grid-cols-\[240px_1fr_300px\]/.test(studio));
    check("B-11 · chaque zone défile indépendamment",
      (studio.match(/overflow-y-auto/g) ?? []).length >= 2 && /min-h-0/.test(studio));
    check("B-11 · la timeline est ancrée en bas", /Timeline ANCRÉE en bas/.test(studio) && /shrink-0 border-t/.test(studio));
  }

  // ── B-10 · Zoom sur la zone de travail ───────────────────────────────────
  {
    check("B-10 · plus de largeur d'aperçu en dur", !/max-w-\[320px\]/.test(preview));
    check("B-10 · l'aperçu occupe l'espace disponible", /ResizeObserver/.test(preview) && /fitScale/.test(preview));
    // Itération 3 (C-02, §4.1b) : un `onWheel` React est un écouteur PASSIF —
    // `preventDefault()` y est silencieusement ignoré, et la page défilait en
    // même temps que le zoom. Corrigé par un écouteur natif non passif posé
    // sur l'élément, seule façon d'empêcher le défilement de la page.
    check("B-10 · zoom à la molette, sans défiler la page",
      /addEventListener\("wheel", onWheelNative, \{ passive: false \}\)/.test(preview) && /e\.preventDefault\(\)/.test(preview));
    check("B-10 · déplacement de la vue", /mode: "pan"/.test(preview));
    check("B-10 · retour à l'ajustement automatique", /const resetView = useCallback\(/.test(preview));
  }

  // ── B-03 · L'aperçu restitue le son ──────────────────────────────────────
  {
    check("B-03 · un élément audio par piste ajoutée",
      /project\.audios\.filter\(\(a\) => a\.role !== "original"\)\.map/.test(preview));
    check("B-03 · les pistes suivent la tête de lecture", /const sourceTime = a\.trimStart \+ \(playhead - a\.start\)/.test(preview));
    check("B-03 · volume et fondus s'entendent avant l'export",
      /a\.volume \* volume \* fadeIn \* fadeOut/.test(preview));
    check("B-03 · une piste coupée reste muette", /if \(!inside \|\| a\.muted \|\| muted\)/.test(preview));
  }

  // ── B-08 · Propriétés visuelles complètes, en saisie numérique ───────────
  {
    check("B-08 · un bloc de propriétés COMMUN", /const patchVisual = \(patch: Partial<VisualLayer>\)/.test(panel));
    for (const [nom, motif] of [
      ["position", /patchVisual\(\{ x: v \/ 100 \}\)/],
      ["rotation", /patchVisual\(\{ rotation: v \}\)/],
      ["opacité", /patchVisual\(\{ opacity: v \/ 100 \}\)/],
      ["largeur", /updateShape\(p, shape\.id, \{ w: v \/ 100 \}\)/],
      ["hauteur", /updateShape\(p, shape\.id, \{ h: v \/ 100 \}\)/],
    ] as const) {
      check(`B-08 · « ${nom} » réglable au clavier`, motif.test(panel));
    }
    check("B-08 · saisie numérique généralisée", /function NumberRow\(/.test(panel));
    check("B-08 · manipulation directe conservée", /mode: "resize"/.test(preview) && /mode: "rotate"/.test(preview));
  }

  // ── B-12 · Alignement et aimantation ─────────────────────────────────────
  {
    check("B-12 · alignement du texte exposé", /updateText\(p, text\.id, \{ align: a \}\)/.test(panel));
    check("B-12 · boutons d'alignement dans le cadre", /function AlignButton\(/.test(panel) && /centerX\(visual/.test(panel));
    check("B-12 · magnétisme au déplacement", /function snapTo\(/.test(preview) && /GUIDES_X/.test(preview));
    check("B-12 · repères visuels", /guides\.x !== null/.test(preview));
  }

  // ── B-09 · Durée saisissable ─────────────────────────────────────────────
  {
    check("B-09 · durée d'un plan au clavier", /setClipLength\(p, clip\.id, v\)/.test(panel));
    check("B-09 · bornes d'un calque au clavier", /label=\{t\("De", "From"\)\}/.test(panel));
  }

  // ── B-02 / B-04 · Multi-piste ────────────────────────────────────────────
  {
    const projectSrc = read("lib/editor/project.ts");
    check("B-04 · un plan porte sa piste", /track: number/.test(projectSrc));
    check("B-04 · la position n'est plus imposée", !/\/\/ ← position IMPOSÉE/.test(projectSrc) && /export function moveClip\(/.test(projectSrc));
    check("B-04 · la timeline affiche chaque piste", /usedTracks\(project\)\]\.reverse\(\)/.test(timeline));
    check("B-04 · un plan change de piste au glisser", /onMoveClip\(d\.clipId, \{ track, start \}\)/.test(timeline));
    check("B-04 · l'aperçu empile les plans", /active\.map\(\(\{ clip \}\)/.test(preview));
    check("B-04 · le rendu serveur empile les pistes", /\.sort\(\(a, b\) => b - a\)/.test(plan));
    check("B-02 · sous-pistes calculées par le modèle", /function packLanes<T/.test(projectSrc));
    check("B-02 · la timeline leur donne de la place", /LANE_H \* l\.rows/.test(timeline));
  }

  // ── B-06 / B-07 / B-13 / B-14 / B-15 · Enrichissement ───────────────────
  {
    const projectSrc = read("lib/editor/project.ts");
    check("B-06 · animations d'entrée et de sortie", /export function layerProgress\(/.test(projectSrc) && /animIn/.test(panel));
    check("B-06 · le fondu est rendu par le navigateur", /alpha=1/.test(plan));
    check("B-06 · les autres animations partent au serveur", /function needsServerAnimation\(/.test(plan));
    check("B-07 · police choisissable", /FONT_STACKS/.test(panel) && /font: v as typeof text\.font/.test(panel));
    check("B-07 · la police est prête AVANT le dessin", /await ensureFontsReady/.test(studio) && /document\.fonts\.load/.test(draw));
    check("B-13 · vignettes engendrées depuis le modèle", /tpl\.slots\.map/.test(gallery));
    check("B-13 · la galerie est atteignable", /<TemplateGallery/.test(studio));
    check("B-14 · calques de forme", /export function drawShapes\(/.test(draw) && /addShape\(p, nextId\("s"\)/.test(studio));
    check("B-14 · modèle de bouton", /export function addButton\(/.test(projectSrc) && /addButton\(/.test(studio));
    check("B-15 · sous-titrage automatique", /api\/editor\/subtitles/.test(studio));
    check("B-15 · les sous-titres restent modifiables",
      /addText\(next, id, seg\.text\)/.test(studio));
  }

  // ── Itération 3, Lot 4 · Robustesse et parité professionnelle ───────────
  {
    const projectSrc = read("lib/editor/project.ts");
    check("Lot 4 · état vide de la timeline", /lanes\.length === 0/.test(timeline));
    check("Lot 4 · montage verrouillé pendant l'export",
      /setExporting\(true\)/.test(studio) && /isExporting && e\.key !== "Escape"/.test(studio));
    check("Lot 4 · repli explicite sous le seuil large (1024 px)",
      /lg:hidden/.test(studio) && /1024/.test(studio));
    check("Lot 4 · double-clic pour éditer un texte dans l'aperçu",
      /onDoubleClick=\{\(e\) => \{/.test(preview) && /setEditingTextId\(l\.id\)/.test(preview));
    check("Lot 4 · verrouillage et masquage de piste",
      /export function isTrackLocked\(/.test(projectSrc) && /export function isTrackHidden\(/.test(projectSrc));
    check("Lot 4 · un seul point de filtrage partagé par l'aperçu et l'export",
      /export function visibleProject\(/.test(projectSrc) &&
      /project={displayProject}/.test(studio) &&
      /body: JSON\.stringify\(\{ companyId, project: displayProject \}\)/.test(studio));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
