"use client";

// Aperçu du projet — lecteur contrôlé, avec son.
//
// L'ancien aperçu était en lecture automatique MUETTE, sans aucune commande :
// impossible de juger d'un contenu, de repérer un temps fort ou de synchroniser
// un texte avec une parole. Le `muted` était un contournement de la restriction
// des navigateurs sur l'autoplay ; la vraie réponse est de ne pas démarrer tout
// seul (audit A-03).
//
// L'aperçu lit le DOCUMENT : à chaque instant il affiche le plan courant et les
// calques dont les bornes couvrent cet instant. Ce qu'on voit ici est donc ce
// que le rendu produira — les deux lisent la même description.

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  clipAt,
  imagesAt,
  projectDuration,
  textsAt,
  type EditorProject,
  type TextLayer,
} from "@/lib/editor/project";
import { formatTime } from "./Timeline";

/**
 * Dessine les calques de texte visibles à un instant donné.
 * Partagée par l'aperçu et le rendu navigateur : c'est ce qui garantit que le
 * fichier exporté ressemble à ce qui était affiché.
 */
export function drawTexts(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  layers: TextLayer[]
): void {
  for (const o of layers) {
    const fontPx = Math.max(8, o.sizePct * H);
    ctx.font = `${o.bold ? "bold " : ""}${fontPx}px sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = o.align;
    const lines = o.text.split("\n");
    const x = o.x * W;
    let y = o.y * H;
    const lineH = fontPx * 1.25;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (o.bg) {
        const bx = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(bx - fontPx * 0.15, y - fontPx * 0.08, w + fontPx * 0.3, lineH);
      }
      if (o.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = fontPx * 0.12;
        ctx.shadowOffsetY = fontPx * 0.04;
      }
      if (o.outline) {
        ctx.lineWidth = Math.max(1, fontPx * 0.06);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(line, x, y);
      }
      ctx.fillStyle = o.color;
      ctx.fillText(line, x, y);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      y += lineH;
    }
  }
}

export function Preview({
  project,
  playhead,
  onSeek,
  onDragText,
  onDragImage,
}: {
  project: EditorProject;
  playhead: number;
  onSeek: (t: number) => void;
  /** Déplacement d'un calque texte à la souris (fraction de cadre). */
  onDragText?: (id: string, x: number, y: number) => void;
  /** Déplacement d'une incrustation à la souris (fraction de cadre). */
  onDragImage?: (id: string, x: number, y: number) => void;
}) {
  const t = useT();
  const duration = projectDuration(project);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTick = useRef<number>(0);

  const current = clipAt(project, playhead);
  const visibleTexts = textsAt(project, playhead);
  const visibleImages = imagesAt(project, playhead);

  // Avance la tête de lecture. On cadence sur `requestAnimationFrame` avec un
  // delta-time réel : la lecture reste juste même si une image est sautée.
  const step = useCallback(
    (ts: number) => {
      const dt = lastTick.current ? (ts - lastTick.current) / 1000 : 0;
      lastTick.current = ts;
      const next = playhead + dt;
      if (next >= duration) {
        setPlaying(false);
        onSeek(duration);
        return;
      }
      onSeek(next);
      rafRef.current = requestAnimationFrame(step);
    },
    [playhead, duration, onSeek]
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

  // Synchronise l'élément vidéo sur le plan courant et sa position source.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current || current.clip.kind !== "video") return;
    if (Math.abs(v.currentTime - current.sourceTime) > 0.25) {
      v.currentTime = current.sourceTime;
    }
    v.playbackRate = current.clip.speed;
    v.volume = volume;
    v.muted = muted || project.audios.some((a) => a.role === "original" && a.muted);
    if (playing && v.paused) void v.play().catch(() => setPlaying(false));
    if (!playing && !v.paused) v.pause();
  }, [current, playing, volume, muted, project.audios]);

  // Un seul mécanisme de déplacement, quel que soit le type de calque : c'est
  // la même intention — « place ça là » — et donc le même geste.
  const dragRef = useRef<
    { kind: "text" | "image"; id: string; ox: number; oy: number; sx: number; sy: number } | null
  >(null);

  function onLayerPointerDown(
    e: React.PointerEvent,
    kind: "text" | "image",
    l: { id: string; x: number; y: number }
  ) {
    if (kind === "text" ? !onDragText : !onDragImage) return;
    e.stopPropagation();
    dragRef.current = { kind, id: l.id, ox: l.x, oy: l.y, sx: e.clientX, sy: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const box = boxRef.current;
    if (!d || !box) return;
    const rect = box.getBoundingClientRect();
    const x = Math.min(0.98, Math.max(0, d.ox + (e.clientX - d.sx) / rect.width));
    const y = Math.min(0.98, Math.max(0, d.oy + (e.clientY - d.sy) / rect.height));
    if (d.kind === "text") onDragText?.(d.id, x, y);
    else onDragImage?.(d.id, x, y);
  }

  const aspect = project.format.replace(":", " / ");

  // Le cadrage de l'aperçu reprend celui du rendu : `cover` rogne autour du
  // point d'intérêt, `contain` montre tout. Sans cela, l'aperçu promettait un
  // cadrage que le fichier exporté ne tenait pas.
  const frame = current
    ? {
        className: current.clip.fit === "contain" ? "object-contain" : "object-cover",
        style: { objectPosition: `${current.clip.focusX * 100}% ${current.clip.focusY * 100}%` },
      }
    : { className: "object-contain", style: undefined };

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        onPointerMove={onPointerMove}
        onPointerUp={() => { dragRef.current = null; }}
        className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: aspect }}
      >
        {current?.clip.kind === "video" && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={current.clip.src}
            className={`h-full w-full ${frame.className}`}
            style={frame.style}
            playsInline
            preload="metadata"
          />
        )}
        {current?.clip.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.clip.src} alt="" className={`h-full w-full ${frame.className}`} style={frame.style} />
        )}
        {!current && (
          <p className="flex h-full items-center justify-center px-4 text-center text-2xs text-white/60">
            {t("Ajoutez un média pour commencer le montage.", "Add a media file to start editing.")}
          </p>
        )}

        {/* Incrustations — déplaçables comme les textes */}
        {visibleImages.map((l) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={l.id}
            src={l.src}
            alt=""
            onPointerDown={(e) => onLayerPointerDown(e, "image", l)}
            className={`absolute ${onDragImage ? "cursor-move" : "pointer-events-none"}`}
            style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.scale * 100}%`, opacity: l.opacity }}
          />
        ))}

        {/* Calques de texte — déplaçables à la souris */}
        {visibleTexts.map((l) => (
          <div
            key={l.id}
            onPointerDown={(e) => onLayerPointerDown(e, "text", l)}
            className={`absolute whitespace-pre leading-tight ${onDragText ? "cursor-move" : ""}`}
            style={{
              left: `${l.x * 100}%`,
              top: `${l.y * 100}%`,
              fontSize: `${l.sizePct * 100}cqh`,
              color: l.color,
              fontWeight: l.bold ? 700 : 400,
              textAlign: l.align,
              background: l.bg ? "rgba(0,0,0,0.5)" : "transparent",
              padding: l.bg ? "0 0.15em" : 0,
              textShadow: l.shadow ? "0 1px 3px rgba(0,0,0,0.6)" : undefined,
              WebkitTextStroke: l.outline ? "1px rgba(0,0,0,0.85)" : undefined,
              containerType: "size",
            }}
          >
            {l.text}
          </div>
        ))}
      </div>

      {/* Commandes de lecture — la lecture démarre sur ACTION, donc le son est
          autorisé par le navigateur (A-03). */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={duration === 0}
          aria-label={playing ? t("Pause", "Pause") : t("Lecture", "Play")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-page text-white disabled:opacity-40"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.05}
          value={playhead}
          onChange={(e) => { setPlaying(false); onSeek(Number(e.target.value)); }}
          aria-label={t("Position de lecture", "Playback position")}
          className="flex-1 accent-page"
        />
        <span className="w-20 shrink-0 text-right text-2xs tabular-nums text-muted">
          {formatTime(playhead)} / {formatTime(duration)}
        </span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? t("Réactiver le son", "Unmute") : t("Couper le son", "Mute")}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink"
        >
          {muted ? "🔇" : "🔊"}
        </button>
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
