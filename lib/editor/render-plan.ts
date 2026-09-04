// Traduction du document de projet vers les DEUX moteurs de rendu.
//
// Le même document alimente le rendu navigateur (ffmpeg.wasm) et le rendu
// serveur (Shotstack). C'est ce qui garantit que l'aperçu et le fichier exporté
// décrivent le même montage : il n'existe qu'une seule description, projetée
// deux fois.
//
// Module PUR : il ne rend rien, il décrit ce qu'il faut rendre.

import {
  ANIMATION_SECONDS,
  CLIP_TRANSITION_SECONDS,
  FORMAT_SIZE,
  hasImageAdjust,
  hasKeyframes,
  transitionSpan,
  keyframesOf,
  projectDuration,
  projectHasKeyframes,
  type Animatable,
  type AnimatableProp,
  type Keyframe,
  type AnimationKind,
  type AudioTrack,
  type Clip,
  type EditorProject,
  type ShapeLayer,
  type TransitionKind,
} from "./project";

/**
 * Chaîne de filtres qui inscrit un plan dans le format de publication.
 *
 * Sans elle, le fichier exporté conservait la définition de la source : choisir
 * « 9:16 » ne changeait rien au fichier produit, et le calque de texte — composé
 * lui à la taille du format — se retrouvait décalé. Les deux moteurs appliquent
 * désormais le même cadrage.
 */
export function frameFilterSteps(clip: Clip, size: { width: number; height: number }): string[] {
  const { width: W, height: H } = size;
  if (clip.fit === "contain") {
    return [
      `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`,
      "setsar=1",
    ];
  }
  // `cover` : on agrandit jusqu'à remplir, puis on rogne AUTOUR du point
  // d'intérêt — un visage cadré à gauche ne sort plus du champ.
  const fx = clip.focusX.toFixed(3);
  const fy = clip.focusY.toFixed(3);
  return [
    `scale=${W}:${H}:force_original_aspect_ratio=increase`,
    `crop=${W}:${H}:(in_w-out_w)*${fx}:(in_h-out_h)*${fy}`,
    "setsar=1",
  ];
}

/* ────────────────────────────────────────────────────────────────────────────
   Aiguillage
   ──────────────────────────────────────────────────────────────────────── */

export type RenderTarget = "browser" | "server";

/**
 * Seuils d'aiguillage. Le rendu navigateur est gratuit et ne fait sortir aucune
 * donnée, mais ffmpeg.wasm s'exécute en WebAssembly 32 bits : au-delà d'environ
 * 100 Mo de source l'onglet se bloque, et un montage long en mono-thread prend
 * des dizaines de minutes. Au-delà de ces seuils, le serveur prend la main.
 */
export const BROWSER_LIMITS = {
  /** Poids cumulé des sources. */
  maxBytes: 80 * 1024 * 1024,
  /**
   * Nombre de plans. Le plan navigateur ne décrit QU'UN plan — dès qu'il y en
   * a deux, seul le premier était encodé et les autres disparaissaient du
   * fichier sans le moindre message. Le seuil était à 3 : un montage à deux ou
   * trois plans passait donc par l'onglet et perdait la moitié du film.
   * Tout montage assemblé part au serveur, qui sait les enchaîner.
   */
  maxClips: 1,
  /**
   * Plafond RELEVÉ pour un montage qui utilise des fonctions que SEUL le
   * navigateur sait rendre — images-clés, correction d'image. Le moteur sait
   * désormais enchaîner les plans (`toBrowserPlan`), mais on ne déplace pas
   * pour autant les montages ordinaires : le serveur les rend bien, et
   * changer leur chemin sans raison serait un risque gratuit. Ce plafond ne
   * s'applique donc qu'aux montages qui n'auraient nulle part ailleurs où
   * aller sans perdre ce qu'on y a réglé.
   */
  maxClipsAnimated: 8,
  /** Durée du film. */
  maxSeconds: 120,
};

export interface RenderDecision {
  target: RenderTarget;
  /** Motif du basculement, affichable tel quel. */
  reason: string;
  /**
   * Le montage porte des images-clés que le moteur retenu NE RENDRA PAS.
   * Seul le navigateur sait les rendre (par échantillonnage) ; quand un autre
   * critère impose le serveur, les calques animés y sortent figés sur leur
   * valeur de départ. On le dit — livrer un fichier amputé de son animation
   * sans avertir serait exactement le genre de silence que cet audit traque.
   */
  keyframesFrozen?: boolean;
}

/**
 * Choisit le moteur. L'utilisateur ne choisit pas : il clique « Exporter » et
 * le système décide. Un rendu serveur libère en outre l'onglet — il peut fermer
 * sa fenêtre, le fichier l'attend dans sa bibliothèque.
 */
export function decideRenderTarget(p: EditorProject, totalSourceBytes: number): RenderDecision {
  const duration = projectDuration(p);
  const browserOnly = needsBrowserEngine(p);
  /** Le serveur ne rend ni les images-clés ni la correction d'image. */
  const toServer = (reason: string): RenderDecision =>
    unrenderableFeatures(p, "server").length > 0
      ? { target: "server", reason, keyframesFrozen: true }
      : { target: "server", reason };

  // Une incrustation vidéo — un plan posé sur une piste supérieure — n'est
  // composée que par le serveur. Le navigateur enchaîne la piste de base ; il
  // ne superpose pas deux flux vidéo.
  const base = baseTrackClips(p);
  if (base.length < p.clips.length) return toServer("incrustation vidéo");

  if (totalSourceBytes > BROWSER_LIMITS.maxBytes) return toServer("sources volumineuses");
  // Le plafond de plans dépend de ce que le montage exige : relever le plafond
  // pour TOUT le monde déplacerait des montages qui sortent très bien du
  // serveur aujourd'hui, sans rien y gagner.
  const maxClips = browserOnly ? BROWSER_LIMITS.maxClipsAnimated : BROWSER_LIMITS.maxClips;
  if (base.length > maxClips) return toServer("montage à plusieurs plans");
  if (duration > BROWSER_LIMITS.maxSeconds) return toServer("film long");
  if (browserOverlays(p).length > MAX_BROWSER_OVERLAYS) return toServer("calques nombreux");
  // Les images-clés priment sur ce critère : un glissement animé par clés est
  // rendu par la séquence de PNG, pas par l'animation d'entrée/sortie que
  // seul le serveur sait faire.
  if (!browserOnly && needsServerAnimation(p)) return toServer("animations");
  if (projectHasKeyframes(p) && keyframeFrameCount(p) > MAX_KEYFRAME_FRAMES) {
    return toServer("images-clés trop longues à composer");
  }
  // Le navigateur rend les calques animés, les volumes animés et la
  // correction d'image, mais pas le CADRE animé d'un plan : si le montage en
  // anime un, on le dit aussi.
  const frozen = unrenderableFeatures(p, "browser").length > 0;
  return {
    target: "browser",
    reason: browserOnly ? "montage léger, éléments animés" : "montage léger",
    ...(frozen ? { keyframesFrozen: true } : {}),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Rendu serveur — timeline Shotstack
   ──────────────────────────────────────────────────────────────────────── */

/** Couleur hexadécimale sûre (le moteur refuse toute autre forme). */
function safeHex(v: string | undefined, fallback: string): string {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

/** Position verticale Shotstack la plus proche d'une fraction de cadre. */
function bandFor(y: number): "top" | "center" | "bottom" {
  if (y < 0.33) return "top";
  if (y > 0.66) return "bottom";
  return "center";
}

/**
 * Construit la timeline serveur à partir du projet.
 * Les bornes temporelles des calques sont transmises telles quelles : c'est ce
 * qui permet enfin à un titre de n'apparaître que sur les trois premières
 * secondes, ce que l'ancien aplatissement en une image unique interdisait.
 */
/** Correspondance des animations vers les transitions du moteur serveur. */
const SERVER_TRANSITION: Record<AnimationKind, string | undefined> = {
  none: undefined,
  fade: "fade",
  "slide-up": "slideUp",
  "slide-down": "slideDown",
  "slide-left": "slideLeft",
  "slide-right": "slideRight",
  zoom: "zoom",
};

function transitionFor(l: { animIn: AnimationKind; animOut: AnimationKind }) {
  const inKind = SERVER_TRANSITION[l.animIn];
  const outKind = SERVER_TRANSITION[l.animOut];
  if (!inKind && !outKind) return {};
  return { transition: { ...(inKind ? { in: inKind } : {}), ...(outKind ? { out: outKind } : {}) } };
}

/**
 * Correspondance des transitions de PLAN (TransitionKind) vers les valeurs du
 * moteur serveur. Distincte de SERVER_TRANSITION (animations de calque,
 * AnimationKind) — l'export échouait systématiquement (« Bad Request ») car
 * "dissolve" était transmis tel quel : le moteur ne connaît pas cette valeur,
 * seulement "fade" (audit Editing Bench, P0-1a).
 */
const CLIP_TRANSITION: Record<TransitionKind, string | undefined> = {
  none: undefined,
  fade: "fade",
  // Un fondu enchaîné ENTRE deux plans est, pour le moteur, un « fade » —
  // il n'a pas de valeur "dissolve" distincte.
  dissolve: "fade",
  // Balayages et glissements : le moteur les connaît sous ces noms. Un nom
  // qu'il ignore fait échouer TOUT l'export en « Bad Request » (P0-1a), donc
  // chaque valeur ajoutée ici doit exister dans sa documentation.
  "wipe-left": "wipeLeft",
  "wipe-right": "wipeRight",
  "slide-up": "slideUp",
  "slide-down": "slideDown",
};

/** Le même choix, pour le filtre `xfade` de ffmpeg côté navigateur. */
const XFADE_TRANSITION: Record<TransitionKind, string | undefined> = {
  none: undefined,
  fade: "fade",
  dissolve: "dissolve",
  "wipe-left": "wipeleft",
  "wipe-right": "wiperight",
  "slide-up": "slideup",
  "slide-down": "slidedown",
};

/** Élément HTML d'une forme — le moteur ne connaît pas de type « forme ». */
function shapeHtml(l: ShapeLayer, size: { width: number; height: number }): string {
  const w = Math.round(l.w * size.width);
  const h = Math.round(l.h * size.height);
  const stroke = l.strokeWidth > 0 ? `border:${Math.round(l.strokeWidth * size.width)}px solid ${safeHex(l.stroke, "#000000")};` : "";
  const radius =
    l.shape === "ellipse" ? "50%" : l.shape === "round" ? `${Math.round(l.radius * size.width)}px` : "0";
  return `<div style="width:${w}px;height:${h}px;background:${safeHex(l.fill, "#000000")};border-radius:${radius};${stroke}"></div>`;
}

export function toServerEdit(p: EditorProject, callback?: string) {
  const size = FORMAT_SIZE[p.format];

  const videoClips = p.clips.map((c: Clip) => {
    // Un plan « plein cadre » (la valeur par défaut, celle de tout plan de
    // piste de base) garde exactement le comportement d'avant ce champ : le
    // recadrage se fait par décalage du point d'intérêt, `width`/`height`/
    // `position` restent absents. Un cadre réduit — une incrustation posée en
    // fenêtre plutôt qu'en plein cadre — passe par les propriétés dédiées du
    // moteur : `width`/`height` en pixels bornent le cadre, `position:
    // "topLeft"` l'ancre en haut à gauche, `offset` (en fraction du format
    // ENTIER, quel que soit le cadre du plan — la même unité que pour le
    // recadrage ci-dessus) le déplace ensuite à la position voulue. Composer
    // les deux décalages (position du cadre ET recentrage du point d'intérêt)
    // n'est pas couvert ici : une fenêtre d'incrustation reste recadrée au
    // centre de sa source (audit Editing Bench, P2-1).
    const fullFrame = c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1;
    return {
      asset: {
        type: c.kind === "image" ? "image" : "video",
        src: c.src,
        ...(c.kind === "video"
          ? {
              trim: c.trimStart > 0 ? c.trimStart : undefined,
              speed: c.speed !== 1 ? c.speed : undefined,
              // Le son embarqué du plan est désormais sa propre propriété
              // (Lot A4) — plus une déduction depuis sa piste. Le moteur
              // serveur ne transmet ici que le niveau (0 = coupé) : un fondu
              // dédié au son embarqué d'un PLAN, distinct du fondu d'une
              // piste `audio` séparée, n'a pas de support documenté côté
              // moteur — seul le rendu navigateur (ffmpeg, plus bas) l'applique.
              ...(c.muted || c.volume !== 1 ? { volume: c.muted ? 0 : c.volume } : {}),
            }
          : {}),
      },
      start: c.start,
      length: c.length,
      fit: c.fit,
      ...(fullFrame
        // Décalage qui ramène le point d'intérêt au centre du cadre (y positif
        // = vers le haut chez Shotstack). Sans objet quand la source entière
        // tient.
        ? (c.fit === "cover" && (c.focusX !== 0.5 || c.focusY !== 0.5)
          ? { offset: { x: 0.5 - c.focusX, y: c.focusY - 0.5 } }
          : {})
        : {
            width: Math.round(c.w * size.width),
            height: Math.round(c.h * size.height),
            position: "topLeft" as const,
            offset: { x: c.x, y: -c.y },
          }),
      ...(c.opacity !== 1 ? { opacity: c.opacity } : {}),
      ...(CLIP_TRANSITION[c.transitionIn] ? { transition: { in: CLIP_TRANSITION[c.transitionIn] } } : {}),
    };
  });

  const textClips = p.texts.map((l) => ({
    asset: {
      type: "title",
      text: l.text,
      style: "subtitle",
      size: l.sizePct >= 0.1 ? "large" : l.sizePct >= 0.06 ? "medium" : "small",
      position: bandFor(l.y),
      color: safeHex(l.color, "#ffffff"),
      ...(l.bg ? { background: "#000000" } : {}),
    },
    start: l.start,
    length: Math.max(0.1, l.end - l.start),
    ...(l.opacity !== 1 ? { opacity: l.opacity } : {}),
    ...transitionFor(l),
  }));

  const imageClips = p.images.map((l) => ({
    asset: { type: "image", src: l.src },
    start: l.start,
    length: Math.max(0.1, l.end - l.start),
    fit: "none",
    scale: l.scale,
    opacity: l.opacity,
    offset: { x: l.x - 0.5, y: 0.5 - l.y },
    ...transitionFor(l),
  }));

  const shapeClips = p.shapes.map((l) => ({
    asset: {
      type: "html",
      html: shapeHtml(l, size),
      width: Math.round(l.w * size.width),
      height: Math.round(l.h * size.height),
    },
    start: l.start,
    length: Math.max(0.1, l.end - l.start),
    opacity: l.opacity,
    offset: { x: l.x + l.w / 2 - 0.5, y: 0.5 - (l.y + l.h / 2) },
    ...transitionFor(l),
  }));

  const audioTracks = p.audios
    .filter((a) => !a.muted && a.length > 0)
    .map((a: AudioTrack) => ({
      asset: {
        type: "audio",
        src: a.src,
        trim: a.trimStart > 0 ? a.trimStart : undefined,
        volume: a.volume,
        effect: a.fadeIn > 0 && a.fadeOut > 0 ? "fadeInFadeOut" : a.fadeIn > 0 ? "fadeIn" : a.fadeOut > 0 ? "fadeOut" : undefined,
      },
      start: a.start,
      length: a.length,
    }));

  // Chaque piste PARTAGÉE (voir `TrackDef` dans project.ts) devient une piste
  // Shotstack — un plan, un texte, une incrustation, une forme peuvent
  // désormais se succéder sur la MÊME piste, dans l'ordre choisi par
  // l'utilisateur, plutôt qu'un ordre imposé par le type d'élément (Lot A3,
  // audit Editing Bench v4). Ordre des pistes Shotstack : la PREMIÈRE est
  // au-dessus — la piste partagée la plus en AVANT (index le plus haut dans
  // `p.tracks`) passe donc en premier.
  const visualTracks = (p.tracks ?? []).filter((tr) => tr.family === "visual").slice().reverse();
  const clipsOfTrack = (trackId: string) => [
    // À piste égale, même ordre que `visualElementsAt` : plan, forme,
    // incrustation, texte — l'ordre déjà en vigueur avant cette refonte.
    ...p.clips.flatMap((c, i) => (c.trackId === trackId ? [videoClips[i]] : [])),
    ...p.shapes.flatMap((l, i) => (l.trackId === trackId ? [shapeClips[i]] : [])),
    ...p.images.flatMap((l, i) => (l.trackId === trackId ? [imageClips[i]] : [])),
    ...p.texts.flatMap((l, i) => (l.trackId === trackId ? [textClips[i]] : [])),
  ];
  const visualShotstackTracks = visualTracks
    .map((tr) => ({ clips: clipsOfTrack(tr.id) }))
    .filter((t) => t.clips.length > 0);

  const tracks = [
    ...(visualShotstackTracks.length ? visualShotstackTracks : [{ clips: [] }]),
    ...(audioTracks.length ? [{ clips: audioTracks }] : []),
  ];

  return {
    timeline: { background: "#000000", tracks },
    output: { format: "mp4", size, fps: 30 },
    ...(callback ? { callback } : {}),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Rendu navigateur — plan d'exécution ffmpeg
   ──────────────────────────────────────────────────────────────────────── */

export interface BrowserRenderPlan {
  /** Fichiers à écrire dans le système de fichiers virtuel, dans cet ordre. */
  inputs: { name: string; src: string }[];
  /** Arguments passés à ffmpeg. */
  args: string[];
  /** Nom du fichier de sortie. */
  output: string;
}

/** Un PNG portant UN calque, avec ses bornes et son animation. */
export interface OverlayInput {
  name: string;
  /** Identifiant du calque composé — l'appelant sait quoi dessiner. */
  layerId: string;
  kind: "shape" | "image" | "text";
  start: number;
  end: number;
  animIn: AnimationKind;
  animOut: AnimationKind;
  /**
   * Nombre d'images à composer. 1 = un PNG fixe, gravé sur tout l'intervalle
   * comme depuis toujours. Au-delà, le calque porte des images-clés : il est
   * échantillonné en une SÉQUENCE de PNG, une par pas de temps, et c'est cette
   * séquence qui est incrustée. Le dessin est celui de l'aperçu, appelé aux
   * mêmes instants — l'export ne peut donc pas diverger de ce qu'on voit.
   */
  frames: number;
  /** Cadence de la séquence, en images par seconde. Ignoré si `frames` vaut 1. */
  fps: number;
}

/**
 * Cadence d'échantillonnage d'un calque animé. Douze images par seconde
 * suffisent à lire un mouvement de calque — ce n'est pas de la vidéo — et
 * gardent le nombre de PNG à composer dans ce que l'onglet supporte.
 */
export const KEYFRAME_FPS = 12;

/**
 * Plafond du nombre TOTAL d'images composées pour les calques animés. Chaque
 * image est un PNG au format de sortie : au-delà, la mémoire de l'onglet ne
 * suit plus. Le montage part alors au serveur — qui ne sait pas rendre les
 * images-clés, ce que la décision de rendu signale explicitement plutôt que
 * de livrer un fichier où l'animation aurait disparu en silence.
 */
export const MAX_KEYFRAME_FRAMES = 360;

/**
 * Expression ffmpeg d'un volume animé par images-clés.
 *
 * Le filtre `volume` accepte une expression évaluée à chaque image (`eval=frame`)
 * — c'est la SEULE propriété animée que la chaîne de filtres sait rendre
 * nativement, sans passer par une séquence d'images. `offset` traduit le temps
 * du flux audio en temps du film : la piste est décodée depuis son propre
 * zéro, mais ses clés sont posées sur la timeline.
 *
 * Les accélérations sont reproduites à l'identique de `EASINGS` côté modèle —
 * une courbe qui diffèrerait entre l'aperçu et l'export serait pire que pas de
 * courbe du tout. Renvoie null s'il n'y a rien à animer.
 */
export function volumeExpression(el: Animatable, offset: number): string | null {
  const keys = keyframesOf(el, "volume");
  if (keys.length === 0) return null;
  const T = `(t+${offset.toFixed(3)})`;
  const v = (n: number) => n.toFixed(4);
  if (keys.length === 1) return v(keys[0].value);

  /** Progression 0..1 dans le segment, courbée comme dans le modèle. */
  const eased = (a: Keyframe, b: Keyframe): string => {
    const q = `((${T}-${a.time.toFixed(3)})/${(b.time - a.time).toFixed(3)})`;
    if (a.easing === "ease-in") return `pow(${q},2)`;
    if (a.easing === "ease-out") return `(1-pow(1-${q},2))`;
    if (a.easing === "ease-in-out") return `if(lt(${q},0.5),2*pow(${q},2),1-pow(-2*${q}+2,2)/2)`;
    return q;
  };

  // Construit de la FIN vers le début : chaque segment enveloppe le suivant.
  let expr = v(keys[keys.length - 1].value);
  for (let i = keys.length - 2; i >= 0; i -= 1) {
    const a = keys[i];
    const b = keys[i + 1];
    const seg = b.time - a.time <= 0
      ? v(b.value)
      : `${v(a.value)}+${v(b.value - a.value)}*(${eased(a, b)})`;
    expr = `if(lt(${T},${b.time.toFixed(3)}),${seg},${expr})`;
  }
  // Avant la première clé, la valeur de cette clé — même règle que `valueAt`.
  return `if(lt(${T},${keys[0].time.toFixed(3)}),${v(keys[0].value)},${expr})`;
}

/**
 * Propriétés animées que le moteur retenu NE SAURA PAS rendre.
 *
 * Le navigateur échantillonne les calques en séquences de PNG et sait animer
 * un volume par expression ; il ne sait pas animer le CADRE d'un plan, qui
 * demanderait une expression temporelle dans la chaîne de mise au format. Le
 * serveur, lui, ne rend aucune image-clé. Nommer précisément ce qui sera figé
 * vaut mieux qu'un avertissement vague — ou pire, que le silence.
 */
/**
 * Fonctions que le moteur retenu ne saura pas rendre, nommées pour l'utilisateur.
 * Le silence sur ce point produirait un fichier amputé sans que personne ne
 * comprenne pourquoi.
 */
export function unrenderableFeatures(p: EditorProject, target: RenderTarget): string[] {
  const out: string[] = [];
  const props = unrenderableKeyframes(p, target);
  if (props.length > 0) out.push("images-clés");
  // La correction d'image passe par le filtre `eq` : le moteur serveur n'a pas
  // d'équivalent, il rendrait l'image d'origine.
  if (target === "server" && p.clips.some((c) => hasImageAdjust(c))) out.push("correction d'image");
  return out;
}

/** Vrai si le montage utilise une fonction que SEUL le navigateur sait rendre. */
export function needsBrowserEngine(p: EditorProject): boolean {
  return projectHasKeyframes(p) || p.clips.some((c) => hasImageAdjust(c));
}

export function unrenderableKeyframes(p: EditorProject, target: RenderTarget): AnimatableProp[] {
  const found = new Set<AnimatableProp>();
  const collect = (el: { keyframes?: Record<string, unknown> }, allowed: AnimatableProp[]) => {
    for (const prop of Object.keys(el.keyframes ?? {}) as AnimatableProp[]) {
      if (!hasKeyframes(el as Animatable, prop)) continue;
      if (!allowed.includes(prop)) found.add(prop);
    }
  };
  const none: AnimatableProp[] = [];
  const layerOk: AnimatableProp[] = target === "browser" ? ["x", "y", "opacity", "rotation", "scale"] : none;
  const clipOk: AnimatableProp[] = target === "browser" ? ["volume"] : none;
  const audioOk: AnimatableProp[] = target === "browser" ? ["volume"] : none;

  for (const c of p.clips) collect(c, clipOk);
  for (const l of [...p.texts, ...p.images, ...p.shapes]) collect(l, layerOk);
  for (const a of p.audios) collect(a, audioOk);
  return [...found];
}

/** Nom du fichier d'une image de séquence — partagé avec qui écrit les fichiers. */
export function overlayFrameName(pattern: string, index: number): string {
  return pattern.replace("%03d", String(index).padStart(3, "0"));
}

/** Nombre d'images à composer pour un calque, et leur cadence. */
export function sampleCount(start: number, end: number): number {
  const span = Math.max(0, end - start);
  return Math.max(2, Math.ceil(span * KEYFRAME_FPS) + 1);
}

/**
 * Liste les calques à composer, dans l'ordre de dessin.
 *
 * L'export navigateur composait un seul PNG, pris à la position de la tête de
 * lecture, puis le gravait sur toute la durée : les bornes d'apparition
 * n'étaient pas respectées, et un texte hors de cette position disparaissait
 * du fichier produit sans le moindre avertissement.
 *
 * Un PNG PAR CALQUE plutôt que par intervalle : chacun porte alors ses propres
 * bornes ET sa propre animation, sans que deux calques superposés aient à
 * partager le même sort.
 */
export function browserOverlays(p: EditorProject): OverlayInput[] {
  if (projectDuration(p) <= 0) return [];
  // Ordre de dessin piloté par la piste partagée (Lot A3, audit Editing
  // Bench v4) — plus un ordre imposé par le type d'élément. À piste égale,
  // même ordre qu'avant cette refonte : forme, puis incrustation, puis
  // texte (tri stable — voir `visualElementsAt` dans project.ts).
  const order = new Map((p.tracks ?? []).filter((tr) => tr.family === "visual").map((tr, i) => [tr.id, i]));
  const trackIndex = (trackId: string): number => order.get(trackId) ?? -1;
  const ordered = [
    ...p.shapes.map((l) => ({ l, kind: "shape" as const })),
    ...p.images.map((l) => ({ l, kind: "image" as const })),
    ...p.texts.map((l) => ({ l, kind: "text" as const })),
  ].sort((a, b) => trackIndex(a.l.trackId) - trackIndex(b.l.trackId));
  return ordered.map(({ l, kind }, i) => {
    const animated = hasKeyframes(l);
    const frames = animated ? sampleCount(l.start, l.end) : 1;
    return {
      // Une séquence est désignée à ffmpeg par un MOTIF, pas par un fichier.
      name: animated ? `ov${i}_%03d.png` : `ov${i}.png`,
      layerId: l.id,
      kind,
      start: l.start,
      end: l.end,
      animIn: l.animIn,
      animOut: l.animOut,
      frames,
      fps: KEYFRAME_FPS,
    };
  });
}

/** Total des images à composer pour les calques animés du montage. */
export function keyframeFrameCount(p: EditorProject): number {
  return browserOverlays(p).reduce((n, o) => n + (o.frames > 1 ? o.frames : 0), 0);
}

/** Au-delà, la chaîne de filtres devient trop longue pour l'onglet. */
export const MAX_BROWSER_OVERLAYS = 12;

/**
 * Animations que le moteur du navigateur sait rendre FIDÈLEMENT.
 * Un fondu se traduit exactement par un fondu sur la couche alpha. Un
 * glissement ou un zoom demanderaient des expressions temporelles par calque :
 * plutôt que de les approximer — et de faire mentir l'aperçu — le montage part
 * au serveur, qui les rend nativement.
 */
const BROWSER_ANIMATIONS = new Set<AnimationKind>(["none", "fade"]);

function needsServerAnimation(p: EditorProject): boolean {
  return [...p.texts, ...p.images, ...p.shapes].some(
    (l) => !BROWSER_ANIMATIONS.has(l.animIn) || !BROWSER_ANIMATIONS.has(l.animOut)
  );
}

/**
 * Construit le plan d'un montage à UN plan — le cas que le navigateur prend en
 * charge. Les montages multi-plans partent au serveur (voir l'aiguillage), ce
 * qui évite de réimplémenter une chaîne de concaténation fragile dans l'onglet.
 *
 * `overlays` sont les PNG de calques composés par le canvas, chacun avec ses
 * bornes : le moteur ne les affiche que sur leur intervalle. La même fonction
 * de dessin sert à l'aperçu et au rendu, ce qui garantit que l'un ressemble à
 * l'autre.
 */
export interface BrowserRenderOptions {
  /** Cadence du fichier produit. 60 pour un mouvement fluide, 30 par défaut. */
  fps?: 30 | 60;
  /** « high » encode plus lentement pour un fichier plus propre. */
  quality?: "standard" | "high";
}

/** Réglages d'encodage, par qualité. */
const ENCODE: Record<"standard" | "high", { preset: string; crf: string; audioBitrate: string }> = {
  // `veryfast` + CRF 23 : le fichier est nettement plus léger qu'avec
  // `ultrafast`, ce qui accélère ensuite l'envoi vers les réseaux sociaux.
  standard: { preset: "veryfast", crf: "23", audioBitrate: "128k" },
  // Deux crans plus lent pour environ 40 % de débit en plus à qualité perçue
  // égale — le compromis qui vaut la peine sur un montage qu'on garde.
  high: { preset: "medium", crf: "19", audioBitrate: "192k" },
};

/** Le filtre `eq` correspondant aux corrections d'un plan, ou null. */
function eqFilter(c: Clip): string | null {
  if (!hasImageAdjust(c)) return null;
  // Mêmes conversions que `cssImageFilter` : luminosité additive, contraste et
  // saturation multiplicatifs autour de 1. L'aperçu et le rendu partent donc
  // des mêmes nombres, et ne peuvent pas diverger.
  const b = (c.brightness ?? 0).toFixed(3);
  const k = (1 + (c.contrast ?? 0)).toFixed(3);
  const sat = (1 + (c.saturation ?? 0)).toFixed(3);
  return `eq=brightness=${b}:contrast=${k}:saturation=${sat}`;
}

/**
 * Plans de la piste de BASE, dans l'ordre. Ce sont eux que le navigateur sait
 * enchaîner ; un plan posé sur une piste supérieure est une incrustation, que
 * seul le moteur serveur compose (voir l'aiguillage).
 */
export function baseTrackClips(p: EditorProject): Clip[] {
  const baseId = (p.tracks ?? []).find((tr) => tr.family === "visual")?.id;
  const list = baseId ? p.clips.filter((c) => c.trackId === baseId) : p.clips;
  return list.slice().sort((a, b) => a.start - b.start);
}

export function toBrowserPlan(
  p: EditorProject,
  overlays: OverlayInput[] = [],
  options: BrowserRenderOptions = {}
): BrowserRenderPlan {
  const clips = baseTrackClips(p);
  if (clips.length === 0) return { inputs: [], args: [], output: "out.mp4" };

  const fps = options.fps ?? 30;
  const encode = ENCODE[options.quality ?? "standard"];
  const size = FORMAT_SIZE[p.format];
  const inputs: { name: string; src: string }[] = [];
  const args: string[] = [];
  const filters: string[] = [];

  /* ── Entrées : un plan, un fichier ──────────────────────────────────── */
  clips.forEach((c, i) => {
    inputs.push({ name: `in${i}`, src: c.src });
    // Une photo n'a qu'une image : sans `-loop`, le fichier produit durerait
    // une frame. Elle est bouclée puis bornée par `-t`.
    if (c.kind === "image") args.push("-loop", "1");
    // Rognage : `-ss` AVANT `-i` positionne la lecture sans décoder l'amont.
    if (c.trimStart > 0) args.push("-ss", String(c.trimStart));
    // Durée LUE dans la source : la durée à l'écran multipliée par la vitesse.
    // Sans cette borne, un plan raccourci sur la timeline sortait entier.
    const read = c.kind === "image" ? c.length : c.length * c.speed;
    args.push("-t", read.toFixed(3), "-i", `in${i}`);
  });

  // Un calque FIXE est un PNG unique : `-loop 1` le rend disponible sur toute
  // la durée, l'activation temporelle se joue ensuite dans `overlay`. Un
  // calque ANIMÉ est une séquence : elle est lue à sa cadence, une fois, et
  // recalée plus bas sur l'instant où le calque apparaît.
  for (const o of overlays) {
    inputs.push({ name: o.name, src: "" });
    if (o.frames > 1) args.push("-framerate", String(o.fps), "-i", o.name);
    else args.push("-loop", "1", "-i", o.name);
  }

  const audible = p.audios.filter((a) => !a.muted && a.role !== "original" && a.length > 0);
  audible.forEach((a, i) => {
    inputs.push({ name: `aud${i}`, src: a.src });
    if (a.trimStart > 0) args.push("-ss", String(a.trimStart));
    args.push("-i", `aud${i}`);
  });

  /* ── Vidéo : chaque plan normalisé, puis enchaîné ───────────────────── */
  clips.forEach((c, i) => {
    const steps = [
      // Après un `-ss`, l'horodatage ne repart pas de zéro : sans cette
      // remise à plat, la concaténation décale tout ce qui suit.
      c.speed !== 1 && c.kind === "video"
        ? `setpts=(PTS-STARTPTS)*${(1 / c.speed).toFixed(4)}`
        : "setpts=PTS-STARTPTS",
      ...frameFilterSteps(c, size),
    ];
    const eq = eqFilter(c);
    if (eq) steps.push(eq);
    // Cadence, format de pixel et rapport de pixel IDENTIQUES d'un plan à
    // l'autre : `concat` et `xfade` refusent de travailler sur des flux qui
    // diffèrent sur l'un des trois, et l'erreur est illisible.
    steps.push(`fps=${fps}`, "format=yuv420p", "setsar=1");
    filters.push(`[${i}:v]${steps.join(",")}[c${i}]`);
  });

  /**
   * Suites de plans SANS transition entre eux : elles se concatènent bout à
   * bout. Deux suites voisines sont reliées par la transition du premier plan
   * de la seconde. Découper ainsi évite de simuler une transition de durée
   * nulle à chaque coupe franche — ce qui aurait ajouté un fondu d'une image
   * partout, invisible à l'œil mais bien présent dans le fichier.
   */
  type Run = { indexes: number[]; duration: number; enterWith?: { kind: TransitionKind; seconds: number } };
  const runs: Run[] = [];
  clips.forEach((c, i) => {
    const previous = clips[i - 1];
    const xfade = previous ? XFADE_TRANSITION[c.transitionIn] : undefined;
    if (!previous || !xfade) {
      const current = runs[runs.length - 1];
      if (current && !xfade && previous) {
        current.indexes.push(i);
        current.duration += c.length;
        return;
      }
      runs.push({ indexes: [i], duration: c.length });
      return;
    }
    runs.push({
      indexes: [i],
      duration: c.length,
      enterWith: { kind: c.transitionIn, seconds: transitionSpan(c, previous) },
    });
  });

  /** Une suite, concaténée en un seul flux. */
  const runLabel = (run: Run, r: number): string => {
    if (run.indexes.length === 1) return `c${run.indexes[0]}`;
    const label = `run${r}`;
    filters.push(
      `[${run.indexes.map((i) => `c${i}`).join("][")}]concat=n=${run.indexes.length}:v=1:a=0[${label}]`
    );
    return label;
  };

  let vLabel = runLabel(runs[0], 0);
  let elapsed = runs[0].duration;
  for (let r = 1; r < runs.length; r += 1) {
    const run = runs[r];
    const next = runLabel(run, r);
    const d = Math.max(0.05, run.enterWith?.seconds ?? CLIP_TRANSITION_SECONDS);
    const kind = XFADE_TRANSITION[run.enterWith?.kind ?? "fade"] ?? "fade";
    // Le plan sortant est GELÉ pendant la transition (`tpad`), exactement comme
    // dans l'aperçu : c'est ce qui fait que le film garde sa durée. Sans ce
    // remplissage, `xfade` consommerait la durée de la transition sur le
    // total, et le fichier serait plus court que ce qu'on a monté.
    filters.push(`[${vLabel}]tpad=stop_mode=clone:stop_duration=${d.toFixed(3)}[pad${r}]`);
    filters.push(
      `[pad${r}][${next}]xfade=transition=${kind}:duration=${d.toFixed(3)}:offset=${elapsed.toFixed(3)}[x${r}]`
    );
    vLabel = `x${r}`;
    elapsed += run.duration;
  }
  const total = elapsed;

  /* ── Calques : un par PNG, activé sur SES bornes ────────────────────── */
  overlays.forEach((o, i) => {
    const idx = clips.length + i;
    const start = o.start.toFixed(2);
    const end = o.end.toFixed(2);
    let src = `${idx}:v`;

    // Une séquence commence à l'instant 0 de SA propre base de temps : sans ce
    // décalage, un calque animé apparaissant à la cinquième seconde jouerait
    // son animation dès la première, puis figerait sur sa dernière image.
    const steps: string[] = [];
    if (o.frames > 1 && o.start > 0) steps.push(`setpts=PTS+${start}/TB`);

    // Le fondu porte sur la couche ALPHA : le calque s'efface, il ne noircit
    // pas. Les instants sont ceux du film — l'image bouclée partage sa base de
    // temps avec la vidéo.
    const fades: string[] = [];
    if (o.animIn === "fade") {
      fades.push(`fade=t=in:st=${start}:d=${ANIMATION_SECONDS}:alpha=1`);
    }
    if (o.animOut === "fade") {
      const from = Math.max(o.start, o.end - ANIMATION_SECONDS).toFixed(2);
      fades.push(`fade=t=out:st=${from}:d=${ANIMATION_SECONDS}:alpha=1`);
    }
    if (fades.length > 0 || steps.length > 0) {
      filters.push(`[${idx}:v]format=rgba${steps.length ? `,${steps.join(",")}` : ""}${fades.length ? `,${fades.join(",")}` : ""}[fa${i}]`);
      src = `fa${i}`;
    }

    const next = `ov${i}`;
    filters.push(`[${vLabel}][${src}]overlay=0:0:enable='between(t,${start},${end})'[${next}]`);
    vLabel = next;
  });

  /* ── Son : chaque source à SA place sur la timeline, puis mixage ────── */
  const audioLabels: string[] = [];

  /** Décale une source sonore à son instant sur la timeline. */
  const delay = (seconds: number): string[] =>
    seconds > 0.005 ? [`adelay=${Math.round(seconds * 1000)}:all=1`] : [];

  clips.forEach((c, i) => {
    // Le son embarqué du plan est sa propre propriété (Lot A4) — plus une
    // déduction depuis sa piste. Une photo n'en a pas.
    if (c.kind !== "video" || c.muted) return;
    const expr = volumeExpression(c, c.start);
    const steps = ["asetpts=PTS-STARTPTS"];
    if (c.speed !== 1) steps.push(`atempo=${c.speed.toFixed(3)}`);
    steps.push(expr ? `volume=volume='${expr}':eval=frame` : `volume=${c.volume.toFixed(2)}`);
    if (c.fadeIn > 0) steps.push(`afade=t=in:st=0:d=${c.fadeIn}`);
    if (c.fadeOut > 0) steps.push(`afade=t=out:st=${Math.max(0, c.length - c.fadeOut).toFixed(2)}:d=${c.fadeOut}`);
    steps.push(...delay(c.start));
    filters.push(`[${i}:a]${steps.join(",")}[ca${i}]`);
    audioLabels.push(`ca${i}`);
  });

  audible.forEach((a, i) => {
    const idx = clips.length + overlays.length + i;
    const expr = volumeExpression(a, a.start);
    const steps = ["asetpts=PTS-STARTPTS"];
    steps.push(expr ? `volume=volume='${expr}':eval=frame` : `volume=${a.volume.toFixed(2)}`);
    if (a.fadeIn > 0) steps.push(`afade=t=in:st=0:d=${a.fadeIn}`);
    if (a.fadeOut > 0) steps.push(`afade=t=out:st=${Math.max(0, a.length - a.fadeOut).toFixed(2)}:d=${a.fadeOut}`);
    // Une piste posée à la douzième seconde doit sonner à la douzième
    // seconde : sans ce décalage, toute voix off revenait au début du film.
    steps.push(...delay(a.start));
    filters.push(`[${idx}:a]${steps.join(",")}[m${i}]`);
    audioLabels.push(`m${i}`);
  });

  let aLabel: string | null = null;
  if (audioLabels.length === 1) {
    aLabel = audioLabels[0];
  } else if (audioLabels.length > 1) {
    // `normalize=0` : sans lui, amix atténue chaque source et la musique
    // couvre la voix — le défaut corrigé au lot 0. `longest` : une source
    // décalée dans le temps ne doit pas tronquer le mixage à sa propre fin.
    filters.push(`[${audioLabels.join("][")}]amix=inputs=${audioLabels.length}:duration=longest:normalize=0[a]`);
    aLabel = "a";
  }

  if (filters.length) args.push("-filter_complex", filters.join(";"));
  args.push("-map", vLabel.includes(":") ? vLabel : `[${vLabel}]`);
  if (aLabel) args.push("-map", aLabel.includes(":") ? aLabel : `[${aLabel}]`);

  // La durée du film, et non celle du plus long flux : les images bouclées et
  // les sons décalés déborderaient sinon de la fin du montage.
  args.push("-t", total.toFixed(3), "-r", String(fps));
  args.push("-c:v", "libx264", "-preset", encode.preset, "-crf", encode.crf, "-pix_fmt", "yuv420p");
  if (aLabel) args.push("-c:a", "aac", "-b:a", encode.audioBitrate);
  args.push("-movflags", "+faststart", "out.mp4");

  return { inputs, args, output: "out.mp4" };
}
