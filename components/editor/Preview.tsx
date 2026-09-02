"use client";

// Zone de travail — aperçu contrôlé, sonore et manipulable.
//
// TROIS DÉFAUTS D'ORIGINE, UNE MÊME CAUSE
// L'aperçu était une vignette de 320 pixels de large, sans zoom, qui ne pilotait
// que l'élément vidéo. Positionner finement un logo y était impraticable, les
// pistes son ajoutées restaient muettes jusqu'à l'export, et rien ne permettait
// de redimensionner ou de faire pivoter un calque. La cause commune : l'aperçu
// était traité comme une IMAGE de contrôle, pas comme un plan de travail.
//
// Ici, la scène est rendue à la définition NATIVE du format et mise à l'échelle
// par une transformation. Toutes les positions restent donc exprimées dans les
// pixels du fichier final : ce qu'on voit et ce qu'on exporte partagent le même
// repère, à un facteur d'échelle près.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  clipsAt,
  FORMAT_SIZE,
  imagesAt,
  layerProgress,
  projectDuration,
  shapesAt,
  textsAt,
  type EditorProject,
  type ImageLayer,
  type ShapeLayer,
  type TextLayer,
  type VisualLayer,
} from "@/lib/editor/project";
import { fontStack } from "@/lib/editor/draw";
import { formatTime, type TimelineSelection } from "./Timeline";
import { Tooltip } from "./Tooltip";

/** Distance d'aimantation, en fraction du cadre. */
const SNAP = 0.012;

export type LayerPatch = Partial<Pick<VisualLayer, "x" | "y" | "rotation">> & {
  w?: number;
  h?: number;
};

/** Repères d'alignement : centres, bords, marges. */
const GUIDES_X = [0, 0.05, 0.5, 0.95, 1];
const GUIDES_Y = [0, 0.05, 0.5, 0.95, 1];

function snapTo(value: number, guides: number[]): { value: number; hit: number | null } {
  for (const g of guides) {
    if (Math.abs(value - g) < SNAP) return { value: g, hit: g };
  }
  return { value, hit: null };
}

export function Preview({
  project,
  playhead,
  selection,
  playing,
  onPlayingChange,
  onSeek,
  onSelect,
  onLayerChange,
  onTextEdit,
  onDragStart,
  onDragEnd,
}: {
  project: EditorProject;
  playhead: number;
  selection: TimelineSelection;
  /**
   * État de lecture — remonté au niveau de l'éditeur plutôt que local à
   * l'aperçu, pour que la barre d'espace (itération 3, C-05) puisse la piloter
   * depuis l'en-tête, la timeline ou n'importe où dans l'éditeur.
   */
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onSeek: (t: number) => void;
  onSelect: (sel: TimelineSelection) => void;
  /** Manipulation directe d'un calque dans la zone de travail. */
  onLayerChange?: (sel: NonNullable<TimelineSelection>, patch: LayerPatch) => void;
  /** Double-clic sur un texte : édition du contenu au fil de l'eau, à même
      l'aperçu — attendu d'un banc de montage même basique (chapitre 8.1). */
  onTextEdit?: (id: string, text: string) => void;
  /** Début / fin d'un geste continu (glisser, redimensionner, pivoter) — une
      seule entrée d'historique par geste plutôt qu'une par pixel parcouru. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const t = useT();
  const duration = projectDuration(project);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  /** Édition d'un texte au double-clic — voir la textarea superposée plus bas. */
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  const frame = FORMAT_SIZE[project.format];
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 320, h: 480 });
  const rafRef = useRef<number | null>(null);
  const lastTick = useRef<number>(0);

  const active = clipsAt(project, playhead);
  const visibleTexts = textsAt(project, playhead);
  const visibleImages = imagesAt(project, playhead);
  const visibleShapes = shapesAt(project, playhead);

  /* ── Mise à l'échelle ──────────────────────────────────────────────────── */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Échelle d'ajustement : la scène entière tient dans l'espace disponible. */
  const fitScale = useMemo(
    () => Math.min(box.w / frame.width, box.h / frame.height) || 0.1,
    [box.w, box.h, frame.width, frame.height]
  );
  const scale = fitScale * zoom;

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);
  useEffect(() => { resetView(); }, [project.format, resetView]);

  /**
   * Molette sur l'aperçu — zoom ancré sur le curseur (itération 3, §4.2).
   *
   * DEUX DÉFAUTS CUMULÉS DANS LA VERSION PRÉCÉDENTE
   * `onWheel` React est un gestionnaire SYNTHÉTIQUE : React attache l'écouteur
   * de molette natif en mode passif au niveau racine, et un `preventDefault()`
   * y est silencieusement ignoré par le navigateur. Ajouter l'appel n'aurait
   * donc rien changé — la page continuait de défiler PENDANT le zoom. Il faut
   * un écouteur natif non passif, posé directement sur l'élément.
   *
   * Un ref tient toujours l'état courant : l'écouteur n'est posé qu'UNE fois au
   * montage, sans se raccrocher à chaque frappe de molette.
   */
  const latest = useRef({ zoom, pan, box, frame, fitScale });
  latest.current = { zoom, pan, box, frame, fitScale };

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    function onWheelNative(e: WheelEvent) {
      // Empêche systématiquement le défilement de la page ET le zoom du
      // navigateur (Ctrl+molette / pincement) : la molette n'agit ICI que sur
      // l'aperçu, jamais ailleurs.
      e.preventDefault();
      const { zoom: z, pan: p, box: b, frame: f, fitScale: fs } = latest.current;
      const rect = el!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const scale = fs * z;
      const stageW = f.width * scale;
      const stageH = f.height * scale;
      const stageLeft = b.w / 2 - stageW / 2 + p.x;
      const stageTop = b.h / 2 - stageH / 2 + p.y;
      // Point du contenu (en pixels de cadre, non mis à l'échelle) sous le
      // curseur : c'est CE point qui doit rester sous le curseur après le zoom.
      const contentX = (cx - stageLeft) / scale;
      const contentY = (cy - stageTop) / scale;

      const nextZoom = Math.min(6, Math.max(0.25, z * (e.deltaY < 0 ? 1.12 : 0.89)));
      const nextScale = fs * nextZoom;
      const nextStageW = f.width * nextScale;
      const nextStageH = f.height * nextScale;
      const nextStageLeft = cx - contentX * nextScale;
      const nextStageTop = cy - contentY * nextScale;

      setZoom(nextZoom);
      setPan({
        x: nextStageLeft - b.w / 2 + nextStageW / 2,
        y: nextStageTop - b.h / 2 + nextStageH / 2,
      });
    }
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  /* ── Lecture ───────────────────────────────────────────────────────────── */
  const step = useCallback(
    (ts: number) => {
      const dt = lastTick.current ? (ts - lastTick.current) / 1000 : 0;
      lastTick.current = ts;
      const next = playhead + dt;
      if (next >= duration) {
        onPlayingChange(false);
        onSeek(duration);
        return;
      }
      onSeek(next);
      rafRef.current = requestAnimationFrame(step);
    },
    [playhead, duration, onSeek, onPlayingChange]
  );

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTick.current = 0;
      return;
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, step]);

  /* ── Vidéos : une par piste active ─────────────────────────────────────── */
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const originalMuted = project.audios.some((a) => a.role === "original" && a.muted);

  useEffect(() => {
    for (const { clip, sourceTime, frozen } of active) {
      const v = videoRefs.current.get(clip.id);
      if (!v || clip.kind !== "video") continue;
      // Plan SORTANT pendant un fondu : figé sur sa dernière image, jamais
      // relancé — la lecture normale reprendrait depuis ce point au lieu de
      // rester immobile pendant que l'opacité descend (P0-2).
      if (frozen) {
        if (Math.abs(v.currentTime - sourceTime) > 0.05) v.currentTime = sourceTime;
        if (!v.paused) v.pause();
        continue;
      }
      if (Math.abs(v.currentTime - sourceTime) > 0.25) v.currentTime = sourceTime;
      v.playbackRate = clip.speed;
      v.volume = volume;
      // Seule la piste de base porte le son d'origine : superposer deux bandes
      // son de plans différents produirait une bouillie.
      v.muted = muted || originalMuted || clip.track !== 0;
      if (playing && v.paused) void v.play().catch(() => onPlayingChange(false));
      if (!playing && !v.paused) v.pause();
    }
  }, [active, playing, volume, muted, originalMuted, onPlayingChange]);

  /* ── Pistes son ajoutées ───────────────────────────────────────────────── */
  // L'aperçu ne pilotait QUE l'élément vidéo : volume, rognage et fondus se
  // réglaient à l'aveugle, leur effet n'apparaissant qu'après un export complet.
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  useEffect(() => {
    for (const a of project.audios) {
      if (a.role === "original") continue;
      const el = audioRefs.current.get(a.id);
      if (!el) continue;

      const inside = playhead >= a.start && playhead < a.start + a.length;
      if (!inside || a.muted || muted) {
        if (!el.paused) el.pause();
        continue;
      }
      const sourceTime = a.trimStart + (playhead - a.start);
      if (Math.abs(el.currentTime - sourceTime) > 0.25) el.currentTime = sourceTime;

      // Le fondu est appliqué ICI aussi : c'est la seule façon d'entendre le
      // mixage avant l'export, et donc de le régler.
      const sinceStart = playhead - a.start;
      const untilEnd = a.start + a.length - playhead;
      const fadeIn = a.fadeIn > 0 ? Math.min(1, sinceStart / a.fadeIn) : 1;
      const fadeOut = a.fadeOut > 0 ? Math.min(1, untilEnd / a.fadeOut) : 1;
      el.volume = Math.max(0, Math.min(1, a.volume * volume * fadeIn * fadeOut));

      if (playing && el.paused) void el.play().catch(() => {});
      if (!playing && !el.paused) el.pause();
    }
  }, [project.audios, playhead, playing, volume, muted]);

  /* ── Manipulation directe ──────────────────────────────────────────────── */
  const drag = useRef<
    | { mode: "move"; sel: NonNullable<TimelineSelection>; ox: number; oy: number; sx: number; sy: number }
    | { mode: "resize"; sel: NonNullable<TimelineSelection>; ow: number; oh: number; sx: number; sy: number }
    | { mode: "rotate"; sel: NonNullable<TimelineSelection>; cx: number; cy: number; base: number; or: number }
    | { mode: "pan"; sx: number; sy: number; ox: number; oy: number }
    | null
  >(null);

  function startMove(e: React.PointerEvent, sel: NonNullable<TimelineSelection>, l: { x: number; y: number }) {
    if (!onLayerChange) return;
    e.stopPropagation();
    onSelect(sel);
    onDragStart?.();
    drag.current = { mode: "move", sel, ox: l.x, oy: l.y, sx: e.clientX, sy: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pan") {
      setPan({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
      return;
    }
    if (!onLayerChange) return;
    if (d.mode === "rotate") {
      const angle = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI;
      const next = Math.round(d.or + (angle - d.base));
      // Multiples de 15° à portée de main : les angles ronds sont les plus
      // demandés, et viser au degré près à la souris est illusoire.
      onLayerChange(d.sel, { rotation: Math.abs(next % 15) < 4 ? Math.round(next / 15) * 15 : next });
      return;
    }

    const dx = (e.clientX - d.sx) / (frame.width * scale);
    const dy = (e.clientY - d.sy) / (frame.height * scale);

    if (d.mode === "move") {
      // Aimantation sur les centres, les bords et les marges — avec un repère
      // visuel, faute de quoi l'utilisateur ne sait pas pourquoi ça « colle ».
      const sx = snapTo(d.ox + dx, GUIDES_X);
      const sy = snapTo(d.oy + dy, GUIDES_Y);
      setGuides({ x: sx.hit, y: sy.hit });
      onLayerChange(d.sel, { x: sx.value, y: sy.value });
      return;
    }
    if (d.mode === "resize") {
      onLayerChange(d.sel, {
        w: Math.max(0.02, d.ow + dx),
        h: d.oh > 0 ? Math.max(0.01, d.oh + dy) : undefined,
      });
    }
  }

  function endDrag() {
    // Referme le geste ouvert par startMove/onResizeStart/onRotateStart —
    // jamais un simple panoramique de la vue, qui ne touche pas au projet.
    if (drag.current && drag.current.mode !== "pan") onDragEnd?.();
    drag.current = null;
    setGuides({ x: null, y: null });
  }

  const stageW = frame.width * scale;
  const stageH = frame.height * scale;

  /** Style commun d'un calque : position, rotation, opacité, animation. */
  function layerStyle(l: VisualLayer, extra: React.CSSProperties = {}): React.CSSProperties {
    const anim = layerProgress(l, playhead);
    return {
      position: "absolute",
      left: `${(l.x + anim.offsetX) * frame.width}px`,
      top: `${(l.y + anim.offsetY) * frame.height}px`,
      opacity: anim.opacity,
      transform: `rotate(${l.rotation}deg) scale(${anim.scale})`,
      transformOrigin: "center",
      ...extra,
    };
  }

  const selectedId = selection?.id;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Scène */}
      <div
        ref={boxRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerDown={(e) => {
          // Clic dans le vide : on désélectionne, ou on déplace la vue si
          // l'utilisateur a zoomé au-delà de l'espace disponible.
          if (zoom > 1) {
            drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
          } else {
            onSelect(null);
          }
        }}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black/90"
      >
        <div
          style={{
            width: stageW,
            height: stageH,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
          className="relative shrink-0"
        >
          <div
            style={{
              width: frame.width,
              height: frame.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="absolute left-0 top-0 overflow-hidden bg-black"
          >
            {/* Plans, de la piste de base vers le dessus. `opacity` compose le
                fondu enchaîné entre le plan sortant et le plan entrant — sans
                elle, une transition ne se voyait jamais avant l'export
                (audit Editing Bench, P0-2). Le cadre (x, y, w, h) borne la
                zone dans laquelle `fit`/`focusX`/`focusY` recadrent la
                source — plein cadre par défaut, réduit pour une incrustation
                posée en fenêtre plutôt qu'en plein écran (P2-1). Seule une
                piste d'incrustation (track > 0) se glisse : la piste de base
                reste plein cadre, il n'y a rien à y déplacer. */}
            {active.map(({ clip, opacity }) => {
              const box: React.CSSProperties = {
                position: "absolute",
                left: clip.x * frame.width,
                top: clip.y * frame.height,
                width: clip.w * frame.width,
                height: clip.h * frame.height,
                objectPosition: `${clip.focusX * 100}% ${clip.focusY * 100}%`,
                opacity,
              };
              const fitClass = clip.fit === "contain" ? "object-contain" : "object-cover";
              const movable = clip.track > 0 && Boolean(onLayerChange);
              return clip.kind === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  key={clip.id}
                  ref={(el) => { if (el) videoRefs.current.set(clip.id, el); }}
                  src={clip.src}
                  playsInline
                  preload="metadata"
                  onPointerDown={movable ? (e) => startMove(e, { kind: "clip", id: clip.id }, clip) : undefined}
                  style={box}
                  className={`h-full w-full ${fitClass} ${movable ? "cursor-move" : ""} ${
                    selectedId === clip.id && movable ? "outline outline-[3px] outline-page" : ""
                  }`}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={clip.id}
                  src={clip.src}
                  alt=""
                  draggable={false}
                  onPointerDown={movable ? (e) => startMove(e, { kind: "clip", id: clip.id }, clip) : undefined}
                  style={box}
                  className={`h-full w-full ${fitClass} ${movable ? "cursor-move" : ""} ${
                    selectedId === clip.id && movable ? "outline outline-[3px] outline-page" : ""
                  }`}
                />
              );
            })}

            {active.length === 0 && (
              <p className="flex h-full items-center justify-center px-8 text-center text-white/60"
                 style={{ fontSize: frame.height * 0.025 }}>
                {t("Ajoutez un média pour commencer le montage.", "Add a media file to start editing.")}
              </p>
            )}

            {/* Formes */}
            {visibleShapes.map((l) => (
              <ShapeView
                key={l.id}
                layer={l}
                frame={frame}
                style={layerStyle(l, { width: l.w * frame.width, height: l.h * frame.height })}
                selected={selectedId === l.id}
                onPointerDown={(e) => startMove(e, { kind: "shape", id: l.id }, l)}
              />
            ))}

            {/* Incrustations */}
            {visibleImages.map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={l.id}
                src={l.src}
                alt=""
                // Un <img> est GLISSABLE nativement par le navigateur, à la
                // différence d'un <div> de texte : sans draggable={false}, le
                // premier mouvement de souris faisait basculer le geste sur le
                // glisser-déposer natif du navigateur (fantôme d'image, aucun
                // pointermove supplémentaire) au lieu de continuer à alimenter
                // startMove/onPointerMove — vérifié en isolant la différence de
                // comportement texte vs image, geste identique (Playwright,
                // audit Editing Bench, P1-5 : « glissement → texte oui, image
                // non »).
                draggable={false}
                onPointerDown={(e) => startMove(e, { kind: "image", id: l.id }, l)}
                style={layerStyle(l, {
                  width: l.scale * frame.width,
                  height: l.heightPct > 0 ? l.heightPct * frame.height : undefined,
                })}
                className={`${onLayerChange ? "cursor-move" : "pointer-events-none"} ${
                  selectedId === l.id ? "outline outline-[3px] outline-page" : ""
                }`}
              />
            ))}

            {/* Textes */}
            {visibleTexts.map((l) =>
              editingTextId === l.id ? (
                // Édition au double-clic — attendu d'un banc de montage même
                // basique (chapitre 8.1) : pas besoin de rouvrir le panneau de
                // propriétés pour corriger une faute de frappe.
                <textarea
                  key={l.id}
                  autoFocus
                  value={draftText}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setDraftText(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={() => { onTextEdit?.(l.id, draftText); setEditingTextId(null); }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
                    else if (e.key === "Escape") { e.preventDefault(); setEditingTextId(null); }
                  }}
                  style={layerStyle(l, {
                    fontSize: `${l.sizePct * frame.height}px`,
                    fontFamily: fontStack(l.font),
                    color: l.color,
                    fontWeight: l.bold ? 700 : 400,
                    textAlign: l.align,
                    lineHeight: l.lineHeight,
                    width: l.wrapPct > 0 ? l.wrapPct * frame.width : `${Math.max(4, draftText.length)}ch`,
                    background: "rgba(0,0,0,0.55)",
                    padding: "0 0.15em",
                    border: "1px dashed rgba(255,255,255,0.6)",
                    resize: "none",
                    outline: "none",
                  })}
                  className="min-h-[1.4em]"
                />
              ) : (
                <div
                  key={l.id}
                  onPointerDown={(e) => startMove(e, { kind: "text", id: l.id }, l)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelect({ kind: "text", id: l.id });
                    setDraftText(l.text);
                    setEditingTextId(l.id);
                  }}
                  style={layerStyle(l, {
                    fontSize: `${l.sizePct * frame.height}px`,
                    fontFamily: fontStack(l.font),
                    color: l.color,
                    fontWeight: l.bold ? 700 : 400,
                    textAlign: l.align,
                    lineHeight: l.lineHeight,
                    width: l.wrapPct > 0 ? l.wrapPct * frame.width : undefined,
                    whiteSpace: l.wrapPct > 0 ? "pre-wrap" : "pre",
                    background: l.bg ? "rgba(0,0,0,0.5)" : "transparent",
                    padding: l.bg ? "0 0.15em" : 0,
                    textShadow: l.shadow ? "0 1px 3px rgba(0,0,0,0.6)" : undefined,
                    WebkitTextStroke: l.outline ? `${l.sizePct * frame.height * 0.06}px rgba(0,0,0,0.85)` : undefined,
                  })}
                  className={`${onLayerChange ? "cursor-move" : ""} ${
                    selectedId === l.id ? "outline outline-[3px] outline-page" : ""
                  }`}
                >
                  {l.text}
                </div>
              )
            )}

            {/* Repères d'alignement */}
            {guides.x !== null && (
              <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-ai-visual"
                   style={{ left: guides.x * frame.width }} />
            )}
            {guides.y !== null && (
              <div className="pointer-events-none absolute inset-x-0 h-[2px] bg-ai-visual"
                   style={{ top: guides.y * frame.height }} />
            )}
          </div>

          {/* Poignées — hors de la mise à l'échelle pour rester saisissables */}
          {onLayerChange && selection && (
            <Handles
              project={project}
              selection={selection}
              scale={scale}
              frame={frame}
              onResizeStart={(e, sel, ow, oh) => {
                e.stopPropagation();
                onDragStart?.();
                drag.current = { mode: "resize", sel, ow, oh, sx: e.clientX, sy: e.clientY };
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onRotateStart={(e, sel, cx, cy, or) => {
                e.stopPropagation();
                onDragStart?.();
                const base = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
                drag.current = { mode: "rotate", sel, cx, cy, base, or };
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
            />
          )}
        </div>

        {/* Zoom */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-1">
          <Tooltip label={t("Dézoomer l'aperçu — molette", "Zoom out preview — wheel")}>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z * 0.8))}
              aria-label={t("Dézoomer l'aperçu", "Zoom out preview")}
              className="h-5 w-5 rounded text-xs text-white/80 hover:text-white">−</button>
          </Tooltip>
          <Tooltip label={t("Ajuster à la fenêtre", "Fit to window")}>
            <button type="button" onClick={resetView}
              className="min-w-[3rem] text-center text-2xs tabular-nums text-white/80 hover:text-white">
              {Math.round(zoom * 100)}%
            </button>
          </Tooltip>
          <Tooltip label={t("Zoomer l'aperçu — molette", "Zoom in preview — wheel")}>
            <button type="button" onClick={() => setZoom((z) => Math.min(6, z * 1.25))}
              aria-label={t("Zoomer l'aperçu", "Zoom in preview")}
              className="h-5 w-5 rounded text-xs text-white/80 hover:text-white">+</button>
          </Tooltip>
        </div>
      </div>

      {/* Éléments sonores — invisibles, pilotés par la tête de lecture */}
      {project.audios.filter((a) => a.role !== "original").map((a) => (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio key={a.id} ref={(el) => { if (el) audioRefs.current.set(a.id, el); }} src={a.src} preload="metadata" className="hidden" />
      ))}

      {/* Commandes de lecture — la lecture démarre sur ACTION, donc le son est
          autorisé par le navigateur (A-03). */}
      <div className="flex shrink-0 items-center gap-2">
        <Tooltip label={playing ? t("Pause — Espace", "Pause — Space") : t("Lecture — Espace", "Play — Space")}>
          <button
            type="button"
            onClick={() => onPlayingChange(!playing)}
            disabled={duration === 0}
            aria-label={playing ? t("Pause", "Pause") : t("Lecture", "Play")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-page text-white disabled:opacity-40"
          >
            {playing ? "❚❚" : "▶"}
          </button>
        </Tooltip>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.05}
          value={playhead}
          onChange={(e) => { onPlayingChange(false); onSeek(Number(e.target.value)); }}
          aria-label={t("Position de lecture", "Playback position")}
          className="flex-1 accent-page"
        />
        <span className="w-20 shrink-0 text-right text-2xs tabular-nums text-muted">
          {formatTime(playhead)} / {formatTime(duration)}
        </span>
        <Tooltip label={muted ? t("Réactiver le son", "Unmute") : t("Couper le son", "Mute")}>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? t("Réactiver le son", "Unmute") : t("Couper le son", "Mute")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </Tooltip>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label={t("Volume", "Volume")}
          className="w-16 accent-page"
        />
      </div>
    </div>
  );
}

/* ── Sous-composants ─────────────────────────────────────────────────────── */

function ShapeView({
  layer,
  frame,
  style,
  selected,
  onPointerDown,
}: {
  layer: ShapeLayer;
  frame: { width: number; height: number };
  style: React.CSSProperties;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const w = layer.w * frame.width;
  const h = layer.h * frame.height;
  const common: React.CSSProperties = {
    ...style,
    background: layer.shape === "arrow" ? "transparent" : layer.fill,
    border: layer.strokeWidth > 0 ? `${layer.strokeWidth * frame.width}px solid ${layer.stroke}` : undefined,
    borderRadius:
      layer.shape === "ellipse" ? "50%" : layer.shape === "round" ? `${layer.radius * frame.width}px` : 0,
  };

  if (layer.shape === "arrow") {
    // La flèche est un tracé : la reproduire en CSS donnerait une forme
    // différente de celle du rendu, qui la dessine au canevas.
    const head = Math.min(w * 0.3, h * 2.2);
    const shaft = h * 0.35;
    return (
      <svg
        onPointerDown={onPointerDown}
        style={{ ...style, width: w, height: h }}
        viewBox={`0 0 ${w} ${h}`}
        className={`cursor-move ${selected ? "outline outline-[3px] outline-page" : ""}`}
      >
        <polygon
          fill={layer.fill}
          points={`0,${h / 2 - shaft / 2} ${w - head},${h / 2 - shaft / 2} ${w - head},0 ${w},${h / 2} ${w - head},${h} ${w - head},${h / 2 + shaft / 2} 0,${h / 2 + shaft / 2}`}
        />
      </svg>
    );
  }

  return (
    <div
      onPointerDown={onPointerDown}
      style={common}
      className={`cursor-move ${selected ? "outline outline-[3px] outline-page" : ""}`}
    />
  );
}

/** Poignées de redimensionnement et de rotation du calque sélectionné. */
function Handles({
  project,
  selection,
  scale,
  frame,
  onResizeStart,
  onRotateStart,
}: {
  project: EditorProject;
  selection: NonNullable<TimelineSelection>;
  scale: number;
  frame: { width: number; height: number };
  onResizeStart: (e: React.PointerEvent, sel: NonNullable<TimelineSelection>, ow: number, oh: number) => void;
  onRotateStart: (e: React.PointerEvent, sel: NonNullable<TimelineSelection>, cx: number, cy: number, or: number) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  const found = ((): { x: number; y: number; rotation: number; canRotate: boolean; w: number; h: number } | null => {
    if (selection.kind === "text") {
      const l = project.texts.find((x) => x.id === selection.id);
      // Un texte n'a pas de largeur propre tant qu'il n'a pas de retour à la
      // ligne : la poignée agit alors sur la largeur de retour.
      return l ? { x: l.x, y: l.y, rotation: l.rotation, canRotate: true, w: l.wrapPct || 0.4, h: 0 } : null;
    }
    if (selection.kind === "image") {
      const l = project.images.find((x) => x.id === selection.id);
      return l ? { x: l.x, y: l.y, rotation: l.rotation, canRotate: true, w: l.scale, h: l.heightPct } : null;
    }
    if (selection.kind === "shape") {
      const l = project.shapes.find((x) => x.id === selection.id) as ShapeLayer | undefined;
      return l ? { x: l.x, y: l.y, rotation: l.rotation, canRotate: true, w: l.w, h: l.h } : null;
    }
    if (selection.kind === "clip") {
      const c = project.clips.find((x) => x.id === selection.id);
      // Piste de base : rien à déplacer, elle occupe toujours tout le cadre.
      if (!c || c.track === 0) return null;
      // Pas de rotation sur un plan — champ que `Clip` n'a délibérément pas
      // reçu, faute de savoir ce qu'une rotation de vidéo signifie pour le
      // moteur de rendu serveur (P2-1, restreint à position et taille).
      return { x: c.x, y: c.y, rotation: 0, canRotate: false, w: c.w, h: c.h };
    }
    return null;
  })();

  if (!found) return null;
  const { x, y, rotation, canRotate, w, h } = found;
  const left = x * frame.width * scale;
  const top = y * frame.height * scale;
  const width = w * frame.width * scale;
  const height = (h > 0 ? h * frame.height : 40) * scale;

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute"
      style={{ left, top, width, height, transform: `rotate(${rotation}deg)`, transformOrigin: "center" }}
    >
      <span
        role="separator"
        aria-label={t("Redimensionner", "Resize")}
        onPointerDown={(e) => onResizeStart(e, selection, w, h)}
        className="pointer-events-auto absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm bg-page ring-2 ring-white"
      />
      {canRotate && (
        <span
          role="separator"
          aria-label={t("Pivoter", "Rotate")}
          onPointerDown={(e) => {
            const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
            onRotateStart(e, selection, r.left + r.width / 2, r.top + r.height / 2, rotation);
          }}
          className="pointer-events-auto absolute -top-5 left-1/2 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full bg-ai-visual ring-2 ring-white"
        />
      )}
    </div>
  );
}

export type { TextLayer, ImageLayer };
