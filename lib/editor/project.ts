// Document de projet d'édition — le socle du banc de montage.
//
// POURQUOI CE MODULE EXISTE
// L'éditeur média appliquait une transformation unique et définitive : le texte
// était aplati dans l'image, l'export écrasait le média source, et rouvrir
// l'éditeur ré-encodait par-dessus le rendu précédent. Irréversibilité, absence
// de minutage, dégradation cumulative : tous ces défauts découlaient d'une même
// cause — l'outil conservait le RÉSULTAT de ce que l'utilisateur avait fait, pas
// ce qu'il avait fait.
//
// Ici, on décrit le montage. Le rendu n'en est qu'une projection, régénérable.
// Le média source n'est jamais modifié : il est seulement référencé.
//
// Ce module est PUR : aucun accès réseau, aucun DOM. Il est donc testable
// intégralement, ce qui est la condition posée par l'audit (A-10).

export const PROJECT_VERSION = 1 as const;

/** Formats de publication couverts. */
export type EditorFormat = "9:16" | "1:1" | "4:5" | "16:9";

export const FORMAT_SIZE: Record<EditorFormat, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1920, height: 1080 },
};

export type ClipKind = "video" | "image";
export type TransitionKind = "none" | "fade" | "dissolve";

/**
 * Cadrage d'un plan dans le format de publication.
 * `cover` remplit le cadre en rognant ce qui dépasse — c'est ce qu'attend un
 * format vertical nourri d'une source horizontale. `contain` montre la source
 * entière et complète par des bandes noires.
 */
export type ClipFit = "cover" | "contain";

/** Plan vidéo ou photo posé sur la piste principale. */
export interface Clip {
  id: string;
  src: string;
  kind: ClipKind;
  /** Position sur la timeline, en secondes. Recalculée par `normalize`. */
  start: number;
  /** Durée À L'ÉCRAN, en secondes (après application de la vitesse). */
  length: number;
  /** Point d'entrée DANS LE MÉDIA SOURCE, en secondes. */
  trimStart: number;
  /** Durée native du média source. 0 pour une photo (durée libre). */
  sourceDuration: number;
  /** Vitesse de lecture, 0.5× à 2×. Sans effet sur une photo. */
  speed: number;
  /** Transition à l'entrée du plan. */
  transitionIn: TransitionKind;
  /** Cadrage dans le format de publication. */
  fit: ClipFit;
  /**
   * Point d'intérêt conservé au recadrage, en fraction de la source (0..1).
   * Sans lui, `cover` rogne toujours au centre : un visage cadré à gauche
   * sortait du champ dès qu'on passait en 9:16.
   */
  focusX: number;
  focusY: number;
}

/** Calque de texte, avec bornes d'apparition. */
export interface TextLayer {
  id: string;
  text: string;
  /** Position du coin haut-gauche, en fraction du cadre (0..1). */
  x: number;
  y: number;
  /** Taille de police en fraction de la hauteur du cadre. */
  sizePct: number;
  color: string;
  bold: boolean;
  /** Bandeau semi-transparent derrière le texte. */
  bg: boolean;
  align: "left" | "center" | "right";
  /** Contour et ombre : lisibilité sur fond clair comme sur fond chargé. */
  outline: boolean;
  shadow: boolean;
  /** Bornes d'apparition sur la timeline, en secondes. */
  start: number;
  end: number;
}

/** Image incrustée (logo, pastille, filigrane). */
export interface ImageLayer {
  id: string;
  src: string;
  x: number;
  y: number;
  /** Largeur en fraction du cadre (0..1). */
  scale: number;
  opacity: number;
  start: number;
  end: number;
}

export type AudioRole = "original" | "music" | "voice";

/** Piste sonore : son d'origine du clip, musique ajoutée ou voix off. */
export interface AudioTrack {
  id: string;
  src: string;
  name: string;
  role: AudioRole;
  /** Position sur la timeline. */
  start: number;
  /** Durée jouée. */
  length: number;
  /** Point d'entrée dans le fichier source. */
  trimStart: number;
  /** 0..1 — 1 = niveau d'origine. */
  volume: number;
  fadeIn: number;
  fadeOut: number;
  muted: boolean;
}

export interface EditorProject {
  version: typeof PROJECT_VERSION;
  id: string;
  companyId: string;
  name: string;
  format: EditorFormat;
  clips: Clip[];
  texts: TextLayer[];
  images: ImageLayer[];
  audios: AudioTrack[];
  updatedAt: string;
}

/* ────────────────────────────────────────────────────────────────────────────
   Construction
   ──────────────────────────────────────────────────────────────────────── */

/** Durée par défaut d'une photo posée sur la timeline. */
export const DEFAULT_IMAGE_SECONDS = 4;

/** Identifiant court, stable et lisible dans les traces. */
export function newId(prefix: string, seed: number): string {
  return `${prefix}-${seed.toString(36)}`;
}

export function emptyProject(companyId: string, id: string, format: EditorFormat = "9:16"): EditorProject {
  return {
    version: PROJECT_VERSION,
    id,
    companyId,
    name: "",
    format,
    clips: [],
    texts: [],
    images: [],
    audios: [],
    updatedAt: "",
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Invariants
   ──────────────────────────────────────────────────────────────────────── */

const EPS = 1e-6;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Arrondi au centième de seconde : évite les dérives de virgule flottante. */
function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Remet les plans bout à bout à partir de zéro, sans trou ni recouvrement,
 * et borne les calques sur la durée réelle du film.
 *
 * Toute opération de montage se termine par un passage ici : c'est ce qui
 * garantit qu'un projet est TOUJOURS cohérent, quel que soit l'ordre des
 * manipulations.
 */
export function normalize(p: EditorProject): EditorProject {
  let cursor = 0;
  const clips = p.clips
    .filter((c) => c.length > EPS)
    .map((c) => {
      const clip: Clip = {
        ...c,
        speed: clamp(c.speed || 1, 0.5, 2),
        trimStart: Math.max(0, round(c.trimStart)),
        length: round(c.length),
        start: round(cursor),
        // Un projet enregistré avant le cadrage n'en porte pas : on le complète
        // ici plutôt que de le refuser. Rouvrir un ancien montage doit marcher.
        fit: c.fit === "contain" ? "contain" : "cover",
        focusX: clamp(Number.isFinite(c.focusX) ? c.focusX : 0.5, 0, 1),
        focusY: clamp(Number.isFinite(c.focusY) ? c.focusY : 0.5, 0, 1),
      };
      cursor += clip.length;
      return clip;
    });
  const total = round(cursor);

  const bound = <T extends { start: number; end: number }>(layer: T): T => {
    const start = clamp(round(layer.start), 0, total);
    // Une borne de fin à 0 ou inversée signifie « jusqu'à la fin du film ».
    const rawEnd = layer.end > start ? round(layer.end) : total;
    return { ...layer, start, end: clamp(rawEnd, start, total) };
  };

  return {
    ...p,
    clips,
    texts: p.texts.map(bound),
    images: p.images.map(bound),
    audios: p.audios.map((a) => {
      const start = clamp(round(a.start), 0, total);
      const length = clamp(round(a.length), 0, Math.max(0, total - start));
      return { ...a, start, length, volume: clamp(a.volume, 0, 1) };
    }),
  };
}

/** Durée totale du film, en secondes. */
export function projectDuration(p: EditorProject): number {
  return round(p.clips.reduce((sum, c) => sum + c.length, 0));
}

/** Vrai si le projet ne contient rien à rendre. */
export function isEmptyProject(p: EditorProject): boolean {
  return p.clips.length === 0;
}

/* ────────────────────────────────────────────────────────────────────────────
   Opérations de montage — toutes PURES : elles renvoient un nouveau projet
   ──────────────────────────────────────────────────────────────────────── */

export function addClip(
  p: EditorProject,
  input: { id: string; src: string; kind: ClipKind; sourceDuration?: number }
): EditorProject {
  const sourceDuration = input.kind === "image" ? 0 : Math.max(0, input.sourceDuration ?? 0);
  const length = input.kind === "image" ? DEFAULT_IMAGE_SECONDS : sourceDuration || DEFAULT_IMAGE_SECONDS;
  const clip: Clip = {
    id: input.id,
    src: input.src,
    kind: input.kind,
    start: 0,
    length,
    trimStart: 0,
    sourceDuration,
    speed: 1,
    transitionIn: p.clips.length === 0 ? "none" : "fade",
    fit: "cover",
    focusX: 0.5,
    focusY: 0.5,
  };
  return normalize({ ...p, clips: [...p.clips, clip] });
}

export function removeClip(p: EditorProject, clipId: string): EditorProject {
  return normalize({ ...p, clips: p.clips.filter((c) => c.id !== clipId) });
}

/**
 * Rogne un plan par ses extrémités. `head` raccourcit le début (le point
 * d'entrée dans la source avance), `tail` raccourcit la fin.
 * Un plan ne peut jamais descendre sous 0,1 s : un plan de durée nulle n'est
 * pas un plan, c'est une suppression — qui a sa propre opération.
 */
export const MIN_CLIP_SECONDS = 0.1;

export function trimClip(
  p: EditorProject,
  clipId: string,
  { head = 0, tail = 0 }: { head?: number; tail?: number }
): EditorProject {
  const clips = p.clips.map((c) => {
    if (c.id !== clipId) return c;
    const maxHead = c.length - MIN_CLIP_SECONDS;
    const h = clamp(head, -c.trimStart, Math.max(0, maxHead));
    const afterHead = { ...c, trimStart: c.trimStart + h, length: c.length - h };
    const maxTail = afterHead.length - MIN_CLIP_SECONDS;
    const tl = clamp(tail, -Infinity, Math.max(0, maxTail));
    const length = afterHead.length - tl;
    // Un plan vidéo ne peut pas dépasser ce que contient sa source.
    const available = c.kind === "video" && c.sourceDuration > 0
      ? Math.max(MIN_CLIP_SECONDS, (c.sourceDuration - afterHead.trimStart) / afterHead.speed)
      : Infinity;
    return { ...afterHead, length: Math.min(length, available) };
  });
  return normalize({ ...p, clips });
}

/**
 * Scinde un plan à l'instant `time` de la timeline. Les deux moitiés partagent
 * la même source : c'est la scission d'un point de vue, pas une copie de média.
 * Renvoie le projet inchangé si l'instant tombe hors du plan ou trop près d'un
 * bord pour produire deux plans valides.
 */
export function splitAt(p: EditorProject, time: number, newIdFor: (base: string) => string): EditorProject {
  const target = p.clips.find((c) => time > c.start + EPS && time < c.start + c.length - EPS);
  if (!target) return p;
  const offset = time - target.start;
  if (offset < MIN_CLIP_SECONDS || target.length - offset < MIN_CLIP_SECONDS) return p;

  const left: Clip = { ...target, length: round(offset) };
  const right: Clip = {
    ...target,
    id: newIdFor(target.id),
    // La seconde moitié démarre plus loin DANS LA SOURCE, à la vitesse près.
    trimStart: round(target.trimStart + offset * target.speed),
    length: round(target.length - offset),
    transitionIn: "none",
  };
  const idx = p.clips.indexOf(target);
  const clips = [...p.clips.slice(0, idx), left, right, ...p.clips.slice(idx + 1)];
  return normalize({ ...p, clips });
}

/** Déplace un plan dans l'ordre de lecture. */
export function reorderClip(p: EditorProject, clipId: string, toIndex: number): EditorProject {
  const from = p.clips.findIndex((c) => c.id === clipId);
  if (from < 0) return p;
  const clips = [...p.clips];
  const [moved] = clips.splice(from, 1);
  clips.splice(clamp(toIndex, 0, clips.length), 0, moved);
  return normalize({ ...p, clips });
}

export function duplicateClip(p: EditorProject, clipId: string, newId: string): EditorProject {
  const idx = p.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return p;
  const copy: Clip = { ...p.clips[idx], id: newId };
  const clips = [...p.clips.slice(0, idx + 1), copy, ...p.clips.slice(idx + 1)];
  return normalize({ ...p, clips });
}

/**
 * Change la vitesse d'un plan. La durée à l'écran suit mécaniquement : jouer
 * deux fois plus vite occupe deux fois moins de temps.
 */
export function setClipSpeed(p: EditorProject, clipId: string, speed: number): EditorProject {
  const clips = p.clips.map((c) => {
    if (c.id !== clipId) return c;
    const next = clamp(speed, 0.5, 2);
    const played = c.length * c.speed; // durée consommée dans la source
    return { ...c, speed: next, length: round(played / next) };
  });
  return normalize({ ...p, clips });
}

/**
 * Recadre un plan dans le format de publication.
 * Rien n'est rogné dans le média source : le cadrage est une INTENTION, relue
 * à chaque rendu. Changer de format plus tard reste donc sans perte.
 */
export function setClipFraming(
  p: EditorProject,
  clipId: string,
  patch: { fit?: ClipFit; focusX?: number; focusY?: number }
): EditorProject {
  const clips = p.clips.map((c) =>
    c.id === clipId
      ? {
          ...c,
          fit: patch.fit ?? c.fit,
          focusX: patch.focusX === undefined ? c.focusX : clamp(patch.focusX, 0, 1),
          focusY: patch.focusY === undefined ? c.focusY : clamp(patch.focusY, 0, 1),
        }
      : c
  );
  return normalize({ ...p, clips });
}

/** Transition à l'entrée d'un plan. Sans effet sur le tout premier. */
export function setClipTransition(p: EditorProject, clipId: string, kind: TransitionKind): EditorProject {
  const clips = p.clips.map((c, i) => (c.id === clipId ? { ...c, transitionIn: i === 0 ? "none" : kind } : c));
  return normalize({ ...p, clips });
}

/* ── Calques ─────────────────────────────────────────────────────────────── */

export function addText(p: EditorProject, id: string, text: string): EditorProject {
  const total = projectDuration(p);
  const layer: TextLayer = {
    id, text,
    x: 0.1, y: 0.1, sizePct: 0.08,
    color: "#ffffff", bold: true, bg: true,
    align: "left", outline: false, shadow: true,
    start: 0, end: total || DEFAULT_IMAGE_SECONDS,
  };
  return normalize({ ...p, texts: [...p.texts, layer] });
}

export function updateText(p: EditorProject, id: string, patch: Partial<TextLayer>): EditorProject {
  return normalize({ ...p, texts: p.texts.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

export function removeText(p: EditorProject, id: string): EditorProject {
  return normalize({ ...p, texts: p.texts.filter((l) => l.id !== id) });
}

export function addImageLayer(p: EditorProject, id: string, src: string): EditorProject {
  const total = projectDuration(p);
  const layer: ImageLayer = { id, src, x: 0.05, y: 0.05, scale: 0.2, opacity: 1, start: 0, end: total || DEFAULT_IMAGE_SECONDS };
  return normalize({ ...p, images: [...p.images, layer] });
}

export function updateImageLayer(p: EditorProject, id: string, patch: Partial<ImageLayer>): EditorProject {
  return normalize({ ...p, images: p.images.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

export function removeImageLayer(p: EditorProject, id: string): EditorProject {
  return normalize({ ...p, images: p.images.filter((l) => l.id !== id) });
}

/* ── Audio ───────────────────────────────────────────────────────────────── */

/**
 * Volume par défaut d'une musique de fond. La pratique de montage place la
 * musique 12 à 18 dB sous la voix ; 25 % correspond à environ −12 dB.
 */
export const DEFAULT_MUSIC_VOLUME = 0.25;

export function addAudio(
  p: EditorProject,
  input: { id: string; src: string; name: string; role: AudioRole; sourceDuration?: number }
): EditorProject {
  const total = projectDuration(p);
  const track: AudioTrack = {
    id: input.id,
    src: input.src,
    name: input.name,
    role: input.role,
    start: 0,
    length: input.sourceDuration && input.sourceDuration > 0 ? Math.min(input.sourceDuration, total || input.sourceDuration) : total,
    trimStart: 0,
    volume: input.role === "music" ? DEFAULT_MUSIC_VOLUME : 1,
    fadeIn: input.role === "music" ? 0.5 : 0,
    fadeOut: input.role === "music" ? 1 : 0,
    muted: false,
  };
  return normalize({ ...p, audios: [...p.audios, track] });
}

export function updateAudio(p: EditorProject, id: string, patch: Partial<AudioTrack>): EditorProject {
  return normalize({ ...p, audios: p.audios.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
}

export function removeAudio(p: EditorProject, id: string): EditorProject {
  return normalize({ ...p, audios: p.audios.filter((a) => a.id !== id) });
}

/* ────────────────────────────────────────────────────────────────────────────
   Lecture : ce qui est visible à un instant donné
   ──────────────────────────────────────────────────────────────────────── */

/** Plan joué à l'instant `time`, et position correspondante dans sa source. */
export function clipAt(p: EditorProject, time: number): { clip: Clip; sourceTime: number } | null {
  for (const c of p.clips) {
    if (time >= c.start - EPS && time < c.start + c.length - EPS) {
      return { clip: c, sourceTime: c.trimStart + (time - c.start) * c.speed };
    }
  }
  const last = p.clips[p.clips.length - 1];
  if (last && time >= last.start + last.length - EPS) {
    return { clip: last, sourceTime: last.trimStart + last.length * last.speed };
  }
  return null;
}

/** Calques de texte visibles à l'instant `time`. */
export function textsAt(p: EditorProject, time: number): TextLayer[] {
  return p.texts.filter((l) => time >= l.start - EPS && time <= l.end + EPS);
}

/** Incrustations visibles à l'instant `time`. */
export function imagesAt(p: EditorProject, time: number): ImageLayer[] {
  return p.images.filter((l) => time >= l.start - EPS && time <= l.end + EPS);
}
