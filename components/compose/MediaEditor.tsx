"use client";

/**
 * Mini-studio type CapCut (éditeur overlay) :
 *  - ajout de blocs de texte positionnables (drag) et stylés sur une PHOTO ou une VIDÉO
 *  - ajout d'une musique de fond pour la vidéo (+ option garder le son original)
 *  - export du fichier final :
 *      • photo  → compositing canvas (PNG)
 *      • vidéo  → ffmpeg.wasm (filtre overlay + audio), 100% navigateur
 *
 * Le texte est rendu une seule fois via canvas : application directe sur la
 * photo, ou export d'un PNG transparent superposé à la vidéo (filtre `overlay`,
 * toujours disponible — plus fiable que `drawtext`).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { UploadedMedia } from "@/components/ui/MediaUpload";

interface TextOverlay {
  id: string;
  text: string;
  xPct: number; // position du coin haut-gauche, 0..1
  yPct: number;
  sizePct: number; // taille de police en fraction de la hauteur du média
  color: string; // hex #rrggbb
  bold: boolean;
  bg: boolean; // bandeau semi-transparent derrière le texte
}

const PRESET_COLORS = ["#ffffff", "#000000", "#ff3b30", "#ffcc00", "#34c759", "#0a84ff"];

/** Dessine les overlays texte sur un contexte canvas à la résolution (W,H). */
function drawOverlays(ctx: CanvasRenderingContext2D, W: number, H: number, overlays: TextOverlay[]) {
  for (const o of overlays) {
    const fontPx = Math.max(8, o.sizePct * H);
    ctx.font = `${o.bold ? "bold " : ""}${fontPx}px sans-serif`;
    ctx.textBaseline = "top";
    const lines = o.text.split("\n");
    const x = o.xPct * W;
    let y = o.yPct * H;
    const lineH = fontPx * 1.25;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (o.bg) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x - fontPx * 0.15, y - fontPx * 0.08, w + fontPx * 0.3, lineH);
      }
      ctx.fillStyle = o.color;
      ctx.fillText(line, x, y);
      y += lineH;
    }
  }
}

export function MediaEditor({
  media,
  onExport,
  onClose,
}: {
  media: UploadedMedia;
  onExport: (m: UploadedMedia) => void;
  onClose: () => void;
}) {
  const t = useT();
  const isVideo = media.kind === "video";

  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [boxW, setBoxW] = useState(320);
  const [music, setMusic] = useState<File | null>(null);
  const [keepAudio, setKeepAudio] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number } | null>(null);

  // Mesure la largeur d'affichage de la zone d'aperçu (pour la taille des textes).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const boxH = nat ? (boxW * nat.h) / nat.w : boxW;

  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  function addText() {
    const id = `t-${Date.now()}`;
    setOverlays((o) => [
      ...o,
      { id, text: t("Votre texte", "Your text"), xPct: 0.1, yPct: 0.1, sizePct: 0.08, color: "#ffffff", bold: true, bg: true },
    ]);
    setSelectedId(id);
  }

  function updateSel(patch: Partial<TextOverlay>) {
    if (!selectedId) return;
    setOverlays((o) => o.map((x) => (x.id === selectedId ? { ...x, ...patch } : x)));
  }

  function removeSel() {
    if (!selectedId) return;
    setOverlays((o) => o.filter((x) => x.id !== selectedId));
    setSelectedId(null);
  }

  // ── Drag des overlays ────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent, o: TextOverlay) {
    e.stopPropagation();
    setSelectedId(o.id);
    dragRef.current = { id: o.id, startX: e.clientX, startY: e.clientY, ox: o.xPct, oy: o.yPct };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const box = boxRef.current;
    if (!d || !box) return;
    const rect = box.getBoundingClientRect();
    const nx = Math.min(0.98, Math.max(0, d.ox + (e.clientX - d.startX) / rect.width));
    const ny = Math.min(0.98, Math.max(0, d.oy + (e.clientY - d.startY) / rect.height));
    setOverlays((ov) => ov.map((x) => (x.id === d.id ? { ...x, xPct: nx, yPct: ny } : x)));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  // ── Export PHOTO (canvas) ────────────────────────────────────────────────
  const exportImage = useCallback(async () => {
    if (!nat) return;
    setExporting(true);
    setNote(null);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("image load"));
        img.src = media.url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = nat.w;
      canvas.height = nat.h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, nat.w, nat.h);
      drawOverlays(ctx, nat.w, nat.h, overlays);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("toBlob");
      const url = URL.createObjectURL(blob);
      onExport({ url, name: "edited.png", size: blob.size, kind: "image" });
      onClose();
    } catch {
      setNote(t(
        "Export impossible (l'image source bloque peut-être l'accès cross-origin).",
        "Export failed (the source image may block cross-origin access).",
      ));
    } finally {
      setExporting(false);
    }
  }, [nat, overlays, media.url, onExport, onClose, t]);

  // ── Export VIDÉO (ffmpeg.wasm) ───────────────────────────────────────────
  const exportVideo = useCallback(async () => {
    if (!nat) return;
    setExporting(true);
    setProgress(0);
    setNote(t("Préparation du moteur vidéo…", "Loading video engine…"));
    try {
      // 1. PNG transparent du texte à la résolution native de la vidéo.
      const canvas = document.createElement("canvas");
      canvas.width = nat.w;
      canvas.height = nat.h;
      const ctx = canvas.getContext("2d")!;
      drawOverlays(ctx, nat.w, nat.h, overlays);
      const ovBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      const ovBytes = new Uint8Array(await (ovBlob as Blob).arrayBuffer());

      // 2. Chargement de ffmpeg.wasm (core single-thread depuis le CDN).
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress: p }) => setProgress(Math.min(99, Math.round(p * 100))));
      let lastLog = "";
      ffmpeg.on("log", ({ message }) => {
        lastLog = message;
      });
      const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });

      setNote(t("Rendu de la vidéo en cours…", "Rendering video…"));
      await ffmpeg.writeFile("in.mp4", await fetchFile(media.url));
      await ffmpeg.writeFile("ov.png", ovBytes);

      let args: string[];
      if (music) {
        await ffmpeg.writeFile("music", await fetchFile(music));
        if (keepAudio) {
          args = [
            "-i", "in.mp4", "-i", "ov.png", "-i", "music",
            "-filter_complex", "[0:v][1:v]overlay=0:0[v];[0:a][2:a]amix=inputs=2:duration=shortest[a]",
            "-map", "[v]", "-map", "[a]",
          ];
        } else {
          args = [
            "-i", "in.mp4", "-i", "ov.png", "-i", "music",
            "-filter_complex", "[0:v][1:v]overlay=0:0[v]",
            "-map", "[v]", "-map", "2:a",
          ];
        }
      } else {
        args = [
          "-i", "in.mp4", "-i", "ov.png",
          "-filter_complex", "[0:v][1:v]overlay=0:0[v]",
          "-map", "[v]", "-map", "0:a?",
        ];
      }
      args.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "out.mp4");

      const code = await ffmpeg.exec(args);
      if (code !== 0) throw new Error(lastLog || `ffmpeg code ${code}`);

      const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
      if (!data || data.length === 0) throw new Error(lastLog || "empty output");
      // Copie dans un ArrayBuffer "classique" (la sortie ffmpeg peut être typée
      // SharedArrayBuffer, non assignable à BlobPart).
      const bytes = new Uint8Array(data.length);
      bytes.set(data);
      const blob = new Blob([bytes], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      onExport({ url, name: "edited.mp4", size: blob.size, kind: "video" });
      onClose();
    } catch (err) {
      setNote(
        t("Échec du rendu vidéo : ", "Video render failed: ") +
          (err instanceof Error ? err.message.slice(0, 160) : ""),
      );
    } finally {
      setExporting(false);
    }
  }, [nat, overlays, music, keepAudio, media.url, onExport, onClose, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hair px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">
            🎬 {t("Studio — texte & musique", "Studio — text & music")}
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[1fr,260px]">
          {/* Aperçu + overlays */}
          <div>
            <div
              ref={boxRef}
              className="relative mx-auto w-full max-w-sm select-none overflow-hidden rounded-lg bg-black"
              style={{ height: boxH }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={() => setSelectedId(null)}
            >
              {isVideo ? (
                <video
                  src={media.url}
                  className="h-full w-full object-contain"
                  muted
                  loop
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => setNat({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.url}
                  alt="media"
                  crossOrigin="anonymous"
                  className="h-full w-full object-contain"
                  onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                />
              )}
              {overlays.map((o) => (
                <div
                  key={o.id}
                  onPointerDown={(e) => onPointerDown(e, o)}
                  className={`absolute cursor-move whitespace-pre leading-tight ${selectedId === o.id ? "outline outline-2 outline-primary-400" : ""}`}
                  style={{
                    left: `${o.xPct * 100}%`,
                    top: `${o.yPct * 100}%`,
                    fontSize: Math.max(8, o.sizePct * boxH),
                    color: o.color,
                    fontWeight: o.bold ? 700 : 400,
                    background: o.bg ? "rgba(0,0,0,0.5)" : "transparent",
                    padding: o.bg ? "0 0.15em" : 0,
                  }}
                >
                  {o.text}
                </div>
              ))}
            </div>
            <button type="button" onClick={addText} className="btn-secondary mt-3 w-full text-xs">
              ➕ {t("Ajouter un texte", "Add text")}
            </button>
          </div>

          {/* Panneau de réglages */}
          <div className="space-y-3 text-xs">
            {selected ? (
              <div className="space-y-2 rounded-lg border border-hair p-3">
                <p className="font-semibold text-ink">{t("Texte sélectionné", "Selected text")}</p>
                <textarea
                  value={selected.text}
                  onChange={(e) => updateSel({ text: e.target.value })}
                  rows={2}
                  className="input w-full text-sm"
                />
                <label className="flex items-center justify-between gap-2">
                  <span className="text-muted">{t("Taille", "Size")}</span>
                  <input
                    type="range" min={3} max={20} value={Math.round(selected.sizePct * 100)}
                    onChange={(e) => updateSel({ sizePct: Number(e.target.value) / 100 })}
                  />
                </label>
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSel({ color: c })}
                      className={`h-6 w-6 rounded-full border ${selected.color === c ? "ring-2 ring-primary-400" : "border-hair"}`}
                      style={{ background: c }}
                    />
                  ))}
                  <input type="color" value={selected.color} onChange={(e) => updateSel({ color: e.target.value })} className="h-6 w-8" />
                </div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={selected.bold} onChange={(e) => updateSel({ bold: e.target.checked })} />
                    {t("Gras", "Bold")}
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={selected.bg} onChange={(e) => updateSel({ bg: e.target.checked })} />
                    {t("Fond", "Background")}
                  </label>
                </div>
                <button type="button" onClick={removeSel} className="text-danger-600 hover:underline">
                  🗑 {t("Supprimer", "Delete")}
                </button>
              </div>
            ) : (
              <p className="text-muted">{t("Cliquez « Ajouter un texte », puis glissez-le sur le média.", "Click \"Add text\", then drag it onto the media.")}</p>
            )}

            {isVideo && (
              <div className="space-y-2 rounded-lg border border-hair p-3">
                <p className="font-semibold text-ink">🎵 {t("Musique", "Music")}</p>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setMusic(e.target.files?.[0] ?? null)}
                  className="block w-full text-2xs"
                />
                {music && (
                  <>
                    <p className="truncate text-2xs text-muted">{music.name}</p>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} />
                      {t("Garder le son original (mixer)", "Keep original audio (mix)")}
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pied : export */}
        <div className="space-y-2 border-t border-hair px-4 py-3">
          {note && <p className="text-2xs text-muted">{note}</p>}
          {exporting && isVideo && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
              <div className="h-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={exporting} className="btn-secondary text-xs">
              {t("Annuler", "Cancel")}
            </button>
            <button
              type="button"
              onClick={isVideo ? exportVideo : exportImage}
              disabled={exporting || !nat}
              className="btn-primary text-xs"
            >
              {exporting
                ? isVideo
                  ? t(`Rendu… ${progress}%`, `Rendering… ${progress}%`)
                  : t("Export…", "Exporting…")
                : t("Exporter & appliquer", "Export & apply")}
            </button>
          </div>
          {isVideo && (
            <p className="text-2xs text-muted">
              {t(
                "Le rendu vidéo s'effectue dans votre navigateur (peut prendre 30 s à 2 min selon la durée).",
                "Video rendering runs in your browser (may take 30 s to 2 min depending on length).",
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
