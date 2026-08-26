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

import { useCallback, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  MIN_CLIP_SECONDS,
  projectDuration,
  type Clip,
  type EditorProject,
} from "@/lib/editor/project";

/** Niveaux de zoom, en pixels par seconde. */
const ZOOM_LEVELS = [10, 20, 40, 80, 160];

/** Aimantation : distance en secondes sous laquelle on colle à un repère. */
const SNAP_SECONDS = 0.15;

/** Hauteurs partagées par la colonne des libellés et par les pistes. */
const RULER_H = 20;
const LANE_H = 40;

export type TimelineSelection =
  | { kind: "clip"; id: string }
  | { kind: "text"; id: string }
  | { kind: "audio"; id: string }
  | { kind: "image"; id: string }
  | null;

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
  onSeek,
  onSelect,
  onTrim,
  onReorder,
}: {
  project: EditorProject;
  playhead: number;
  selection: TimelineSelection;
  onSeek: (time: number) => void;
  onSelect: (sel: TimelineSelection) => void;
  /** Rognage par une extrémité, en secondes (positif = raccourcit). */
  onTrim: (clipId: string, edge: "head" | "tail", delta: number) => void;
  onReorder: (clipId: string, toIndex: number) => void;
}) {
  const t = useT();
  const [zoomIdx, setZoomIdx] = useState(1);
  const pxPerSec = ZOOM_LEVELS[zoomIdx];
  const duration = projectDuration(project);
  /** Élément qui porte le temps : origine unique de toutes les coordonnées. */
  const timeRef = useRef<HTMLDivElement>(null);

  /** Repères d'aimantation : bornes de plans, tête de lecture, zéro. */
  const marks = useMemo(() => {
    const m = [0, duration, playhead];
    for (const c of project.clips) m.push(c.start, c.start + c.length);
    return m;
  }, [project.clips, duration, playhead]);

  const drag = useRef<
    | { type: "trim"; clipId: string; edge: "head" | "tail"; startX: number }
    | { type: "move"; clipId: string; startX: number; fromIndex: number }
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

  /** Démarre un balayage : la lecture suit le geste jusqu'au relâchement. */
  function startScrub(e: React.PointerEvent) {
    drag.current = { type: "scrub" };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    seekTo(e.clientX);
  }

  function onLanePointerDown(e: React.PointerEvent) {
    onSelect(null);
    startScrub(e);
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
    } else {
      // Déplacement : on change d'index dès que le curseur dépasse la moitié
      // du plan voisin — le geste reste prévisible.
      const width = project.clips[d.fromIndex]?.length ?? 1;
      const steps = Math.round(deltaSec / Math.max(width, 0.5));
      if (steps !== 0) {
        onReorder(d.clipId, Math.max(0, d.fromIndex + steps));
        drag.current = null;
      }
    }
  }

  function endDrag() {
    drag.current = null;
  }

  const width = Math.max(240, timeToPx(duration, pxPerSec));

  /** Pistes affichées — une seule source pour les libellés et les blocs. */
  const lanes: { key: string; label: string; blocks: React.ReactNode }[] = [
    {
      key: "video",
      label: t("Vidéo", "Video"),
      blocks: project.clips.map((c, i) => (
        <ClipBlock
          key={c.id}
          clip={c}
          pxPerSec={pxPerSec}
          selected={selection?.kind === "clip" && selection.id === c.id}
          onSelect={() => onSelect({ kind: "clip", id: c.id })}
          onTrimStart={(edge, e) => {
            drag.current = { type: "trim", clipId: c.id, edge, startX: e.clientX };
          }}
          onMoveStart={(e) => {
            drag.current = { type: "move", clipId: c.id, startX: e.clientX, fromIndex: i };
          }}
        />
      )),
    },
  ];

  if (project.texts.length > 0) {
    lanes.push({
      key: "text",
      label: t("Texte", "Text"),
      blocks: project.texts.map((l) => (
        <LayerBlock
          key={l.id}
          label={l.text.split("\n")[0] || t("Texte", "Text")}
          start={l.start}
          length={Math.max(MIN_CLIP_SECONDS, l.end - l.start)}
          pxPerSec={pxPerSec}
          tone="text"
          selected={selection?.kind === "text" && selection.id === l.id}
          onSelect={() => onSelect({ kind: "text", id: l.id })}
        />
      )),
    });
  }

  if (project.images.length > 0) {
    lanes.push({
      key: "image",
      label: t("Image", "Image"),
      blocks: project.images.map((l) => (
        <LayerBlock
          key={l.id}
          label={t("Incrustation", "Overlay")}
          start={l.start}
          length={Math.max(MIN_CLIP_SECONDS, l.end - l.start)}
          pxPerSec={pxPerSec}
          tone="image"
          selected={selection?.kind === "image" && selection.id === l.id}
          onSelect={() => onSelect({ kind: "image", id: l.id })}
        />
      )),
    });
  }

  if (project.audios.length > 0) {
    lanes.push({
      key: "audio",
      label: t("Audio", "Audio"),
      blocks: project.audios.map((a) => (
        <LayerBlock
          key={a.id}
          label={a.name}
          start={a.start}
          length={Math.max(MIN_CLIP_SECONDS, a.length)}
          pxPerSec={pxPerSec}
          tone="audio"
          muted={a.muted}
          selected={selection?.kind === "audio" && selection.id === a.id}
          onSelect={() => onSelect({ kind: "audio", id: a.id })}
        />
      )),
    });
  }

  return (
    <div className="space-y-2">
      {/* Barre d'outils : zoom + minutage */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs tabular-nums text-muted">
          {formatTime(playhead)} / {formatTime(duration)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
            disabled={zoomIdx === 0}
            aria-label={t("Dézoomer", "Zoom out")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink disabled:opacity-40"
          >
            −
          </button>
          <span className="w-14 text-center text-2xs text-muted">{pxPerSec} px/s</span>
          <button
            type="button"
            onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
            disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            aria-label={t("Zoomer", "Zoom in")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div
        className="flex gap-2 rounded-lg border border-hair bg-canvas/60 p-2"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {/* Colonne des libellés — HORS du flux temporel */}
        <div className="shrink-0 space-y-1.5">
          <div style={{ height: RULER_H }} />
          {lanes.map((l) => (
            <div
              key={l.key}
              style={{ height: LANE_H }}
              className="flex w-12 items-center text-[9px] uppercase tracking-wide text-muted"
            >
              {l.label}
            </div>
          ))}
        </div>

        {/* Zone du temps — origine unique de toutes les coordonnées */}
        <div className="relative flex-1 overflow-x-auto">
          <div ref={timeRef} style={{ width }} className="relative space-y-1.5">
            {/* Graduation : balayage direct, c'est la zone toujours disponible
                même quand les pistes sont pleines. */}
            <Ruler
              duration={duration}
              pxPerSec={pxPerSec}
              onScrub={startScrub}
              label={t("Se déplacer dans le film", "Scrub the film")}
            />

            {lanes.map((l) => (
              <div key={l.key} style={{ height: LANE_H }} className="relative" onPointerDown={onLanePointerDown}>
                {l.blocks}
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
  selected,
  onSelect,
  onTrimStart,
  onMoveStart,
}: {
  clip: Clip;
  pxPerSec: number;
  selected: boolean;
  onSelect: () => void;
  onTrimStart: (edge: "head" | "tail", e: React.PointerEvent) => void;
  onMoveStart: (e: React.PointerEvent) => void;
}) {
  const t = useT();
  return (
    <div
      className={`absolute inset-y-0 overflow-hidden rounded-md border text-[10px] ${
        selected ? "border-page ring-2 ring-page/40" : "border-hair"
      } ${clip.kind === "image" ? "bg-ai-visualbg" : "bg-ai-textbg"}`}
      style={{ left: timeToPx(clip.start, pxPerSec), width: Math.max(12, timeToPx(clip.length, pxPerSec)) }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
        onMoveStart(e);
      }}
    >
      <span className="pointer-events-none block truncate px-2 py-1 text-ink">
        {clip.kind === "image" ? "🖼" : "🎬"} {clip.length.toFixed(1)}s
        {clip.speed !== 1 && ` · ${clip.speed}×`}
      </span>
      {/* Poignées de rognage : une par extrémité. */}
      <span
        role="separator"
        aria-label={t("Rogner le début", "Trim start")}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(); onTrimStart("head", e); }}
        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-page/50 hover:bg-page"
      />
      <span
        role="separator"
        aria-label={t("Rogner la fin", "Trim end")}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(); onTrimStart("tail", e); }}
        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-page/50 hover:bg-page"
      />
    </div>
  );
}

const TONE: Record<string, string> = {
  text: "bg-primary-50 text-primary-700 border-primary-200",
  image: "bg-ai-visualbg text-ai-visual border-hair",
  audio: "bg-success-50 text-success-700 border-success-200",
};

function LayerBlock({
  label,
  start,
  length,
  pxPerSec,
  tone,
  selected,
  muted,
  onSelect,
}: {
  label: string;
  start: number;
  length: number;
  pxPerSec: number;
  tone: "text" | "image" | "audio";
  selected: boolean;
  muted?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onSelect}
      className={`absolute inset-y-1 overflow-hidden rounded-md border px-2 text-left text-[10px] ${TONE[tone]} ${
        selected ? "ring-2 ring-page/40" : ""
      } ${muted ? "opacity-40" : ""}`}
      style={{ left: timeToPx(start, pxPerSec), width: Math.max(12, timeToPx(length, pxPerSec)) }}
    >
      <span className="block truncate">{muted ? "🔇 " : ""}{label}</span>
    </button>
  );
}
