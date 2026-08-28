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

/** Animation d'entrée ou de sortie d'un calque. */
export type AnimationKind = "none" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "zoom";

/** Durée d'une animation d'entrée ou de sortie, en secondes. */
export const ANIMATION_SECONDS = 0.4;

/** Familles de police proposées. La clé est stable, le nom peut changer. */
export type FontKey = "sans" | "serif" | "mono" | "condensed" | "rounded" | "display";

/** Formes vectorielles disponibles. */
export type ShapeKind = "rect" | "round" | "ellipse" | "line" | "arrow";

/**
 * Propriétés communes à tout élément visuel — c'est le « bloc de propriétés »
 * réclamé par l'audit. Les avoir sur une seule interface garantit qu'ajouter
 * une propriété la rend disponible partout d'un coup, au lieu d'être présente
 * sur les incrustations et absente des textes comme c'était le cas.
 */
export interface VisualLayer {
  /** Position du coin haut-gauche, en fraction du cadre (0..1). */
  x: number;
  y: number;
  /** Rotation en degrés, autour du centre de l'élément. */
  rotation: number;
  /** 0..1 */
  opacity: number;
  /** Bornes d'apparition sur la timeline, en secondes. */
  start: number;
  end: number;
  animIn: AnimationKind;
  animOut: AnimationKind;
  /**
   * Sous-piste d'affichage, CALCULÉE par `normalize`. Deux calques de même type
   * qui se chevauchent se dessinaient l'un par-dessus l'autre sur une piste
   * unique : le second devenait inatteignable. La valeur n'est pas éditée par
   * l'utilisateur — elle découle du minutage.
   */
  lane: number;
}

/** Plan vidéo ou photo. */
export interface Clip {
  id: string;
  src: string;
  kind: ClipKind;
  /**
   * Piste vidéo. 0 est la piste de base ; les pistes supérieures se
   * superposent. Sans elle, `normalize` reposait tous les plans bout à bout et
   * l'incrustation vidéo — image dans l'image, écran partagé — était
   * structurellement impossible.
   */
  track: number;
  /** Position sur la timeline, en secondes. */
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
  /** Traçabilité si le plan vient d'une bibliothèque externe (Lot A-3). */
  provenance?: Provenance;
}

/** Calque de texte. */
export interface TextLayer extends VisualLayer {
  id: string;
  text: string;
  /** Taille de police en fraction de la hauteur du cadre. */
  sizePct: number;
  /** Largeur de retour à la ligne, en fraction du cadre. 0 = pas de retour. */
  wrapPct: number;
  color: string;
  font: FontKey;
  bold: boolean;
  /** Bandeau semi-transparent derrière le texte. */
  bg: boolean;
  align: "left" | "center" | "right";
  /** Contour et ombre : lisibilité sur fond clair comme sur fond chargé. */
  outline: boolean;
  shadow: boolean;
  /** Interligne, en multiple de la taille de police. */
  lineHeight: number;
}

/** Image incrustée (logo, pastille, filigrane). */
export interface ImageLayer extends VisualLayer {
  id: string;
  src: string;
  /** Largeur en fraction du cadre (0..1). */
  scale: number;
  /** Hauteur en fraction du cadre. 0 = déduite du rapport natif de l'image. */
  heightPct: number;
  /** Traçabilité si l'image vient d'une bibliothèque externe (Lot A-3). */
  provenance?: Provenance;
}

/**
 * Forme vectorielle — bandeau, pastille, cadre, trait, flèche.
 * Sans ce type, un simple aplat de couleur derrière un titre obligeait à
 * préparer une image dans un autre outil et à l'importer.
 */
export interface ShapeLayer extends VisualLayer {
  id: string;
  shape: ShapeKind;
  /** Dimensions en fraction du cadre. */
  w: number;
  h: number;
  fill: string;
  stroke: string;
  /** Épaisseur du contour, en fraction de la largeur du cadre. */
  strokeWidth: number;
  /** Rayon d'angle d'un rectangle arrondi, en fraction de la largeur. */
  radius: number;
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
  /** Sous-piste d'affichage, calculée par `normalize`. */
  lane: number;
  /** Traçabilité si le son vient d'une bibliothèque externe (Lot A-3). */
  provenance?: Provenance;
}

/**
 * Verrouillage et masquage d'une piste vidéo (itération 3, chapitre 8.1) —
 * peu coûteux, très utilisé dès qu'il y a plus de deux pistes. `locked`
 * empêche la manipulation des plans de la piste sans rien changer au rendu ;
 * `hidden` retire la piste du montage vu ET exporté.
 */
export interface TrackMeta {
  locked?: boolean;
  hidden?: boolean;
}

/**
 * Traçabilité d'un média acquis depuis une bibliothèque externe — écrite au
 * moment où l'emplacement est rempli, jamais après (cette information n'est
 * pas récupérable plus tard : le fournisseur ne la garde pas indéfiniment).
 */
export interface Provenance {
  provider: string;
  providerId: string;
  author?: string;
  authorUrl?: string;
  license: string;
  sourceUrl: string;
}

export type SlotRole = "media" | "title" | "subtitle" | "caption" | "cta" | "logo" | "music";

/**
 * Emplacement de gabarit : un calque du document qui porte encore un contenu
 * de démonstration (posé par `applyTemplate`) et attend d'être remplacé par
 * le vrai contenu de l'utilisateur. `required` distingue ce qui doit être
 * rempli avant publication de ce qui reste facultatif.
 */
export interface Slot {
  id: string;
  role: SlotRole;
  label: string;
  required: boolean;
  targetKind: "clip" | "text" | "image" | "audio";
  targetId: string;
  filled: boolean;
  provenance?: Provenance;
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
  shapes: ShapeLayer[];
  audios: AudioTrack[];
  /** Champ optionnel — absent sur tout projet enregistré avant cette piste. */
  trackMeta?: Record<number, TrackMeta>;
  /** Emplacements de gabarit non résolus. Absent sur un projet sans modèle. */
  slots?: Slot[];
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
    shapes: [],
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
 * Range des éléments minutés en sous-pistes, de sorte que deux éléments qui se
 * chevauchent n'occupent jamais la même rangée.
 *
 * Algorithme d'empilement classique : on trie par instant de début, et chacun
 * prend la première rangée libre à cet instant. Sans cela, deux textes posés au
 * même moment se dessinaient l'un par-dessus l'autre et le second devenait
 * impossible à sélectionner.
 */
function packLanes<T extends { start: number; end: number }>(items: T[]): (T & { lane: number })[] {
  const order = items.map((item, index) => ({ item, index })).sort((a, b) =>
    a.item.start === b.item.start ? a.index - b.index : a.item.start - b.item.start
  );
  /** Instant de fin occupé par chaque rangée. */
  const busyUntil: number[] = [];
  const lanes = new Map<number, number>();
  for (const { item, index } of order) {
    let lane = busyUntil.findIndex((until) => item.start >= until - EPS);
    if (lane < 0) lane = busyUntil.length;
    busyUntil[lane] = item.end;
    lanes.set(index, lane);
  }
  return items.map((item, index) => ({ ...item, lane: lanes.get(index) ?? 0 }));
}

/**
 * Résout les recouvrements À L'INTÉRIEUR d'une piste vidéo : deux plans ne
 * peuvent pas jouer au même instant sur la même piste. Le plan en retard est
 * décalé plutôt que supprimé — l'intention de l'utilisateur est conservée.
 */
function layTrack(clips: Clip[]): Clip[] {
  let cursor = 0;
  return clips
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c) => {
      const start = round(Math.max(c.start, cursor));
      cursor = start + c.length;
      return { ...c, start };
    });
}

/**
 * Remet le document d'aplomb : plans rangés par piste, calques bornés sur la
 * durée du film, sous-pistes recalculées.
 *
 * Toute opération de montage se termine par un passage ici : c'est ce qui
 * garantit qu'un projet est TOUJOURS cohérent, quel que soit l'ordre des
 * manipulations.
 */
export function normalize(p: EditorProject): EditorProject {
  // Les plans portent maintenant leur piste et leur instant de début. Un projet
  // enregistré avant le multi-piste n'en a pas : on les reconstitue en reposant
  // la séquence bout à bout, ce qui reproduit exactement l'ancien comportement.
  const legacySequential = p.clips.some((c) => !Number.isFinite(c.track));
  let legacyCursor = 0;

  const prepared = p.clips
    .filter((c) => c.length > EPS)
    .map((c) => {
      const length = round(c.length);
      const start = legacySequential ? round(legacyCursor) : round(Math.max(0, c.start));
      if (legacySequential) legacyCursor += length;
      return {
        ...c,
        track: Number.isFinite(c.track) ? Math.max(0, Math.round(c.track)) : 0,
        speed: clamp(c.speed || 1, 0.5, 2),
        trimStart: Math.max(0, round(c.trimStart)),
        length,
        start,
        // Un projet enregistré avant le cadrage n'en porte pas : on le complète
        // ici plutôt que de le refuser. Rouvrir un ancien montage doit marcher.
        fit: c.fit === "contain" ? "contain" : "cover",
        focusX: clamp(Number.isFinite(c.focusX) ? c.focusX : 0.5, 0, 1),
        focusY: clamp(Number.isFinite(c.focusY) ? c.focusY : 0.5, 0, 1),
      } as Clip;
    });

  const tracks = [...new Set(prepared.map((c) => c.track))].sort((a, b) => a - b);
  const clips = tracks.flatMap((track) => layTrack(prepared.filter((c) => c.track === track)));
  // La durée du film est la fin la plus tardive, toutes pistes confondues.
  const total = round(clips.reduce((max, c) => Math.max(max, c.start + c.length), 0));

  const bound = <T extends VisualLayer>(layer: T): T => {
    const start = clamp(round(layer.start), 0, total);
    // Une borne de fin à 0 ou inversée signifie « jusqu'à la fin du film ».
    const rawEnd = layer.end > start ? round(layer.end) : total;
    return {
      ...layer,
      start,
      end: clamp(rawEnd, start, total),
      // Champs apparus après coup : complétés, jamais exigés.
      rotation: Number.isFinite(layer.rotation) ? layer.rotation : 0,
      opacity: Number.isFinite(layer.opacity) ? clamp(layer.opacity, 0, 1) : 1,
      animIn: layer.animIn ?? "none",
      animOut: layer.animOut ?? "none",
    };
  };

  const texts = packLanes(p.texts.map(bound)).map((l) => ({
    ...l,
    font: l.font ?? "sans",
    wrapPct: Number.isFinite(l.wrapPct) ? clamp(l.wrapPct, 0, 1) : 0,
    lineHeight: Number.isFinite(l.lineHeight) && l.lineHeight > 0 ? l.lineHeight : 1.25,
  }));
  const images = packLanes(p.images.map(bound)).map((l) => ({
    ...l,
    heightPct: Number.isFinite(l.heightPct) ? Math.max(0, l.heightPct) : 0,
  }));
  const shapes = packLanes((p.shapes ?? []).map(bound));
  const audios = packLanes(p.audios.map((a) => {
    const start = clamp(round(a.start), 0, total);
    const length = clamp(round(a.length), 0, Math.max(0, total - start));
    return { ...a, start, length, volume: clamp(a.volume, 0, 1), end: start + length };
  })).map(({ end, ...a }) => { void end; return a; });

  // Un emplacement dont la cible a disparu (calque supprimé) n'a plus de sens
  // à signaler : sans ce filtrage, `unfilledSlots` continuerait à réclamer un
  // texte que l'utilisateur a explicitement effacé.
  const targetExists = (s: Slot): boolean => {
    if (s.targetKind === "clip") return clips.some((c) => c.id === s.targetId);
    if (s.targetKind === "text") return texts.some((l) => l.id === s.targetId);
    if (s.targetKind === "image") return images.some((l) => l.id === s.targetId);
    return audios.some((a) => a.id === s.targetId);
  };
  const slots = (p.slots ?? []).filter(targetExists);

  return {
    ...p,
    clips,
    texts,
    images,
    shapes,
    audios,
    slots: slots.length > 0 ? slots : undefined,
  };
}

/**
 * Durée totale du film, en secondes — la fin la plus tardive, toutes pistes
 * confondues. Additionner les durées ne vaut plus : deux plans superposés
 * occupent le même temps.
 */
export function projectDuration(p: EditorProject): number {
  return round(p.clips.reduce((max, c) => Math.max(max, c.start + c.length), 0));
}

/** Numéros de pistes vidéo utilisés, de la base vers le dessus. */
export function usedTracks(p: EditorProject): number[] {
  const set = new Set(p.clips.map((c) => c.track));
  if (set.size === 0) set.add(0);
  return [...set].sort((a, b) => a - b);
}

/** Vrai si le projet ne contient rien à rendre. */
export function isEmptyProject(p: EditorProject): boolean {
  return p.clips.length === 0;
}

/* ── Verrouillage et masquage de piste (chapitre 8.1) ───────────────────── */

export function isTrackLocked(p: EditorProject, track: number): boolean {
  return Boolean(p.trackMeta?.[track]?.locked);
}

export function isTrackHidden(p: EditorProject, track: number): boolean {
  return Boolean(p.trackMeta?.[track]?.hidden);
}

export function setTrackMeta(p: EditorProject, track: number, patch: TrackMeta): EditorProject {
  const trackMeta = { ...(p.trackMeta ?? {}) };
  trackMeta[track] = { ...trackMeta[track], ...patch };
  return { ...p, trackMeta };
}

/**
 * Le montage tel qu'on le VOIT et qu'on l'EXPORTE : les pistes masquées en
 * sont retirées. Un seul point de filtrage, appelé par l'aperçu et par les
 * deux projections de rendu — sans quoi les deux pourraient diverger
 * (itération 3, chapitre 9, point 10).
 */
export function visibleProject(p: EditorProject): EditorProject {
  if (!p.trackMeta || !Object.values(p.trackMeta).some((m) => m?.hidden)) return p;
  return { ...p, clips: p.clips.filter((c) => !p.trackMeta?.[c.track]?.hidden) };
}

/* ── Emplacements de gabarit ─────────────────────────────────────────────── */

/** Déclare un nouvel emplacement, pointant vers un calque déjà posé. */
export function addSlot(p: EditorProject, slot: Slot): EditorProject {
  return { ...p, slots: [...(p.slots ?? []), slot] };
}

/**
 * Emplacements requis qu'aucun remplissage n'a encore résolu — ce qui doit
 * bloquer l'export ou guider l'utilisateur avant publication (chapitre 7.3).
 */
export function unfilledSlots(p: EditorProject): Slot[] {
  return (p.slots ?? []).filter((s) => s.required && !s.filled);
}

/**
 * Remplace le contenu de démonstration d'un emplacement par le vrai contenu
 * de l'utilisateur, et enregistre la provenance si le contenu vient d'une
 * bibliothèque externe (règle 4 : écrite au moment du remplissage, pas après).
 * Un emplacement déjà rempli peut être rerempli — remplacer un choix reste
 * possible tant que le montage n'est pas exporté.
 */
export function fillSlot(
  p: EditorProject,
  slotId: string,
  content: { text?: string; src?: string; provenance?: Provenance }
): EditorProject {
  const slot = (p.slots ?? []).find((s) => s.id === slotId);
  if (!slot) return p;

  let next = p;
  if (slot.targetKind === "text" && content.text !== undefined) {
    next = updateText(next, slot.targetId, { text: content.text });
  } else if (slot.targetKind === "image" && content.src !== undefined) {
    next = updateImageLayer(next, slot.targetId, { src: content.src });
  } else if (slot.targetKind === "clip" && content.src !== undefined) {
    next = { ...next, clips: next.clips.map((c) => (c.id === slot.targetId ? { ...c, src: content.src! } : c)) };
  } else if (slot.targetKind === "audio" && content.src !== undefined) {
    next = { ...next, audios: next.audios.map((a) => (a.id === slot.targetId ? { ...a, src: content.src! } : a)) };
  }

  const slots = (next.slots ?? []).map((s) =>
    s.id === slotId ? { ...s, filled: true, provenance: content.provenance ?? s.provenance } : s
  );
  return normalize({ ...next, slots });
}

/* ────────────────────────────────────────────────────────────────────────────
   Opérations de montage — toutes PURES : elles renvoient un nouveau projet
   ──────────────────────────────────────────────────────────────────────── */

/** Fin de la piste demandée — position d'ajout par défaut. */
export function trackEnd(p: EditorProject, track: number): number {
  return round(
    p.clips.filter((c) => c.track === track).reduce((max, c) => Math.max(max, c.start + c.length), 0)
  );
}

export function addClip(
  p: EditorProject,
  input: {
    id: string;
    src: string;
    kind: ClipKind;
    sourceDuration?: number;
    /** Piste de destination. Par défaut la piste de base. */
    track?: number;
    /** Instant de pose. Par défaut, à la suite de ce que porte la piste. */
    start?: number;
    /** Traçabilité si le plan vient d'une bibliothèque externe (Lot A-3). */
    provenance?: Provenance;
  }
): EditorProject {
  const sourceDuration = input.kind === "image" ? 0 : Math.max(0, input.sourceDuration ?? 0);
  const length = input.kind === "image" ? DEFAULT_IMAGE_SECONDS : sourceDuration || DEFAULT_IMAGE_SECONDS;
  const track = Math.max(0, Math.round(input.track ?? 0));
  const onTrack = p.clips.filter((c) => c.track === track);
  const clip: Clip = {
    id: input.id,
    src: input.src,
    kind: input.kind,
    track,
    start: input.start !== undefined ? Math.max(0, input.start) : trackEnd(p, track),
    length,
    trimStart: 0,
    sourceDuration,
    speed: 1,
    transitionIn: onTrack.length === 0 ? "none" : "fade",
    fit: "cover",
    focusX: 0.5,
    focusY: 0.5,
    provenance: input.provenance,
  };
  return normalize({ ...p, clips: [...p.clips, clip] });
}

/**
 * Déplace un plan : changement de piste et/ou d'instant de début.
 * C'est ce qui permet l'incrustation vidéo, l'image dans l'image et l'écran
 * partagé — impossibles tant que la position était imposée par la séquence.
 */
export function moveClip(
  p: EditorProject,
  clipId: string,
  patch: { track?: number; start?: number }
): EditorProject {
  const clips = p.clips.map((c) =>
    c.id === clipId
      ? {
          ...c,
          track: patch.track === undefined ? c.track : Math.max(0, Math.round(patch.track)),
          start: patch.start === undefined ? c.start : Math.max(0, round(patch.start)),
        }
      : c
  );
  return normalize({ ...p, clips });
}

/**
 * Décale ce qui suit sur la même piste — le « ripple » des bancs de montage.
 *
 * Les plans portent désormais leur instant de début, mais raccourcir un plan ne
 * doit pas ouvrir un trou noir au milieu du film : ce qui vient après se
 * rapproche. Les autres pistes ne bougent pas, elles ne sont pas la séquence.
 */
function ripple(clips: Clip[], track: number, afterStart: number, delta: number): Clip[] {
  if (delta === 0) return clips;
  return clips.map((c) =>
    c.track === track && c.start > afterStart + EPS
      ? { ...c, start: Math.max(0, round(c.start + delta)) }
      : c
  );
}

export function removeClip(p: EditorProject, clipId: string): EditorProject {
  const gone = p.clips.find((c) => c.id === clipId);
  if (!gone) return p;
  const clips = ripple(p.clips.filter((c) => c.id !== clipId), gone.track, gone.start, -gone.length);
  return normalize({ ...p, clips });
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
  const before = p.clips.find((c) => c.id === clipId);
  if (!before) return p;

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

  const after = clips.find((c) => c.id === clipId)!;
  return normalize({ ...p, clips: ripple(clips, before.track, before.start, after.length - before.length) });
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
    start: round(target.start + offset),
    length: round(target.length - offset),
    transitionIn: "none",
  };
  const idx = p.clips.indexOf(target);
  const clips = [...p.clips.slice(0, idx), left, right, ...p.clips.slice(idx + 1)];
  return normalize({ ...p, clips });
}

/**
 * Déplace un plan dans l'ordre de lecture de SA piste. Les plans de la piste
 * sont ensuite reposés bout à bout depuis le début de la séquence.
 */
export function reorderClip(p: EditorProject, clipId: string, toIndex: number): EditorProject {
  const moved = p.clips.find((c) => c.id === clipId);
  if (!moved) return p;

  const onTrack = p.clips.filter((c) => c.track === moved.track).sort((a, b) => a.start - b.start);
  const from = onTrack.findIndex((c) => c.id === clipId);
  const reordered = [...onTrack];
  reordered.splice(from, 1);
  reordered.splice(clamp(toIndex, 0, reordered.length), 0, moved);

  let cursor = onTrack[0]?.start ?? 0;
  const relaid = new Map<string, number>();
  for (const c of reordered) {
    relaid.set(c.id, round(cursor));
    cursor += c.length;
  }
  const clips = p.clips.map((c) => (relaid.has(c.id) ? { ...c, start: relaid.get(c.id)! } : c));
  return normalize({ ...p, clips });
}

export function duplicateClip(p: EditorProject, clipId: string, newId: string): EditorProject {
  const source = p.clips.find((c) => c.id === clipId);
  if (!source) return p;
  // La copie se pose juste après l'original, et repousse la suite de la piste.
  const copy: Clip = { ...source, id: newId, start: round(source.start + source.length) };
  const clips = ripple([...p.clips, copy], source.track, source.start, source.length);
  return normalize({ ...p, clips: clips.map((c) => (c.id === newId ? copy : c)) });
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

/** Transition à l'entrée d'un plan. Sans effet sur le premier de sa piste. */
export function setClipTransition(p: EditorProject, clipId: string, kind: TransitionKind): EditorProject {
  const clips = p.clips.map((c) => {
    if (c.id !== clipId) return c;
    const isFirst = !p.clips.some((o) => o.track === c.track && o.start < c.start - EPS);
    return { ...c, transitionIn: isFirst ? ("none" as TransitionKind) : kind };
  });
  return normalize({ ...p, clips });
}

/**
 * Change la durée d'un plan par saisie directe, sans passer par la poignée.
 * Régler une photo à la seconde près demandait de viser une poignée de deux
 * pixels sur une timeline dont les coordonnées, en plus, étaient fausses.
 */
export function setClipLength(p: EditorProject, clipId: string, seconds: number): EditorProject {
  const before = p.clips.find((c) => c.id === clipId);
  if (!before) return p;
  const available = before.kind === "video" && before.sourceDuration > 0
    ? Math.max(MIN_CLIP_SECONDS, (before.sourceDuration - before.trimStart) / before.speed)
    : Infinity;
  const length = round(clamp(seconds, MIN_CLIP_SECONDS, available));
  const clips = ripple(
    p.clips.map((c) => (c.id === clipId ? { ...c, length } : c)),
    before.track,
    before.start,
    length - before.length
  );
  return normalize({ ...p, clips });
}

/* ── Calques ─────────────────────────────────────────────────────────────── */

/** Valeurs communes à tout calque visuel neuf. */
function newVisual(total: number): Omit<VisualLayer, "x" | "y"> {
  return {
    rotation: 0,
    opacity: 1,
    start: 0,
    end: total || DEFAULT_IMAGE_SECONDS,
    animIn: "none",
    animOut: "none",
    lane: 0,
  };
}

export function addText(p: EditorProject, id: string, text: string): EditorProject {
  const layer: TextLayer = {
    ...newVisual(projectDuration(p)),
    id, text,
    x: 0.1, y: 0.1, sizePct: 0.08, wrapPct: 0,
    color: "#ffffff", font: "sans", bold: true, bg: true,
    align: "left", outline: false, shadow: true, lineHeight: 1.25,
  };
  return normalize({ ...p, texts: [...p.texts, layer] });
}

export function updateText(p: EditorProject, id: string, patch: Partial<TextLayer>): EditorProject {
  return normalize({ ...p, texts: p.texts.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

export function removeText(p: EditorProject, id: string): EditorProject {
  return normalize({ ...p, texts: p.texts.filter((l) => l.id !== id) });
}

/**
 * Duplique un texte — la piste vidéo n'était pas le seul élément dupliable en
 * principe, mais c'était le seul dans les faits (itération 3, C-04). Posée
 * juste après l'original sur la timeline, pour rester visible sans devoir la
 * chercher.
 */
export function duplicateText(p: EditorProject, id: string, newId: string): EditorProject {
  const source = p.texts.find((l) => l.id === id);
  if (!source) return p;
  const span = source.end - source.start;
  const copy: TextLayer = { ...source, id: newId, start: round(source.end), end: round(source.end + span) };
  return normalize({ ...p, texts: [...p.texts, copy] });
}

export function addImageLayer(p: EditorProject, id: string, src: string, provenance?: Provenance): EditorProject {
  const layer: ImageLayer = {
    ...newVisual(projectDuration(p)),
    id, src, x: 0.05, y: 0.05, scale: 0.2, heightPct: 0, provenance,
  };
  return normalize({ ...p, images: [...p.images, layer] });
}

export function updateImageLayer(p: EditorProject, id: string, patch: Partial<ImageLayer>): EditorProject {
  return normalize({ ...p, images: p.images.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

export function removeImageLayer(p: EditorProject, id: string): EditorProject {
  return normalize({ ...p, images: p.images.filter((l) => l.id !== id) });
}

export function duplicateImageLayer(p: EditorProject, id: string, newId: string): EditorProject {
  const source = p.images.find((l) => l.id === id);
  if (!source) return p;
  const span = source.end - source.start;
  const copy: ImageLayer = { ...source, id: newId, start: round(source.end), end: round(source.end + span) };
  return normalize({ ...p, images: [...p.images, copy] });
}

/* ── Formes ──────────────────────────────────────────────────────────────── */

/** Proportions de départ, par type de forme. */
const SHAPE_DEFAULTS: Record<ShapeKind, { w: number; h: number }> = {
  rect: { w: 0.6, h: 0.12 },
  round: { w: 0.4, h: 0.1 },
  ellipse: { w: 0.3, h: 0.3 },
  line: { w: 0.5, h: 0.008 },
  arrow: { w: 0.4, h: 0.06 },
};

export function addShape(p: EditorProject, id: string, shape: ShapeKind, fill = "#5b2d8e"): EditorProject {
  const { w, h } = SHAPE_DEFAULTS[shape];
  const layer: ShapeLayer = {
    ...newVisual(projectDuration(p)),
    id, shape,
    // Centrée : c'est la position d'où l'on part le plus souvent.
    x: (1 - w) / 2, y: (1 - h) / 2,
    w, h,
    fill,
    stroke: "transparent",
    strokeWidth: 0,
    radius: shape === "round" ? 0.03 : 0,
  };
  return normalize({ ...p, shapes: [...p.shapes, layer] });
}

export function updateShape(p: EditorProject, id: string, patch: Partial<ShapeLayer>): EditorProject {
  return normalize({ ...p, shapes: p.shapes.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
}

export function removeShape(p: EditorProject, id: string): EditorProject {
  return normalize({ ...p, shapes: p.shapes.filter((l) => l.id !== id) });
}

export function duplicateShape(p: EditorProject, id: string, newId: string): EditorProject {
  const source = p.shapes.find((l) => l.id === id);
  if (!source) return p;
  const span = source.end - source.start;
  const copy: ShapeLayer = { ...source, id: newId, start: round(source.end), end: round(source.end + span) };
  return normalize({ ...p, shapes: [...p.shapes, copy] });
}

/**
 * Bouton d'appel à l'action : une pastille et son texte, posés d'un geste.
 * C'est le besoin réel derrière la demande de « formes et boutons » — obtenir
 * un bouton supposait jusqu'ici de préparer une image dans un autre outil.
 */
export function addButton(
  p: EditorProject,
  ids: { shape: string; text: string },
  label: string,
  colors: { fill: string; text: string }
): EditorProject {
  const w = 0.46;
  const h = 0.09;
  const x = (1 - w) / 2;
  const y = 0.8;
  let next = addShape(p, ids.shape, "round", colors.fill);
  next = updateShape(next, ids.shape, { x, y, w, h, radius: h / 2 });
  next = addText(next, ids.text, label);
  next = updateText(next, ids.text, {
    x: 0.5,
    // Le texte est centré verticalement dans la pastille.
    y: y + h * 0.28,
    align: "center",
    sizePct: h * 0.42,
    color: colors.text,
    bg: false,
    shadow: false,
    bold: true,
  });
  return next;
}

/* ── Audio ───────────────────────────────────────────────────────────────── */

/**
 * Volume par défaut d'une musique de fond. La pratique de montage place la
 * musique 12 à 18 dB sous la voix ; 25 % correspond à environ −12 dB.
 */
export const DEFAULT_MUSIC_VOLUME = 0.25;

export function addAudio(
  p: EditorProject,
  input: {
    id: string; src: string; name: string; role: AudioRole; sourceDuration?: number;
    /** Traçabilité si le son vient d'une bibliothèque externe (Lot A-3). */
    provenance?: Provenance;
  }
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
    lane: 0,
    provenance: input.provenance,
  };
  return normalize({ ...p, audios: [...p.audios, track] });
}

export function updateAudio(p: EditorProject, id: string, patch: Partial<AudioTrack>): EditorProject {
  return normalize({ ...p, audios: p.audios.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
}

export function removeAudio(p: EditorProject, id: string): EditorProject {
  return normalize({ ...p, audios: p.audios.filter((a) => a.id !== id) });
}

export function duplicateAudio(p: EditorProject, id: string, newId: string): EditorProject {
  const source = p.audios.find((a) => a.id === id);
  if (!source) return p;
  const copy: AudioTrack = { ...source, id: newId, start: round(source.start + source.length) };
  return normalize({ ...p, audios: [...p.audios, copy] });
}

/**
 * Rogne un calque temporel (texte, incrustation, forme ou audio) par une
 * extrémité — la parité que la timeline doit maintenant offrir à tout élément,
 * pas seulement aux plans vidéo (itération 3, C-04). `head` avance le début,
 * `tail` recule la fin ; la durée ne descend jamais sous `MIN_CLIP_SECONDS`.
 */
export type TimedLayerKind = "text" | "image" | "shape" | "audio";

export function trimLayer(
  p: EditorProject,
  kind: TimedLayerKind,
  id: string,
  edge: "head" | "tail",
  deltaSeconds: number
): EditorProject {
  if (kind === "audio") {
    const a = p.audios.find((x) => x.id === id);
    if (!a) return p;
    if (edge === "head") {
      const maxHead = a.length - MIN_CLIP_SECONDS;
      const h = clamp(deltaSeconds, -a.trimStart, Math.max(0, maxHead));
      return updateAudio(p, id, { start: round(a.start + h), trimStart: round(a.trimStart + h), length: round(a.length - h) });
    }
    const maxTail = a.length - MIN_CLIP_SECONDS;
    const tl = clamp(deltaSeconds, -Infinity, Math.max(0, maxTail));
    return updateAudio(p, id, { length: round(a.length - tl) });
  }

  const list = kind === "text" ? p.texts : kind === "image" ? p.images : p.shapes;
  const l = list.find((x) => x.id === id);
  if (!l) return p;
  const patch =
    edge === "head"
      ? { start: round(clamp(l.start + deltaSeconds, 0, l.end - MIN_CLIP_SECONDS)) }
      : { end: round(clamp(l.end - deltaSeconds, l.start + MIN_CLIP_SECONDS, Infinity)) };
  if (kind === "text") return updateText(p, id, patch);
  if (kind === "image") return updateImageLayer(p, id, patch);
  return updateShape(p, id, patch);
}

/**
 * Déplace un calque temporel dans le temps, en conservant sa durée — pendant
 * de `trimLayer` pour le glisser plutôt que le rognage.
 */
export function moveLayerTime(p: EditorProject, kind: TimedLayerKind, id: string, newStart: number): EditorProject {
  const start = Math.max(0, round(newStart));
  if (kind === "audio") {
    return updateAudio(p, id, { start });
  }
  const list = kind === "text" ? p.texts : kind === "image" ? p.images : p.shapes;
  const l = list.find((x) => x.id === id);
  if (!l) return p;
  const span = l.end - l.start;
  const patch = { start, end: round(start + span) };
  if (kind === "text") return updateText(p, id, patch);
  if (kind === "image") return updateImageLayer(p, id, patch);
  return updateShape(p, id, patch);
}

/* ────────────────────────────────────────────────────────────────────────────
   Lecture : ce qui est visible à un instant donné
   ──────────────────────────────────────────────────────────────────────── */

export interface ActiveClip {
  clip: Clip;
  /** Position correspondante DANS LA SOURCE. */
  sourceTime: number;
}

/**
 * Tous les plans joués à l'instant `time`, de la piste de base vers le dessus.
 * Le dernier de la liste est celui qu'on voit par-dessus les autres.
 */
export function clipsAt(p: EditorProject, time: number): ActiveClip[] {
  return p.clips
    .filter((c) => time >= c.start - EPS && time < c.start + c.length - EPS)
    .sort((a, b) => a.track - b.track)
    .map((c) => ({ clip: c, sourceTime: c.trimStart + (time - c.start) * c.speed }));
}

/**
 * Plan de la piste de BASE joué à l'instant `time`.
 * Conservé pour tout ce qui n'a besoin que du fond : cadrage, son d'origine.
 */
export function clipAt(p: EditorProject, time: number): ActiveClip | null {
  const active = clipsAt(p, time);
  if (active.length > 0) return active[0];

  // Après la fin du film, on reste sur la dernière image plutôt que sur du noir.
  const base = p.clips.filter((c) => c.track === 0);
  const last = base.reduce<Clip | null>((acc, c) => (!acc || c.start > acc.start ? c : acc), null);
  if (last && time >= last.start + last.length - EPS) {
    return { clip: last, sourceTime: last.trimStart + last.length * last.speed };
  }
  return null;
}

/** Vrai si le calque est visible à cet instant. */
function visible(l: VisualLayer, time: number): boolean {
  return time >= l.start - EPS && time <= l.end + EPS;
}

/** Calques de texte visibles à l'instant `time`. */
export function textsAt(p: EditorProject, time: number): TextLayer[] {
  return p.texts.filter((l) => visible(l, time));
}

/** Incrustations visibles à l'instant `time`. */
export function imagesAt(p: EditorProject, time: number): ImageLayer[] {
  return p.images.filter((l) => visible(l, time));
}

/** Formes visibles à l'instant `time`. */
export function shapesAt(p: EditorProject, time: number): ShapeLayer[] {
  return p.shapes.filter((l) => visible(l, time));
}

/**
 * Opacité effective d'un calque à un instant, animations comprises.
 * Une seule fonction pour l'aperçu et pour le rendu : les deux ne peuvent pas
 * diverger sur le moment où un titre finit d'apparaître.
 */
export function layerProgress(l: VisualLayer, time: number): { opacity: number; offsetX: number; offsetY: number; scale: number } {
  const span = Math.max(EPS, l.end - l.start);
  const d = Math.min(ANIMATION_SECONDS, span / 2);
  const sinceStart = time - l.start;
  const untilEnd = l.end - time;

  let phase = 1;
  let kind: AnimationKind = "none";
  if (l.animIn !== "none" && sinceStart >= 0 && sinceStart < d) {
    phase = sinceStart / d;
    kind = l.animIn;
  } else if (l.animOut !== "none" && untilEnd >= 0 && untilEnd < d) {
    phase = untilEnd / d;
    kind = l.animOut;
  }
  if (kind === "none") return { opacity: l.opacity, offsetX: 0, offsetY: 0, scale: 1 };

  // Progression adoucie : un démarrage linéaire se remarque à l'œil.
  const e = 1 - Math.pow(1 - clamp(phase, 0, 1), 3);
  const slide = (1 - e) * 0.12;
  return {
    opacity: l.opacity * e,
    offsetX: kind === "slide-left" ? slide : kind === "slide-right" ? -slide : 0,
    offsetY: kind === "slide-up" ? slide : kind === "slide-down" ? -slide : 0,
    scale: kind === "zoom" ? 0.85 + 0.15 * e : 1,
  };
}
