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
      ["suppression", /removeText\((p|acc), sel\.id\)/],
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

  // ── P2-19 · Indicateur de sauvegarde (audit Editing Bench v3) ────────────
  // L'enregistrement automatique tournait déjà toutes les 10 s, mais rien à
  // l'écran ne le montrait — et un échec de sauvegarde marquait `dirty` à
  // false SANS avoir réellement sauvegardé, empêchant toute nouvelle tentative.
  {
    check("P2-19 · un horodatage de sauvegarde est affiché",
      /setLastSavedAt\(new Date\(\)\)/.test(studio) && /toLocaleTimeString/.test(studio));
    check("P2-19 · les modifications non enregistrées sont visibles",
      /setDirtyDisplay\(true\)/.test(studio) && /Modifications non enregistrées/.test(studio));
    check("P2-19 · un échec de sauvegarde ne marque plus le projet comme à jour",
      /L'échec laisse `dirty` à true/.test(studio));
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

  // ── P1-6 / P1-8 / P2-8 · Points « à instruire » du Lot 1, débloqués par
  // P0-4 (audit Editing Bench v3) ───────────────────────────────────────────
  {
    check("P1-6 · la musique de bibliothèque sonde sa vraie durée, pas la métadonnée déclarée",
      /const probe = document\.createElement\("audio"\);[\s\S]{0,400}probe\.onloadedmetadata/.test(studio));
    check("P1-8 / P2-8 · centrer/aligner un texte tient compte de son wrapPct",
      /text && text\.wrapPct > 0 \? text\.wrapPct : undefined/.test(panel));
    check("P1-8 / P2-8 · les boutons Centré/À droite utilisent cette largeur",
      /x: centerX\(horizontalWidth\)/.test(panel) && /x: rightX\(horizontalWidth\)/.test(panel));
  }

  // ── P1-5 · Glissement d'une incrustation interrompu (audit Editing Bench v3) ──
  // Vérifié en isolant la différence de comportement entre un texte (glisse
  // sans accroc) et une incrustation (s'arrêtait après le tout premier
  // mouvement) avec un geste Playwright identique : un <img> est glissable
  // NATIVEMENT par le navigateur, contrairement à un <div> de texte — sans
  // draggable={false}, le premier mouvement de souris faisait basculer le
  // geste sur le glisser-déposer natif (fantôme d'image), qui n'envoie plus
  // aucun pointermove à notre logique de déplacement.
  {
    const overlayImg = preview.slice(preview.indexOf("{/* Incrustations */}"));
    check("P1-5 · l'incrustation ne bascule plus sur le glisser-déposer natif du navigateur",
      /draggable=\{false\}[\s\S]{0,80}onPointerDown=\{\(e\) => startMove\(e, \{ kind: "image"/.test(overlayImg));
  }

  // ── P3-2 / P3-3 · En-tête et étiquettes incohérents (audit Editing Bench v3) ──
  {
    // P3-2 : le panneau son affichait le nom du FICHIER en en-tête, seul type
    // à rompre le motif des autres panneaux (« Plan », « Texte », « Forme »),
    // qui affichent tous une catégorie fixe.
    check("P3-2 · le panneau son affiche une catégorie, pas le nom du fichier, en en-tête",
      /title=\{\s*audio\.role === "original"/.test(panel));
    // P3-3 : la même piste s'appelait « Vidéo 2 » dans la timeline mais
    // « Superposée 1 » dans le sélecteur de piste du panneau — deux noms pour
    // le même numéro de piste.
    check("P3-3 · le sélecteur de piste du panneau reprend le nommage de la timeline",
      /n === 0 \? t\("Vidéo", "Video"\) : `\$\{t\("Vidéo", "Video"\)\} \$\{n \+ 1\}`/.test(panel));
    check("P3-3 · l'ancien nommage divergent a disparu", !/t\("Superposée", "Overlay"\)/.test(panel));
  }

  // ── P2-1 / P2-2 · Un plan n'avait aucune propriété commune aux calques
  // visuels (audit Editing Bench v3) ───────────────────────────────────────
  // L'opacité existait sur texte, image et forme (`VisualLayer`) mais pas sur
  // un plan : une incrustation vidéo ne pouvait ni s'estomper, ni se fondre
  // progressivement dans le montage. Champ ajouté au modèle (`Clip.opacity`,
  // `setClipOpacity`) puis exposé ici — réservé aux pistes d'incrustation, la
  // piste de base couvrant déjà tout le cadre.
  {
    check("P2-1/P2-2 · l'opacité d'un plan d'incrustation est réglable dans le panneau",
      /clip\.track > 0 &&/.test(panel) && /setClipOpacity\(p, clip\.id, v \/ 100\)/.test(panel));
    // Position ET taille : la vraie « image dans l'image », une fenêtre
    // d'incrustation posée dans un coin plutôt qu'un plan qui couvre
    // toujours tout le cadre — la moitié la plus visible de P2-1.
    check("P2-1 · le cadre (position, taille) d'un plan d'incrustation est réglable dans le panneau",
      /setClipBox\(p, clip\.id, \{ x: v \/ 100 \}\)/.test(panel) &&
      /setClipBox\(p, clip\.id, \{ y: v \/ 100 \}\)/.test(panel) &&
      /setClipBox\(p, clip\.id, \{ w: v \/ 100 \}\)/.test(panel) &&
      /setClipBox\(p, clip\.id, \{ h: v \/ 100 \}\)/.test(panel));
    // Câblage côté aperçu : glisser-déposer et poignée de redimensionnement
    // pour un plan, sans poignée de rotation (P2-1 exclut délibérément la
    // rotation d'un plan, faute de savoir ce qu'elle signifie pour le
    // moteur de rendu serveur).
    check("P2-1 · un plan d'incrustation se glisse dans l'aperçu",
      /startMove\(e, \{ kind: "clip", id: clip\.id \}, clip\)/.test(preview));
    check("P2-1 · aucune poignée de rotation pour un plan",
      /canRotate: false/.test(preview));
  }

  // ── P0-4 · Le rendu serveur rend la main (audit Editing Bench v3) ────────
  // Avant ce correctif, la fonction s'arrêtait dès la soumission du montage :
  // aucune progression, aucune récupération, aucun résultat affiché. Le
  // fichier produit pouvait même être définitivement perdu si le rappel
  // automatique n'était pas configuré côté serveur.
  {
    check("P0-4 · le rendu serveur est suivi après soumission",
      /fetch\(`\/api\/video\/render\/\$\{encodeURIComponent\(id\)\}`\)/.test(studio));
    check("P0-4 · une progression réelle distingue file d'attente et rendu en cours",
      /renderState === "queued"/.test(studio) && /renderState === "rendering"/.test(studio));
    check("P0-4 · l'URL éphémère du moteur est convertie en stockage durable",
      /api\/media\/persist/.test(studio));
    check("P0-4 · le rendu est enregistré dans la médiathèque même sans rappel automatique",
      /fetch\("\/api\/media", \{[\s\S]{0,320}source: "editor"/.test(studio));
    check("P0-4 · le média du composeur est remplacé par le rendu serveur, comme le rendu navigateur",
      /onExport\(\{ url, name: "montage\.mp4", size: 0, kind: "video" \}\)/.test(studio));
    check("P0-4 · un rendu échoué affiche une raison, pas un silence",
      /renderState === "failed"/.test(studio) && /renderErr/.test(studio));
    check("P0-4 · un second export ne peut pas se déclencher pendant un rendu en cours",
      /renderState === "queued" \|\| renderState === "rendering"/.test(studio));
    check("P0-4 · un lien direct vers la médiathèque est proposé une fois le rendu prêt",
      /href="\/media"/.test(studio));
    check("P0-4 · diagnostic du rappel automatique exposé (WEBHOOK_SECRET)",
      /WEBHOOK_SECRET: Boolean\(process\.env\.WEBHOOK_SECRET\)/.test(read("app/api/health/route.ts")));
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

  // ── P1-11 / P1-12 · Champs numériques du panneau (audit Editing Bench v3) ──
  // Vérifié par capture d'écran réelle (Playwright) pendant le développement :
  // une opacité de 100 % s'affichait tronquée en « 10 » (la vraie valeur était
  // correcte — seules les flèches natives d'incrément, jamais masquées,
  // dévoraient toute la largeur disponible dans une colonne de 300 px
  // partagée en deux) ; le champ Hauteur d'une incrustation affichait un « 0 »
  // en dur au lieu de signaler qu'il s'agit d'une valeur déduite.
  {
    check("P1-11 · le champ Hauteur affiche « auto », pas un 0 en dur",
      /autoLabel=\{t\("auto", "auto"\)\}/.test(panel));
    check("P1-11 · NumberRow sait afficher un filigrane à la place de 0",
      /const isAuto = autoLabel !== undefined && value === 0/.test(panel));
    check("P1-12 · les flèches natives d'incrément ne dévorent plus le champ",
      /\[&::-webkit-inner-spin-button\]:appearance-none/.test(panel));
  }

  // ── B-12 · Alignement et aimantation ─────────────────────────────────────
  {
    check("B-12 · alignement du texte exposé", /updateText\(p, text\.id, \{ align: a \}\)/.test(panel));
    check("B-12 · boutons d'alignement dans le cadre", /function AlignButton\(/.test(panel) && /centerX\(horizontalWidth\)/.test(panel));
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
    check("B-04 · l'aperçu empile les plans", /active\.map\(\(\{ clip, opacity \}\)/.test(preview));
    check("B-04 · le rendu serveur empile les pistes", /\.sort\(\(a, b\) => b - a\)/.test(plan));
    check("B-02 · sous-pistes calculées par le modèle", /function packLanes<T/.test(projectSrc));
    check("B-02 · la timeline leur donne de la place", /LANE_H \* l\.rows/.test(timeline));
  }

  // ── P0-2 · Le fondu enchaîné se voit dans l'aperçu (audit Editing Bench v3) ──
  // Avant ce correctif, ni Preview.tsx ni draw.ts ne référençaient jamais
  // transitionIn : la coupe entre deux plans était toujours sèche à l'écran,
  // quel que soit le réglage choisi dans le panneau de propriétés.
  {
    const projectSrc = read("lib/editor/project.ts");
    check("P0-2 · clipsAt compose le plan sortant ET le plan entrant", /frozen: true/.test(projectSrc));
    check("P0-2 · l'opacité de composition est transmise à l'aperçu", /opacity \}\)/.test(preview));
    check("P0-2 · le plan sortant est figé sur sa dernière image, jamais relancé",
      /if \(frozen\) \{[\s\S]{0,200}v\.pause\(\)/.test(preview));
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

  // ── P1-7 · Langue des sous-titres (audit Editing Bench v3) ──────────────
  // Le sous-titrage forçait systématiquement la langue de L'INTERFACE au
  // service de transcription, indépendamment de la langue réellement parlée
  // dans le média — une voix étrangère ressortait mal transcrite.
  {
    const subtitlesRoute = read("app/api/editor/subtitles/route.ts");
    const replicate = read("lib/ai/replicate.ts");
    check("P1-7 · la langue de l'interface n'est plus imposée à la transcription",
      !/src: source, lang \}/.test(studio) && /subtitleLang \? \{ lang: subtitleLang \}/.test(studio));
    check("P1-7 · sans langue choisie, Whisper détecte lui-même",
      /const lang = body\.lang && SUBTITLE_LANG_CODES\.has\(body\.lang\)/.test(subtitlesRoute));
    check("P1-7 · une langue choisie est validée avant transmission au modèle",
      /SUBTITLE_LANG_CODES/.test(subtitlesRoute));
    check("P1-7 · la traduction vers l'anglais reste un choix explicite, pas un défaut",
      /task: "transcribe" \| "translate" = "transcribe"/.test(replicate));
    check("P1-7 · un sélecteur de langue parlée est proposé dans l'éditeur",
      /subtitleLang/.test(studio) && /SUBTITLE_LANGS\.map/.test(studio));
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

  // ── P2-4 / P3-7 · Sélection multiple et menu contextuel (audit Editing
  // Bench v3, Lot 3) ────────────────────────────────────────────────────────
  // Absente jusqu'ici : la sélection était un objet unique, sans aucun moyen
  // d'agir sur plusieurs éléments à la fois. Maj/Ctrl-clic ajoute un élément
  // à un groupe ; le groupe entier se duplique/supprime en une seule entrée
  // d'historique ; un menu contextuel apparaît sur le groupe (jamais sur un
  // simple élément, qui a déjà la barre d'outils).
  {
    check("P2-4 · Maj/Ctrl/⌘-clic ajoute un élément à la sélection au lieu de la remplacer",
      /if \(sel && e && \(e\.shiftKey \|\| e\.ctrlKey \|\| e\.metaKey\)\)/.test(studio));
    check("P2-4 · les opérations groupées se composent en UNE SEULE entrée d'historique",
      /items\.reduce\(\(acc, sel\) => \{/.test(studio) && /apply\(\(p\) => items\.reduce/.test(studio));
    check("P2-4 · la suppression agit sur tous les éléments sélectionnés",
      /function removeSelection\(\) \{[\s\S]{0,80}const items = selectedItems\(\)/.test(studio));
    check("P2-4 · la duplication agit sur tous les éléments sélectionnés",
      /function duplicateSelection\(\) \{[\s\S]{0,80}const items = selectedItems\(\)/.test(studio));
    check("P2-4 · le panneau de propriétés affiche un résumé neutre plutôt que le seul élément principal",
      /multiSelectionItems\.length > 1/.test(panel) && /éléments sélectionnés/.test(panel));
    check("P2-4 · la timeline reflète la sélection multiple, pas seulement l'élément principal",
      /multiSelectedKeys\?\.has\(/.test(timeline));
    check("P3-7 · un menu contextuel n'apparaît que sur une sélection de groupe",
      /multiSelection\.size === 0 \|\| !inSelection\) return;/.test(studio));
    check("P3-7 · le menu contextuel propose dupliquer ET supprimer le groupe",
      /Dupliquer le groupe/.test(studio) && /Supprimer le groupe/.test(studio));
    check("P3-7 · le clic droit sur la timeline est câblé (plans ET calques)",
      /onContextMenu=\{\(e\) => onContextMenu\?\.\(\{ kind: "clip", id: c\.id \}, e\)\}/.test(timeline) &&
      /onContextMenu=\{\(e\) => onContextMenu\?\.\(\{ kind, id: l\.id \}, e\)\}/.test(timeline));
    check("P2-4 · le raccourci clavier Ctrl/⌘+D et Suppr restent conscients du groupe (pas de fermeture stagnante)",
      /doDuplicateSelection\(\)/.test(studio) && /doRemoveSelection\(\)/.test(studio));
  }

  // ── P2-10 · Formatage et suppression groupés des sous-titres (audit
  // Editing Bench v3, Lot 3) ─────────────────────────────────────────────
  // Une transcription pose souvent plusieurs dizaines de sous-titres d'un
  // coup — les reformater ou les supprimer un par un n'a rien de réaliste.
  // Bâti sur la sélection multiple (P2-4) : le lot part sélectionné dès la
  // transcription terminée, et le panneau de propriétés propose un réglage
  // COMMUN quand tout le groupe est du même type « texte ».
  {
    check("P2-10 · la transcription sélectionne tout le lot posé, pas un sous-titre isolé",
      /newIds\.push\(id\)/.test(studio) && /setMultiSelection\(new Map\(newIds\.map/.test(studio));
    check("P2-10 · le panneau propose un réglage commun quand le groupe est entièrement du même type texte",
      /const allTexts = multiSelectionItems\.every\(\(s\) => s\.kind === "text"\)/.test(panel));
    check("P2-10 · le réglage commun s'applique en une seule entrée d'historique, pas une par sous-titre",
      /textIds\.reduce\(\(acc, id\) => updateText\(acc, id, patch\), p\)/.test(panel));
    check("P2-10 · un groupe mixte (pas seulement des sous-titres) garde le résumé neutre existant",
      /if \(!allTexts\) \{/.test(panel));
  }

  // ── P1-13 · Un calque neuf se pose à la tête de lecture (audit Editing
  // Bench v3, Lot 4) ─────────────────────────────────────────────────────
  // Un texte, une incrustation ou une forme posés aux trois quarts d'une
  // vidéo apparaissaient quand même dès la première image, hors de vue de
  // l'endroit qu'on était justement en train de regarder.
  {
    check("P1-13 · un texte ajouté depuis l'outil se pose à la tête de lecture",
      /addText\(p, nextId\("t"\), t\("Votre texte", "Your text"\), playhead\)/.test(studio));
    check("P1-13 · une forme ajoutée depuis l'outil se pose à la tête de lecture",
      /addShape\(p, nextId\("s"\), s\.kind, brand\.palette\[0\] \?\? "#5b2d8e", playhead\)/.test(studio));
    check("P1-13 · un bouton ajouté depuis l'outil se pose à la tête de lecture",
      /addButton\([\s\S]{0,300}playhead/.test(studio));
    check("P1-13 · une incrustation importée se pose à la tête de lecture",
      /addImageLayer\(p, nextId\("i"\), url, undefined, playhead\)/.test(studio));
  }

  // ── P3-1 · Infobulles sur les boutons à symbole seul (audit Editing Bench
  // v3, Lot 4) ────────────────────────────────────────────────────────────
  // G, ▬, ◌, ◍, les flèches d'alignement, muet/audible : des boutons à
  // symbole seul, sans le moindre texte, sans infobulle ni lecteur d'écran.
  {
    check("P3-1 · Toggle porte désormais un titre explicatif (infobulle + lecteur d'écran)",
      /function Toggle\(\{ on, onClick, title, children \}/.test(panel) &&
      /aria-label=\{title\}/.test(panel));
    check("P3-1 · Gras/Bandeau/Contour/Ombre sont expliqués sur le panneau texte",
      /title=\{t\("Gras", "Bold"\)\}/.test(panel) &&
      /title=\{t\("Bandeau", "Background band"\)\}/.test(panel) &&
      /title=\{t\("Contour", "Outline"\)\}/.test(panel) &&
      /title=\{t\("Ombre", "Shadow"\)\}/.test(panel));
    check("P3-1 · l'alignement de texte est expliqué, pas seulement dessiné en flèches",
      /Aligné à gauche/.test(panel) && /Aligné à droite/.test(panel));
    check("P3-1 · muet/audible s'explique sans avoir à deviner l'émoji",
      /Muet — cliquer pour réactiver/.test(panel) || /Muted — click to unmute/.test(panel));
  }

  // ── P2-12 · Sélecteur de couleur libre (audit Editing Bench v3, Lot 4) ──
  // Les préréglages (blanc, noir, quelques teintes vives, la palette de
  // marque) restaient les 10 SEULES couleurs atteignables — aucune teinte de
  // marque hors palette, aucun ajustement fin, n'avaient nulle part où se
  // poser. Un `<input type="color">` natif ferme cette impasse.
  {
    check("P2-12 · un sélecteur de couleur natif existe, factorisé une seule fois",
      /function ColorSwatches\(/.test(panel) && /type="color"/.test(panel));
    check("P2-12 · le texte (individuel ET groupe de sous-titres) utilise le sélecteur",
      /<ColorSwatches value=\{text\.color\}/.test(panel) &&
      /<ColorSwatches value=\{first\?\.color/.test(panel));
    check("P2-12 · le remplissage ET le contour d'une forme utilisent le sélecteur",
      /<ColorSwatches value=\{shape\.fill\}/.test(panel) &&
      /<ColorSwatches[\s\S]{0,40}value=\{shape\.stroke\}/.test(panel));
    check("P2-12 · aucune ancienne palette codée en dur ne subsiste hors du composant partagé",
      (panel.match(/\[\.\.\.PRESET_COLORS, \.\.\.brand\.palette\]/g) ?? []).length === 1);
  }

  // ── P1-4 · Étiquettes de piste audio (audit Editing Bench v3, Lot 4) ────
  // Trois pistes son simultanées — son d'origine, voix off, musique, l'usage
  // le plus courant — se mélangeaient toutes sous un seul bandeau « Audio »
  // générique, alors que le panneau de propriétés les distingue déjà par
  // catégorie depuis P3-2.
  {
    check("P1-4 · une piste par rôle audio, pas un seul bandeau générique",
      /AUDIO_ROLES/.test(timeline) &&
      /\{ role: "original", fr: "Son d'origine", en: "Original audio" \}/.test(timeline) &&
      /\{ role: "voice", fr: "Voix off", en: "Voiceover" \}/.test(timeline) &&
      /\{ role: "music", fr: "Musique", en: "Music" \}/.test(timeline));
    check("P1-4 · chaque piste ne montre que les pistes de SON de son propre rôle",
      /const onRole = project\.audios\.filter\(\(a\) => a\.role === role\)/.test(timeline));
  }

  // ── P2-9 / P2-15 · Ancrages multiples et verrouillage de proportions
  // (audit Editing Bench v3, Lot 4) ────────────────────────────────────────
  // Une seule poignée (bas-droite) existait : agrandir vers le haut ou la
  // gauche exigeait de déplacer le calque d'abord. Aucun moyen de conserver
  // les proportions pendant un redimensionnement libre.
  {
    check("P2-9 · quatre coins, pas un seul, redimensionnent le calque",
      /const CORNERS: \{ left: boolean; top: boolean/.test(preview) &&
      (preview.match(/left: (true|false), top: (true|false)/g) ?? []).length === 4);
    check("P2-9 · le coin saisi fixe le coin OPPOSÉ (x/y suivent le côté gauche/haut)",
      /let x = d\.left \? d\.ox \+ dx : d\.ox/.test(preview) &&
      /y = d\.top \? d\.oy \+ dy : d\.oy/.test(preview));
    check("P2-15 · Maj enfoncée pendant le geste conserve les proportions",
      /if \(e\.shiftKey && d\.oh > 0 && d\.ow > 0\)/.test(preview) &&
      /h = w \* \(d\.oh \/ d\.ow\)/.test(preview));
    check("P2-9/P2-15 · l'infobulle du redimensionnement mentionne le raccourci",
      /Maj.*conserver les proportions|Shift.*keep proportions/.test(preview));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
