"use client";

// Timeline multipiste — la VUE du document de projet.
//
// La timeline ne porte aucune logique de montage : elle affiche le document et
// émet des intentions. Rogner, scinder, déplacer sont des opérations pures du
// modèle (lib/editor/project.ts), déjà testées. Ce composant reste donc simple
// — c'est précisément l'intérêt d'avoir un document.

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
  const laneRef = useRef<HTMLDivElement>(null);

  /** Repères d'aimantation : bornes de plans, tête de lecture, zéro. */
  const marks = useMemo(() => {
    const m = [0, duration, playhead];
    for (const c of project.clips) m.push(c.start, c.start + c.length);
    return m;
  }, [project.clips, duration, playhead]);

  const drag = useRef<
    | { type: "trim"; clipId: string; edge: "head" | "tail"; startX: number }
    | { type: "move"; clipId: string; startX: number; fromIndex: number }
    | null
  >(null);

  const timeFromEvent = useCallback(
    (clientX: number): number => {
      const lane = laneRef.current;
      if (!lane) return 0;
      const rect = lane.getBoundingClientRect();
      const raw = (clientX - rect.left + lane.scrollLeft) / pxPerSec;
      return Math.max(0, Math.min(duration, raw));
    },
    [pxPerSec, duration]
  );

  function onLanePointerDown(e: React.PointerEvent) {
    // Un clic dans le vide déplace la tête de lecture et désélectionne.
    onSeek(snap(timeFromEvent(e.clientX), marks));
    onSelect(null);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const deltaSec = (e.clientX - d.startX) / pxPerSec;
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

  const width = Math.max(240, duration * pxPerSec);

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
        ref={laneRef}
        className="relative overflow-x-auto rounded-lg border border-hair bg-canvas/60 p-2"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div style={{ width }} className="space-y-1.5">
          {/* Graduation */}
          <Ruler duration={duration} pxPerSec={pxPerSec} />

          {/* Piste vidéo */}
          <Lane label={t("Vidéo", "Video")} onPointerDown={onLanePointerDown}>
            {project.clips.map((c, i) => (
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
            ))}
          </Lane>

          {/* Piste texte */}
          {project.texts.length > 0 && (
            <Lane label={t("Texte", "Text")} onPointerDown={onLanePointerDown}>
              {project.texts.map((l) => (
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
              ))}
            </Lane>
          )}

          {/* Piste incrustations */}
          {project.images.length > 0 && (
            <Lane label={t("Image", "Image")} onPointerDown={onLanePointerDown}>
              {project.images.map((l) => (
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
              ))}
            </Lane>
          )}

          {/* Piste audio */}
          {project.audios.length > 0 && (
            <Lane label={t("Audio", "Audio")} onPointerDown={onLanePointerDown}>
              {project.audios.map((a) => (
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
              ))}
            </Lane>
          )}
        </div>

        {/* Tête de lecture — au-dessus de toutes les pistes */}
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-danger-500"
          style={{ left: 8 + playhead * pxPerSec }}
          aria-hidden
        >
          <span className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-danger-500" />
        </div>
      </div>
    </div>
  );
}

/* ── Sous-composants ─────────────────────────────────────────────────────── */

function Ruler({ duration, pxPerSec }: { duration: number; pxPerSec: number }) {
  // Un repère par seconde tant que c'est lisible, sinon toutes les 5 ou 10 s.
  const step = pxPerSec >= 80 ? 1 : pxPerSec >= 40 ? 2 : pxPerSec >= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let s = 0; s <= Math.ceil(duration); s += step) ticks.push(s);
  return (
    <div className="relative h-4">
      {ticks.map((s) => (
        <span
          key={s}
          className="absolute top-0 border-l border-hair pl-1 text-[9px] leading-none text-muted"
          style={{ left: s * pxPerSec }}
        >
          {s}s
        </span>
      ))}
    </div>
  );
}

function Lane({
  label,
  children,
  onPointerDown,
}: {
  label: string;
  children: React.ReactNode;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[9px] uppercase tracking-wide text-muted">{label}</span>
      <div className="relative h-10 flex-1" onPointerDown={onPointerDown}>
        {children}
      </div>
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
      style={{ left: clip.start * pxPerSec, width: Math.max(12, clip.length * pxPerSec) }}
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
      style={{ left: start * pxPerSec, width: Math.max(12, length * pxPerSec) }}
    >
      <span className="block truncate">{muted ? "🔇 " : ""}{label}</span>
    </button>
  );
}
