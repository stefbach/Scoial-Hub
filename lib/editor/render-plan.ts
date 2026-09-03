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
  FORMAT_SIZE,
  projectDuration,
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
  /** Durée du film. */
  maxSeconds: 120,
};

export interface RenderDecision {
  target: RenderTarget;
  /** Motif du basculement, affichable tel quel. */
  reason: string;
}

/**
 * Choisit le moteur. L'utilisateur ne choisit pas : il clique « Exporter » et
 * le système décide. Un rendu serveur libère en outre l'onglet — il peut fermer
 * sa fenêtre, le fichier l'attend dans sa bibliothèque.
 */
export function decideRenderTarget(p: EditorProject, totalSourceBytes: number): RenderDecision {
  const duration = projectDuration(p);
  if (totalSourceBytes > BROWSER_LIMITS.maxBytes) {
    return { target: "server", reason: "sources volumineuses" };
  }
  if (p.clips.length > BROWSER_LIMITS.maxClips) {
    return { target: "server", reason: "montage à plusieurs plans" };
  }
  if (duration > BROWSER_LIMITS.maxSeconds) {
    return { target: "server", reason: "film long" };
  }
  if (browserOverlays(p).length > MAX_BROWSER_OVERLAYS) {
    return { target: "server", reason: "calques nombreux" };
  }
  if (needsServerAnimation(p)) {
    return { target: "server", reason: "animations" };
  }
  return { target: "browser", reason: "montage léger" };
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
  return ordered.map(({ l, kind }, i) => ({
    name: `ov${i}.png`,
    layerId: l.id,
    kind,
    start: l.start,
    end: l.end,
    animIn: l.animIn,
    animOut: l.animOut,
  }));
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
export function toBrowserPlan(p: EditorProject, overlays: OverlayInput[] = []): BrowserRenderPlan {
  const clip = p.clips[0];
  if (!clip) return { inputs: [], args: [], output: "out.mp4" };

  const size = FORMAT_SIZE[p.format];
  const inputs: { name: string; src: string }[] = [{ name: "in0", src: clip.src }];
  const args: string[] = [];

  // Une photo n'a qu'une image : sans `-loop`, le fichier produit durait une
  // frame. Elle est bouclée puis bornée par `-t`.
  if (clip.kind === "image") args.push("-loop", "1");
  // Rognage : `-ss` AVANT `-i` positionne la lecture sans décoder l'amont.
  if (clip.trimStart > 0) args.push("-ss", String(clip.trimStart));
  args.push("-i", "in0");

  // Les PNG de calques sont des images fixes : `-loop 1` les rend disponibles
  // sur toute la durée, l'activation temporelle se joue ensuite dans `overlay`.
  for (const o of overlays) {
    inputs.push({ name: o.name, src: "" });
    args.push("-loop", "1", "-i", o.name);
  }

  const audible = p.audios.filter((a) => !a.muted && a.role !== "original" && a.length > 0);
  audible.forEach((a, i) => {
    inputs.push({ name: `aud${i}`, src: a.src });
    if (a.trimStart > 0) args.push("-ss", String(a.trimStart));
    args.push("-i", `aud${i}`);
  });

  // Le son embarqué du plan est désormais sa propre propriété (Lot A4) —
  // plus une déduction depuis une piste `audio` virtuelle de rôle "original"
  // qu'aucun outil de l'interface ne posait jamais (ce rôle ne servait donc
  // à rien de concret : `keepOriginal` valait toujours vrai en pratique).
  const keepOriginal = clip.kind === "video" && !clip.muted;
  const filters: string[] = [];

  // Vidéo : vitesse, cadrage au format, puis incrustation des calques.
  let vLabel = "0:v";
  const vSteps: string[] = [];
  if (clip.speed !== 1) vSteps.push(`setpts=${(1 / clip.speed).toFixed(4)}*PTS`);
  vSteps.push(...frameFilterSteps(clip, size));
  if (vSteps.length) {
    filters.push(`[0:v]${vSteps.join(",")}[vs]`);
    vLabel = "vs";
  }
  // Un calque par PNG, chacun activé sur SES bornes : c'est ce qui fait enfin
  // apparaître un titre sur les trois premières secondes seulement, et qui
  // empêche un texte de fin d'être silencieusement perdu à l'export.
  overlays.forEach((o, i) => {
    const idx = i + 1;
    const start = o.start.toFixed(2);
    const end = o.end.toFixed(2);
    let src = `${idx}:v`;

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
    if (fades.length > 0) {
      filters.push(`[${idx}:v]format=rgba,${fades.join(",")}[fa${i}]`);
      src = `fa${i}`;
    }

    const next = `ov${i}`;
    filters.push(`[${vLabel}][${src}]overlay=0:0:enable='between(t,${start},${end})'[${next}]`);
    vLabel = next;
  });

  // Audio : chaque piste ajoutée reçoit son volume et ses fondus, puis on mixe.
  // Le son embarqué du plan lui-même suit exactement le même traitement.
  const audioLabels: string[] = [];
  if (keepOriginal) {
    const steps = [`volume=${clip.volume.toFixed(2)}`];
    if (clip.fadeIn > 0) steps.push(`afade=t=in:st=0:d=${clip.fadeIn}`);
    if (clip.fadeOut > 0) steps.push(`afade=t=out:st=${Math.max(0, clip.length - clip.fadeOut).toFixed(2)}:d=${clip.fadeOut}`);
    filters.push(`[0:a]${steps.join(",")}[mv]`);
    audioLabels.push("mv");
  }
  audible.forEach((a, i) => {
    const idx = 1 + overlays.length + i;
    const steps = [`volume=${a.volume.toFixed(2)}`];
    if (a.fadeIn > 0) steps.push(`afade=t=in:st=0:d=${a.fadeIn}`);
    if (a.fadeOut > 0) steps.push(`afade=t=out:st=${Math.max(0, a.length - a.fadeOut).toFixed(2)}:d=${a.fadeOut}`);
    filters.push(`[${idx}:a]${steps.join(",")}[m${i}]`);
    audioLabels.push(`m${i}`);
  });

  let aLabel: string | null = null;
  if (audioLabels.length === 1) {
    aLabel = audioLabels[0];
  } else if (audioLabels.length > 1) {
    // `normalize=0` : sans lui, amix atténue chaque source de moitié et la
    // musique couvre la voix — le défaut corrigé au lot 0.
    filters.push(`[${audioLabels.join("][")}]amix=inputs=${audioLabels.length}:duration=shortest:normalize=0[a]`);
    aLabel = "a";
  }

  if (filters.length) args.push("-filter_complex", filters.join(";"));
  args.push("-map", vLabel.includes(":") ? vLabel : `[${vLabel}]`);
  if (aLabel) args.push("-map", aLabel.includes(":") ? aLabel : `[${aLabel}]`);

  args.push("-t", String(clip.length));
  // Une photo bouclée n'a pas de cadence propre : on la fixe.
  if (clip.kind === "image") args.push("-r", "30");
  // `veryfast` + CRF : le fichier produit est nettement plus léger qu'avec
  // `ultrafast`, ce qui accélère ensuite l'envoi vers les réseaux sociaux.
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p");
  if (aLabel) args.push("-c:a", "aac", "-b:a", "128k");
  args.push("-movflags", "+faststart", "out.mp4");

  return { inputs, args, output: "out.mp4" };
}
