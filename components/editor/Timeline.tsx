"use client";

// Timeline multipiste — la VUE du document de projet.
//
// La timeline ne porte aucune logique de montage : elle affiche le document et
// émet des intentions. Rogner, scinder, déplacer sont des opérations pures du
// modèle (lib/editor/project.ts), déjà testées.
//
// UN SEUL SYSTÈME DE COORDONNÉES
// La version précédente en comptait quatre. Le libellé de piste était posé DANS
// le flux temporel : les blocs commençaient donc 56 px plus loin que la
// graduation, la tête de lecture partait de 8 px, et la conversion clic → temps
// du bord du conteneur. Au zoom médian, l'écart entre le trait affiché et le
// plan qu'il désignait valait plus d'une seconde — d'où l'impression que la
// scission « coupait à côté » alors que le calcul, lui, était juste.
//
// Ici, les libellés sont sortis du flux temporel, dans une colonne fixe. Tout
// ce qui vit dans le temps — graduation, blocs, tête de lecture, conversion du
// clic — passe par `timeToPx` / `pxToTime`, mesurés sur le MÊME élément.
//
// PISTES LIBRES (Lot A2, audit Editing Bench v4)
// Jusqu'ici, cinq blocs de construction séparés — une boucle par piste vidéo,
// une piste fixe par type de calque, une boucle sur les rôles audio —
// dessinaient sept groupes de rangées indépendants : un texte ne pouvait
// jamais apparaître « au-dessus » d'une piste vidéo, une forme jamais devant
// un texte. Une seule boucle sur `project.tracks` les remplace : n'importe
// quel type d'élément peut vivre sur n'importe quelle piste visuelle, et
// l'utilisateur en crée, supprime, réordonne — plutôt qu'une piste qui
// n'existait qu'en creux, parce qu'un plan la référençait.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  MIN_CLIP_SECONDS,
  packLanes,
  projectDuration,
  type Clip,
  type EditorProject,
  type TimedLayerKind,
  type TrackDef,
  type TrackFamily,
} from "@/lib/editor/project";
import { Tooltip } from "./Tooltip";

/** Niveaux de zoom, en pixels par seconde. */
const ZOOM_LEVELS = [10, 20, 40, 80, 160];

/** Aimantation : distance en secondes sous laquelle on colle à un repère. */
const SNAP_SECONDS = 0.15;

/** Hauteurs partagées par la colonne des libellés et par les pistes. */
const RULER_H = 20;
const LANE_H = 40;
/** Espace vertical entre deux pistes — voir `space-y-1.5` plus bas. */
const LANE_GAP = 6;

export type TimelineSelection =
  | { kind: "clip"; id: string }
  | { kind: "text"; id: string }
  | { kind: "audio"; id: string }
  | { kind: "image"; id: string }
  | { kind: "shape"; id: string }
  | null;

/** Type + id d'un élément, tous types confondus — la clé de `moveElement`. */
type ElementKind = "clip" | TimedLayerKind;

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, "0")}`;
}

/** LA conversion temps → pixels. Aucune autre ne doit exister. */
export function timeToPx(time: number, pxPerSec: number): number {
  return time * pxPerSec;
}

/** LA conversion pixels → temps. Réciproque exacte de `timeToPx`. */
export function pxToTime(px: number, pxPerSec: number): number {
  return pxPerSec > 0 ? px / pxPerSec : 0;
}

/** Colle une valeur au repère le plus proche s'il est assez près. */
export function snap(time: number, marks: number[], tolerance = SNAP_SECONDS): number {
  let best = time;
  let bestDist = tolerance;
  for (const m of marks) {
    const d = Math.abs(m - time);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

export function Timeline({
  project,
  playhead,
  selection,
  multiSelectedKeys,
  onSeek,
  onSelect,
  onContextMenu,
  onLaneContextMenu,
  onTrim,
  onTrimLayer,
  onMoveElement,
  onDragStart,
  onDragEnd,
  onToggleTrackLock,
  onToggleTrackHidden,
  onAddTrack,
  onRemoveTrack,
  onReorderTrack,
}: {
  project: EditorProject;
  playhead: number;
  selection: TimelineSelection;
  /**
   * Éléments ADDITIONNELS d'une sélection multiple, sous forme de clés
   * `kind:id` — la sélection principale (`selection`) reste, elle, un objet
   * unique : c'est ce qui pilote le panneau de propriétés et le glisser dans
   * l'aperçu, inchangés par la sélection multiple (chapitre 8, P2-4).
   */
  multiSelectedKeys?: Set<string>;
  onSeek: (time: number) => void;
  /**
   * `e` porte l'état des touches (Maj/Ctrl/⌘) : Maj-clic ou Ctrl/⌘-clic
   * ajoute l'élément à la sélection au lieu de la remplacer. Absent sur un
   * clic dans le vide ou une sélection programmatique.
   */
  onSelect: (sel: TimelineSelection, e?: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void;
  /**
   * Clic droit sur un élément. La timeline neutralise systématiquement le
   * menu du navigateur et remonte le geste : c'est à l'appelant de décider
   * quel menu ouvrir, jamais à Chrome (audit Editing Bench v4, constat 4).
   */
  onContextMenu?: (sel: NonNullable<TimelineSelection>, e: { clientX: number; clientY: number }) => void;
  /**
   * Clic droit sur le VIDE d'une piste — là où il n'y a aucun élément à
   * désigner. Porte la piste visée et l'instant pointé, de quoi proposer un
   * collage à cet endroit précis plutôt qu'à la tête de lecture.
   */
  onLaneContextMenu?: (ctx: { trackId: string; time: number }, e: { clientX: number; clientY: number }) => void;
  /** Rognage par une extrémité, en secondes (positif = raccourcit). */
  onTrim: (clipId: string, edge: "head" | "tail", delta: number) => void;
  onTrimLayer: (kind: TimedLayerKind, id: string, edge: "head" | "tail", delta: number) => void;
  /**
   * Déplace un élément QUELCONQUE — plan, texte, incrustation, forme, son —
   * vers une autre piste et/ou un autre instant, en un seul geste (Lot A2).
   */
  onMoveElement: (sel: { kind: ElementKind; id: string }, patch: { trackId?: string; start?: number }) => void;
  /** Début / fin d'un geste continu (glisser, rogner) — pour ne compter qu'UNE
      entrée d'historique par geste plutôt qu'une par pixel parcouru. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Verrouillage et masquage d'une piste QUELCONQUE (Lot A2), par son id. */
  onToggleTrackLock: (trackId: string) => void;
  onToggleTrackHidden: (trackId: string) => void;
  /** Créer / supprimer / réordonner une piste — nouveau au Lot A2. */
  onAddTrack: (family: TrackFamily) => void;
  onRemoveTrack: (trackId: string) => void;
  onReorderTrack: (trackId: string, direction: "up" | "down") => void;
}) {
  const t = useT();
  const [zoomIdx, setZoomIdx] = useState(1);
  const pxPerSec = ZOOM_LEVELS[zoomIdx];
  const duration = projectDuration(project);
  /** Élément qui porte le temps : origine unique de toutes les coordonnées. */
  const timeRef = useRef<HTMLDivElement>(null);
  /**
   * Rangée affichée de chaque piste. Le clic droit doit ouvrir le menu du banc
   * PARTOUT dans la timeline — y compris dans les interstices entre rangées,
   * sur la graduation, dans la colonne des libellés et sous la dernière piste,
   * qui n'appartiennent à aucune rangée. Sans ce registre, il n'y aurait aucun
   * moyen de dire quelle piste l'utilisateur visait (audit v4, constat 4).
   */
  const laneRefs = useRef(new Map<string, HTMLDivElement>());
  /** Conteneur à défilement horizontal — cible de Maj+molette et du recentrage. */
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Repères d'aimantation : bornes de plans, tête de lecture, zéro. */
  const marks = useMemo(() => {
    const m = [0, duration, playhead];
    for (const c of project.clips) m.push(c.start, c.start + c.length);
    return m;
  }, [project.clips, duration, playhead]);

  const drag = useRef<
    | { type: "trim"; clipId: string; edge: "head" | "tail"; startX: number }
    | { type: "trimLayer"; kind: TimedLayerKind; id: string; edge: "head" | "tail"; startX: number }
    | { type: "move"; kind: ElementKind; id: string; startX: number; startY: number; fromStart: number; fromLaneIndex: number; family: TrackFamily }
    | { type: "scrub" }
    | null
  >(null);

  /**
   * Instant désigné par un point de l'écran.
   * `getBoundingClientRect` est mesuré sur l'élément du temps lui-même : il
   * tient donc compte du défilement horizontal sans correction manuelle — la
   * cause du décrochage du trait sur une timeline plus large que l'écran.
   */
  const timeFromEvent = useCallback(
    (clientX: number): number => {
      const el = timeRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return Math.max(0, Math.min(duration, pxToTime(clientX - rect.left, pxPerSec)));
    },
    [pxPerSec, duration]
  );

  const seekTo = useCallback(
    (clientX: number) => onSeek(snap(timeFromEvent(clientX), marks)),
    [onSeek, timeFromEvent, marks]
  );

  /**
   * Piste désignée par un point de l'écran — celle dont la rangée contient
   * l'ordonnée, sinon la plus proche verticalement. Un clic sous la dernière
   * piste vise donc cette dernière piste, pas le vide.
   */
  function trackAt(clientY: number): string | null {
    let best: { id: string; distance: number } | null = null;
    for (const [id, el] of laneRefs.current) {
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) continue;
      const distance = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
      if (distance === 0) return id;
      if (!best || distance < best.distance) best = { id, distance };
    }
    return best?.id ?? null;
  }

  /** Démarre un balayage : la lecture suit le geste jusqu'au relâchement. */
  function startScrub(e: React.PointerEvent) {
    drag.current = { type: "scrub" };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    seekTo(e.clientX);
  }

  function onLanePointerDown(e: React.PointerEvent) {
    // Même garde-fou que sur les blocs : `pointerdown` se déclenche pour TOUT
    // bouton. Sans lui, le clic droit dans le vide effaçait la sélection et
    // déplaçait la tête de lecture avant même d'ouvrir son menu.
    if (e.button === 2) return;
    onSelect(null);
    startScrub(e);
  }

  /** Ouvre un geste continu — une seule entrée d'historique le scellera. */
  function beginDrag<T extends { type: string }>(state: T) {
    onDragStart?.();
    drag.current = state as NonNullable<typeof drag.current>;
  }

  /* ── Pistes affichées ──────────────────────────────────────────────────
     Une SEULE source pour les libellés et les blocs : une rangée par piste
     de `project.tracks`, quel que soit ce qu'elle porte. Les pistes
     visuelles s'affichent de la plus en avant vers la piste de base, les
     pistes son de la plus récente vers la plus ancienne — l'ordre déjà
     utilisé pour les pistes vidéo, étendu à toute la timeline. */
  const allTracks = project.tracks ?? [];
  // Ordre ASCENDANT (index 0 = piste de base) — sert à NOMMER les pistes
  // (V1, V2… A1, A2…, la convention même de l'audit), indépendamment de
  // l'ordre d'AFFICHAGE ci-dessous (la plus en avant tout en haut).
  const visualAscending = useMemo(() => allTracks.filter((tr) => tr.family === "visual"), [allTracks]);
  const audioAscending = useMemo(() => allTracks.filter((tr) => tr.family === "audio"), [allTracks]);
  const visualTracks = useMemo(() => visualAscending.slice().reverse(), [visualAscending]);
  const audioTracks = useMemo(() => audioAscending.slice().reverse(), [audioAscending]);
  const displayTracks = useMemo(() => [...visualTracks, ...audioTracks], [visualTracks, audioTracks]);

  type Placed = { kind: ElementKind; id: string; start: number; end: number; lane: number };

  /** Élément vivant sur CETTE piste, tous types confondus, avec sa propre
      sous-piste — le modèle ne pack les rangées que par TYPE ; plusieurs
      types peuvent désormais se partager une piste (Lot A2), la rangée doit
      donc être recalculée ici, sur l'ensemble mélangé. */
  function placedOn(trackId: string): Placed[] {
    const raw: (Placed & { end: number })[] = [
      ...project.clips.filter((c) => c.trackId === trackId).map((c) => ({
        kind: "clip" as const, id: c.id, start: c.start, end: c.start + c.length, lane: 0,
      })),
      ...project.texts.filter((l) => l.trackId === trackId).map((l) => ({
        kind: "text" as const, id: l.id, start: l.start, end: l.end, lane: 0,
      })),
      ...project.images.filter((l) => l.trackId === trackId).map((l) => ({
        kind: "image" as const, id: l.id, start: l.start, end: l.end, lane: 0,
      })),
      ...project.shapes.filter((l) => l.trackId === trackId).map((l) => ({
        kind: "shape" as const, id: l.id, start: l.start, end: l.end, lane: 0,
      })),
      ...project.audios.filter((a) => a.trackId === trackId).map((a) => ({
        kind: "audio" as const, id: a.id, start: a.start, end: a.start + a.length, lane: 0,
      })),
    ];
    return packLanes(raw);
  }

  const lanes = displayTracks.map((tr) => ({ track: tr, items: placedOn(tr.id) }));
  const rowsOf = (items: Placed[]) => Math.max(1, ...items.map((it) => it.lane + 1));

  /** Sommet cumulé de chaque piste affichée — sert au calcul du glissement
      vertical, dont le pas n'est plus constant depuis que des pistes
      peuvent avoir des hauteurs différentes (Lot A2). */
  const laneTops = useMemo(() => {
    const tops: number[] = [];
    let acc = 0;
    for (const l of lanes) {
      tops.push(acc);
      acc += rowsOf(l.items) * LANE_H + LANE_GAP;
    }
    return tops;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes]);

  /** Piste affichée dont la plage verticale contient `y`, restreinte à la
      famille demandée — un plan ne peut jamais glisser jusqu'à une piste
      son, ni l'inverse. */
  function laneIndexAtY(y: number, family: TrackFamily): number {
    let first = -1;
    let last = -1;
    for (let i = 0; i < displayTracks.length; i++) {
      if (displayTracks[i].family !== family) continue;
      if (first < 0) first = i;
      last = i;
    }
    if (first < 0) return -1;
    for (let i = first; i <= last; i++) {
      const rows = rowsOf(lanes[i].items);
      if (y < laneTops[i] + rows * LANE_H + LANE_GAP) return i;
    }
    return last;
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.type === "scrub") {
      seekTo(e.clientX);
      return;
    }
    const deltaSec = pxToTime(e.clientX - d.startX, pxPerSec);
    if (d.type === "trim") {
      if (Math.abs(deltaSec) < 0.02) return;
      onTrim(d.clipId, d.edge, d.edge === "head" ? deltaSec : -deltaSec);
      drag.current = { ...d, startX: e.clientX };
      return;
    }
    if (d.type === "trimLayer") {
      if (Math.abs(deltaSec) < 0.02) return;
      onTrimLayer(d.kind, d.id, d.edge, d.edge === "head" ? deltaSec : -deltaSec);
      drag.current = { ...d, startX: e.clientX };
      return;
    }

    // Déplacement libre : un élément se pose où on le lâche, et change de
    // piste quand le geste franchit une rangée — quel que soit son type
    // (Lot A2 généralise ce qui n'existait auparavant que pour les plans).
    const targetY = laneTops[d.fromLaneIndex] + (e.clientY - d.startY);
    const targetIdx = laneIndexAtY(Math.max(0, targetY), d.family);
    const targetTrackId = targetIdx >= 0 ? displayTracks[targetIdx].id : undefined;
    const start = Math.max(0, snap(d.fromStart + deltaSec, marks));
    const trackChanged = targetTrackId !== undefined && targetIdx !== d.fromLaneIndex;
    if (Math.abs(start - d.fromStart) > 0.02 || trackChanged) {
      onMoveElement({ kind: d.kind, id: d.id }, { start, ...(trackChanged ? { trackId: targetTrackId } : {}) });
      if (trackChanged) drag.current = { ...d, fromLaneIndex: targetIdx, startY: e.clientY };
    }
  }

  /** Un geste continu (glisser, rogner) ne doit compter qu'UNE entrée
      d'historique — sans quoi un déplacement produit des dizaines d'états et
      l'annulation ne défait qu'un pixel à la fois (itération 3, chapitre 9,
      point 3). `endDrag` referme le geste ouvert par `onTrimStart`/
      `onMoveStart`, jamais un simple balayage de la tête de lecture. */
  function endDrag() {
    if (drag.current && drag.current.type !== "scrub") onDragEnd?.();
    drag.current = null;
  }

  const width = Math.max(240, timeToPx(duration, pxPerSec));

  /**
   * Molette sur la timeline — zoom ancré sur l'INSTANT sous le curseur, Maj
   * pour défiler horizontalement plutôt que zoomer (itération 3, §4.2).
   * Écouteur natif non passif : un `onWheel` React ne peut pas empêcher le
   * défilement de la page (voir Preview.tsx).
   */
  const latest = useRef({ zoomIdx, pxPerSec });
  latest.current = { zoomIdx, pxPerSec };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let accum = 0;
    function onWheelNative(e: WheelEvent) {
      e.preventDefault();
      if (e.shiftKey) {
        el!.scrollLeft += e.deltaY;
        return;
      }
      accum += e.deltaY;
      if (Math.abs(accum) < 40) return;
      const dir = accum > 0 ? -1 : 1;
      accum = 0;
      const { zoomIdx: idx, pxPerSec: pps } = latest.current;
      const nextIdx = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, idx + dir));
      if (nextIdx === idx) return;
      const rect = el!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const timeAtCursor = pxToTime(cursorX + el!.scrollLeft, pps);
      const nextPxPerSec = ZOOM_LEVELS[nextIdx];
      setZoomIdx(nextIdx);
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollLeft = Math.max(0, timeToPx(timeAtCursor, nextPxPerSec) - cursorX);
      });
    }
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  /**
   * Ajuste le zoom pour que tout le montage tienne dans la largeur visible —
   * indispensable dès qu'on a zoomé, sinon on perd le film de vue (chapitre 8).
   */
  const fitToWindow = useCallback(() => {
    const el = scrollRef.current;
    if (!el || duration <= 0) return;
    const available = el.clientWidth || 1;
    let bestIdx = 0;
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
      if (timeToPx(duration, ZOOM_LEVELS[i]) <= available) bestIdx = i;
    }
    setZoomIdx(bestIdx);
    requestAnimationFrame(() => { if (el) el.scrollLeft = 0; });
  }, [duration]);

  /**
   * Tête de lecture suivie : pendant la lecture (ou un déplacement au clavier),
   * la timeline défile pour la garder visible — sans cela, elle sort du cadre
   * dès qu'on a zoomé et rien ne la ramène (chapitre 9, point 2).
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const px = timeToPx(playhead, pxPerSec);
    if (px < el.scrollLeft || px > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, px - el.clientWidth / 2);
    }
  }, [playhead, pxPerSec]);

  const clipsById = useMemo(() => new Map(project.clips.map((c) => [c.id, c])), [project.clips]);
  const labelOf = (kind: ElementKind, id: string): string => {
    if (kind === "text") return project.texts.find((l) => l.id === id)?.text.split("\n")[0] || t("Texte", "Text");
    if (kind === "shape") return t("Forme", "Shape");
    if (kind === "image") return t("Incrustation", "Overlay");
    if (kind === "audio") return project.audios.find((a) => a.id === id)?.name ?? "";
    return "";
  };
  const audioExtra = (id: string) => {
    const a = project.audios.find((x) => x.id === id);
    return a ? { muted: a.muted, src: a.src, trimStart: a.trimStart } : {};
  };

  return (
    <div className="space-y-2">
      {/* Barre d'outils : zoom + minutage + nouvelle piste */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs tabular-nums text-muted">
          {formatTime(playhead)} / {formatTime(duration)}
        </span>
        <div className="flex items-center gap-1">
          <Tooltip label={t("Ajouter une piste vidéo/texte/forme", "Add a video/text/shape track")}>
            <button
              type="button"
              onClick={() => onAddTrack("visual")}
              aria-label={t("Ajouter une piste visuelle", "Add a visual track")}
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-2xs text-muted ring-1 ring-hair hover:text-ink"
            >
              🎬+
            </button>
          </Tooltip>
          <Tooltip label={t("Ajouter une piste son", "Add an audio track")}>
            <button
              type="button"
              onClick={() => onAddTrack("audio")}
              aria-label={t("Ajouter une piste son", "Add an audio track")}
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-2xs text-muted ring-1 ring-hair hover:text-ink"
            >
              ♪+
            </button>
          </Tooltip>
          <span className="mx-1 h-4 w-px bg-hair" />
          <Tooltip label={t("Dézoomer la timeline — molette", "Zoom out timeline — wheel")}>
            <button
              type="button"
              onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
              disabled={zoomIdx === 0}
              aria-label={t("Dézoomer", "Zoom out")}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink disabled:opacity-40"
            >
              −
            </button>
          </Tooltip>
          <span className="w-14 text-center text-2xs text-muted">{pxPerSec} px/s</span>
          <Tooltip label={t("Zoomer la timeline — molette", "Zoom in timeline — wheel")}>
            <button
              type="button"
              onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              aria-label={t("Zoomer", "Zoom in")}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink disabled:opacity-40"
            >
              +
            </button>
          </Tooltip>
          <Tooltip label={t("Ajuste le zoom pour voir tout le montage", "Adjusts the zoom to fit the whole edit")}>
            <button
              type="button"
              onClick={fitToWindow}
              className="ml-1 rounded-md px-1.5 py-0.5 text-2xs text-muted ring-1 ring-hair hover:text-ink"
            >
              {t("Ajuster", "Fit")}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Hauteur BORNÉE (180px..38vh) : au-delà, défilement vertical interne
          — jamais de croissance du bloc, sinon le total dépasse la fenêtre
          dès qu'on empile pistes vidéo, textes, formes et audios (§3.2). */}
      <div
        className="relative flex gap-2 overflow-y-auto overscroll-contain rounded-lg border border-hair bg-canvas/60 p-2"
        style={{ minHeight: 180, maxHeight: "38vh" }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onContextMenu={(e) => {
          // Filet de sécurité : les blocs et les rangées ont déjà leur propre
          // gestionnaire et neutralisent l'événement. Tout le RESTE du cadre —
          // graduation, colonne des libellés, interstices, zone sous la
          // dernière piste — arrive ici, et ne doit jamais retomber sur le
          // menu du navigateur.
          if (e.defaultPrevented || !onLaneContextMenu) return;
          const trackId = trackAt(e.clientY);
          if (!trackId) return;
          e.preventDefault();
          onLaneContextMenu({ trackId, time: timeFromEvent(e.clientX) }, e);
        }}
      >
        {/* État vide explicite — un cadre nu, sans le moindre repère, ne dit
            pas à l'utilisateur ce qu'il doit faire (itération 3, chapitre 9,
            point 6). */}
        {lanes.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-2xs text-muted">
            {t("Ajoutez un plan vidéo ou photo pour commencer le montage.", "Add a video or photo clip to start editing.")}
          </p>
        )}

        {/* Colonne des libellés — HORS du flux temporel */}
        <div className="shrink-0 space-y-1.5">
          <div style={{ height: RULER_H }} />
          {lanes.map(({ track, items }, i) => (
            <div
              key={track.id}
              style={{ height: LANE_H * rowsOf(items) }}
              className={`flex w-20 items-center text-[9px] uppercase tracking-wide text-muted ${track.hidden ? "opacity-40" : ""}`}
            >
              <TrackLabel
                name={
                  track.family === "visual"
                    ? `V${visualAscending.findIndex((v) => v.id === track.id) + 1}`
                    : `A${audioAscending.findIndex((a) => a.id === track.id) + 1}`
                }
                locked={Boolean(track.locked)}
                hidden={Boolean(track.hidden)}
                onToggleLock={() => onToggleTrackLock(track.id)}
                onToggleHidden={() => onToggleTrackHidden(track.id)}
                onMoveUp={() => onReorderTrack(track.id, "up")}
                onMoveDown={() => onReorderTrack(track.id, "down")}
                onRemove={() => onRemoveTrack(track.id)}
                canRemove={track.family === "audio" || visualTracks.length > 1}
                canMoveUp={i > 0 && displayTracks[i - 1]?.family === track.family}
                canMoveDown={i < displayTracks.length - 1 && displayTracks[i + 1]?.family === track.family}
              />
            </div>
          ))}
        </div>

        {/* Zone du temps — origine unique de toutes les coordonnées */}
        <div ref={scrollRef} className="relative flex-1 overflow-x-auto overscroll-contain">
          <div ref={timeRef} style={{ width }} className="relative space-y-1.5">
            {/* Graduation : balayage direct, c'est la zone toujours disponible
                même quand les pistes sont pleines. */}
            <Ruler
              duration={duration}
              pxPerSec={pxPerSec}
              onScrub={startScrub}
              label={t("Se déplacer dans le film", "Scrub the film")}
            />

            {lanes.map(({ track, items }, laneIdx) => (
              <div
                key={track.id}
                ref={(el) => {
                  if (el) laneRefs.current.set(track.id, el);
                  else laneRefs.current.delete(track.id);
                }}
                style={{ height: LANE_H * rowsOf(items) }}
                className={`relative ${track.hidden ? "opacity-40" : ""}`}
                onPointerDown={onLanePointerDown}
                onContextMenu={(e) => {
                  if (!onLaneContextMenu) return;
                  e.preventDefault();
                  onLaneContextMenu({ trackId: track.id, time: timeFromEvent(e.clientX) }, e);
                }}
              >
                {items.map((it) => {
                  const locked = Boolean(track.locked);
                  const startMove = (e: React.PointerEvent) => {
                    if (locked) return;
                    beginDrag({
                      type: "move", kind: it.kind, id: it.id,
                      startX: e.clientX, startY: e.clientY,
                      fromStart: it.start, fromLaneIndex: laneIdx, family: track.family,
                    });
                  };
                  if (it.kind === "clip") {
                    const clip = clipsById.get(it.id);
                    if (!clip) return null;
                    return (
                      <ClipBlock
                        key={it.id}
                        clip={clip}
                        pxPerSec={pxPerSec}
                        lane={it.lane}
                        selected={(selection?.kind === "clip" && selection.id === it.id) || Boolean(multiSelectedKeys?.has(`clip:${it.id}`))}
                        locked={locked}
                        dim={Boolean(track.hidden)}
                        onSelect={(e) => onSelect({ kind: "clip", id: it.id }, e)}
                        onContextMenu={(e) => onContextMenu?.({ kind: "clip", id: it.id }, e)}
                        onTrimStart={(edge, e) => { if (!locked) beginDrag({ type: "trim", clipId: it.id, edge, startX: e.clientX }); }}
                        onMoveStart={startMove}
                      />
                    );
                  }
                  const kind = it.kind;
                  return (
                    <LayerBlock
                      key={it.id}
                      label={labelOf(kind, it.id)}
                      start={it.start}
                      length={Math.max(MIN_CLIP_SECONDS, it.end - it.start)}
                      lane={it.lane}
                      pxPerSec={pxPerSec}
                      tone={kind}
                      muted={kind === "audio" ? audioExtra(it.id).muted : undefined}
                      src={kind === "audio" ? audioExtra(it.id).src : undefined}
                      trimStart={kind === "audio" ? audioExtra(it.id).trimStart : undefined}
                      selected={(selection?.kind === kind && selection.id === it.id) || Boolean(multiSelectedKeys?.has(`${kind}:${it.id}`))}
                      onSelect={(e) => onSelect({ kind, id: it.id }, e)}
                      onContextMenu={(e) => onContextMenu?.({ kind, id: it.id }, e)}
                      onTrimStart={(edge, e) => beginDrag({ type: "trimLayer", kind, id: it.id, edge, startX: e.clientX })}
                      onMoveStart={startMove}
                    />
                  );
                })}
              </div>
            ))}

            {/* Tête de lecture — même origine que tout le reste */}
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-danger-500"
              style={{ left: timeToPx(playhead, pxPerSec) }}
            >
              {/* Seule la poignée capte le pointeur : le trait ne doit pas
                  empêcher de sélectionner ce qui se trouve dessous. */}
              <span
                role="slider"
                tabIndex={0}
                aria-label={t("Tête de lecture", "Playhead")}
                aria-valuemin={0}
                aria-valuemax={Math.max(0, duration)}
                aria-valuenow={playhead}
                onPointerDown={(e) => { e.stopPropagation(); startScrub(e); }}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 1 : 0.1;
                  if (e.key === "ArrowLeft") { e.preventDefault(); onSeek(Math.max(0, playhead - step)); }
                  if (e.key === "ArrowRight") { e.preventDefault(); onSeek(Math.min(duration, playhead + step)); }
                }}
                className="pointer-events-auto absolute -left-1.5 -top-0.5 h-3 w-3 cursor-ew-resize rounded-full bg-danger-500 ring-2 ring-card"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sous-composants ─────────────────────────────────────────────────────── */

function Ruler({
  duration,
  pxPerSec,
  onScrub,
  label,
}: {
  duration: number;
  pxPerSec: number;
  onScrub: (e: React.PointerEvent) => void;
  label: string;
}) {
  // Un repère par seconde tant que c'est lisible, sinon toutes les 5 ou 10 s.
  const step = pxPerSec >= 80 ? 1 : pxPerSec >= 40 ? 2 : pxPerSec >= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let s = 0; s <= Math.ceil(duration); s += step) ticks.push(s);
  return (
    <div
      role="presentation"
      onPointerDown={onScrub}
      title={label}
      style={{ height: RULER_H }}
      className="relative cursor-ew-resize select-none border-b border-hair"
    >
      {ticks.map((s) => (
        <span
          key={s}
          className="pointer-events-none absolute top-0 border-l border-hair pl-1 text-[9px] leading-none text-muted"
          style={{ left: timeToPx(s, pxPerSec) }}
        >
          {s}s
        </span>
      ))}
    </div>
  );
}

function ClipBlock({
  clip,
  pxPerSec,
  lane,
  selected,
  locked,
  dim,
  onSelect,
  onContextMenu,
  onTrimStart,
  onMoveStart,
}: {
  clip: Clip;
  pxPerSec: number;
  /** Rangée au sein de la piste — plusieurs types peuvent la partager (A2). */
  lane: number;
  selected: boolean;
  /** Piste verrouillée — le plan se sélectionne toujours, mais ne bouge plus. */
  locked?: boolean;
  /** Piste masquée — indication visuelle seule, la piste reste sélectionnable. */
  dim?: boolean;
  onSelect: (e: React.PointerEvent) => void;
  onContextMenu?: (e: { clientX: number; clientY: number }) => void;
  onTrimStart: (edge: "head" | "tail", e: React.PointerEvent) => void;
  onMoveStart: (e: React.PointerEvent) => void;
}) {
  const t = useT();
  return (
    <div
      className={`absolute overflow-hidden rounded-md border text-[10px] ${
        selected ? "border-page ring-2 ring-page/40" : "border-hair"
      } ${clip.kind === "image" ? "bg-ai-visualbg" : "bg-ai-textbg"} ${locked ? "cursor-not-allowed" : ""}`}
      style={{
        left: timeToPx(clip.start, pxPerSec),
        width: Math.max(12, timeToPx(clip.length, pxPerSec)),
        top: lane * LANE_H,
        height: LANE_H,
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        // Le clic DROIT ne doit ni remplacer la sélection ni démarrer un
        // glisser — seulement ouvrir le menu contextuel (`onContextMenu`
        // ci-dessous). Sans ce garde-fou, `pointerdown` se déclenche pour
        // TOUT bouton de la souris et effaçait la sélection multiple avant
        // même que le clic droit n'ait eu la chance d'ouvrir son menu.
        if (e.button === 2) return;
        onSelect(e);
        onMoveStart(e);
      }}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e);
      }}
    >
      <span className="pointer-events-none block truncate px-2 py-1 text-ink">
        {locked ? "🔒 " : dim ? "🚫 " : ""}{clip.kind === "image" ? "🖼" : "🎬"} {clip.length.toFixed(1)}s
        {clip.speed !== 1 && ` · ${clip.speed}×`}
      </span>
      {/* Poignées de rognage : une par extrémité — retirées si la piste est
          verrouillée, pour ne pas promettre un geste qui ne fera rien. */}
      {!locked && (
        <>
          <span
            role="separator"
            aria-label={t("Rogner le début", "Trim start")}
            onPointerDown={(e) => { e.stopPropagation(); onSelect(e); onTrimStart("head", e); }}
            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-page/50 hover:bg-page"
          />
          <span
            role="separator"
            aria-label={t("Rogner la fin", "Trim end")}
            onPointerDown={(e) => { e.stopPropagation(); onSelect(e); onTrimStart("tail", e); }}
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-page/50 hover:bg-page"
          />
        </>
      )}
    </div>
  );
}

/** Nom de piste + verrouillage/masquage/réordonnancement/suppression (Lot A2). */
function TrackLabel({
  name,
  locked,
  hidden,
  onToggleLock,
  onToggleHidden,
  onMoveUp,
  onMoveDown,
  onRemove,
  canRemove,
  canMoveUp,
  canMoveDown,
}: {
  name: string;
  locked: boolean;
  hidden: boolean;
  onToggleLock: () => void;
  onToggleHidden: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const t = useT();
  return (
    <div className="flex w-full flex-col gap-0.5">
      <div className="flex items-center gap-0.5">
        <Tooltip label={t("Monter la piste", "Move track up")}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={t("Monter la piste", "Move track up")}
            className="flex h-3 w-3 items-center justify-center rounded text-[8px] text-muted hover:text-ink disabled:opacity-30"
          >
            ▲
          </button>
        </Tooltip>
        <span className="truncate">{name}</span>
        <Tooltip label={t("Descendre la piste", "Move track down")}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={t("Descendre la piste", "Move track down")}
            className="flex h-3 w-3 items-center justify-center rounded text-[8px] text-muted hover:text-ink disabled:opacity-30"
          >
            ▼
          </button>
        </Tooltip>
      </div>
      <div className="flex gap-1">
        <Tooltip label={locked ? t("Déverrouiller la piste", "Unlock track") : t("Verrouiller la piste", "Lock track")}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleLock}
            aria-pressed={locked}
            aria-label={locked ? t("Déverrouiller la piste", "Unlock track") : t("Verrouiller la piste", "Lock track")}
            className={`flex h-3.5 w-3.5 items-center justify-center rounded text-[9px] ${locked ? "text-page" : "text-muted hover:text-ink"}`}
          >
            {locked ? "🔒" : "🔓"}
          </button>
        </Tooltip>
        <Tooltip label={hidden ? t("Réafficher la piste", "Show track") : t("Masquer la piste", "Hide track")}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleHidden}
            aria-pressed={hidden}
            aria-label={hidden ? t("Réafficher la piste", "Show track") : t("Masquer la piste", "Hide track")}
            className={`flex h-3.5 w-3.5 items-center justify-center rounded text-[9px] ${hidden ? "text-page" : "text-muted hover:text-ink"}`}
          >
            {hidden ? "🚫" : "👁"}
          </button>
        </Tooltip>
        <Tooltip label={t("Supprimer la piste (et son contenu)", "Delete track (and its content)")}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={t("Supprimer la piste", "Delete track")}
            className="flex h-3.5 w-3.5 items-center justify-center rounded text-[9px] text-muted hover:text-danger disabled:opacity-30"
          >
            🗑
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  text: "bg-primary-50 text-primary-700 border-primary-200",
  image: "bg-ai-visualbg text-ai-visual border-hair",
  shape: "bg-warning-50 text-warning-700 border-warning-200",
  audio: "bg-success-50 text-success-700 border-success-200",
};

// ── Forme d'onde des pistes son (audit Editing Bench, P2-6) ────────────────
// Un bandeau audio nu ne dit rien : où sont les silences ? le pic de voix ?
// Un aperçu grossier du signal (quelques dizaines de pics, pas un rendu
// exact) suffit à s'orienter d'un coup d'œil, comme dans tout éditeur audio.
//
// Le décodage (réseau + Web Audio) est risqué et hors du chemin critique : un
// média introuvable, un format que le navigateur ne sait pas décoder, ou une
// origine sans CORS ne doivent JAMAIS empêcher le reste de la timeline de
// fonctionner — silencieusement absent de bande plutôt qu'en erreur. Décodé
// UNE FOIS par (source, point d'entrée, durée) et mémorisé au niveau module :
// la lecture fait avancer la tête ~60 fois/s et re-rend chaque bloc à chaque
// tic, un nouveau décodage à chaque rendu serait rédhibitoire.
const WAVEFORM_BARS = 40;
const waveformCache = new Map<string, number[] | null>();
const waveformInflight = new Map<string, Promise<number[] | null>>();

function waveformKey(src: string, trimStart: number, length: number): string {
  return `${src}|${trimStart.toFixed(2)}|${length.toFixed(2)}`;
}

async function decodeWaveformPeaks(src: string, trimStart: number, length: number): Promise<number[] | null> {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const ctx = new Ctx();
    try {
      const audio = await ctx.decodeAudioData(bytes);
      const data = audio.getChannelData(0);
      const sr = audio.sampleRate;
      const from = Math.max(0, Math.floor(trimStart * sr));
      const to = Math.min(data.length, Math.ceil((trimStart + length) * sr));
      const span = Math.max(1, to - from);
      const bucket = Math.max(1, Math.floor(span / WAVEFORM_BARS));
      const peaks: number[] = [];
      for (let i = 0; i < WAVEFORM_BARS; i++) {
        const bStart = from + i * bucket;
        const bEnd = Math.min(to, bStart + bucket);
        let peak = 0;
        for (let j = bStart; j < bEnd; j++) peak = Math.max(peak, Math.abs(data[j]));
        peaks.push(peak);
      }
      return peaks;
    } finally {
      void ctx.close();
    }
  } catch {
    return null; // média inaccessible, hors CORS, ou codec non supporté.
  }
}

/** null tant que non décodé OU si le décodage a échoué — les deux se taisent. */
function useWaveformPeaks(src: string | undefined, trimStart: number, length: number): number[] | null {
  const key = src ? waveformKey(src, trimStart, length) : "";
  const [, bump] = useState(0);
  useEffect(() => {
    if (!src || waveformCache.has(key)) return;
    let cancelled = false;
    // Un plan dupliqué partage sa source : une seule requête pour les deux.
    let promise = waveformInflight.get(key);
    if (!promise) {
      promise = decodeWaveformPeaks(src, trimStart, length);
      waveformInflight.set(key, promise);
    }
    promise.then((peaks) => {
      waveformCache.set(key, peaks);
      waveformInflight.delete(key);
      if (!cancelled) bump((n) => n + 1);
    });
    return () => { cancelled = true; };
  }, [key, src, trimStart, length]);
  return src ? waveformCache.get(key) ?? null : null;
}

function WaveformBars({ peaks }: { peaks: number[] }) {
  return (
    <div className="pointer-events-none absolute inset-y-1.5 left-2 right-2 flex items-center gap-px opacity-70">
      {peaks.map((p, i) => (
        <span key={i} className="w-full min-w-px rounded-[1px] bg-current" style={{ height: `${Math.max(6, p * 100)}%` }} />
      ))}
    </div>
  );
}

function LayerBlock({
  label,
  start,
  length,
  lane,
  pxPerSec,
  tone,
  selected,
  muted,
  src,
  trimStart,
  onSelect,
  onContextMenu,
  onTrimStart,
  onMoveStart,
}: {
  label: string;
  start: number;
  length: number;
  /** Rangée au sein de la piste — calculée par le modèle. */
  lane: number;
  pxPerSec: number;
  tone: "text" | "image" | "shape" | "audio";
  selected: boolean;
  muted?: boolean;
  /** Piste son uniquement — source et point d'entrée pour la forme d'onde. */
  src?: string;
  trimStart?: number;
  onSelect: (e?: React.PointerEvent) => void;
  onContextMenu?: (e: { clientX: number; clientY: number }) => void;
  /** Rognage par une extrémité — même parité que les plans vidéo (C-04). */
  onTrimStart: (edge: "head" | "tail", e: React.PointerEvent) => void;
  onMoveStart: (e: React.PointerEvent) => void;
}) {
  const t = useT();
  const peaks = useWaveformPeaks(tone === "audio" ? src : undefined, trimStart ?? 0, length);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      onPointerDown={(e) => {
        e.stopPropagation();
        // Voir ClipBlock : le clic droit ne doit ni remplacer la sélection ni
        // démarrer un glisser, seulement ouvrir le menu contextuel.
        if (e.button === 2) return;
        onSelect(e);
        onMoveStart(e);
      }}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e);
      }}
      className={`absolute cursor-move overflow-hidden rounded-md border px-2 text-left text-[10px] ${TONE[tone]} ${
        selected ? "ring-2 ring-page/40" : ""
      } ${muted ? "opacity-40" : ""}`}
      style={{
        left: timeToPx(start, pxPerSec),
        width: Math.max(12, timeToPx(length, pxPerSec)),
        top: lane * LANE_H + 4,
        height: LANE_H - 8,
      }}
    >
      {peaks && <WaveformBars peaks={peaks} />}
      <span className="pointer-events-none relative block truncate">{muted ? "🔇 " : ""}{label}</span>
      <span
        role="separator"
        aria-label={t("Rogner le début", "Trim start")}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(e); onTrimStart("head", e); }}
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20"
      />
      <span
        role="separator"
        aria-label={t("Rogner la fin", "Trim end")}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(e); onTrimStart("tail", e); }}
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20"
      />
    </div>
  );
}
