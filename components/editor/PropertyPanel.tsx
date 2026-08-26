"use client";

// Panneau de propriétés de l'élément sélectionné.
//
// POURQUOI UN BLOC COMMUN
// L'audit relevait un tableau troué : l'opacité n'existait que sur les
// incrustations, la rotation nulle part, la position seulement au glisser, et
// aucune saisie numérique où que ce soit. La cause n'était pas l'oubli d'une
// propriété mais l'absence d'un endroit où elles vivent toutes.
//
// Ici, `CommonBox` traite ce que TOUT élément visuel possède — position,
// dimensions, rotation, opacité, bornes. Ajouter une propriété la rend
// disponible partout d'un coup. Les panneaux spécifiques ne portent plus que ce
// qui est propre à leur type.

import { useT } from "@/lib/i18n";
import {
  ANIMATION_SECONDS,
  projectDuration,
  setClipFraming,
  setClipLength,
  setClipSpeed,
  setClipTransition,
  updateAudio,
  updateImageLayer,
  updateShape,
  updateText,
  type AnimationKind,
  type EditorProject,
  type TransitionKind,
  type VisualLayer,
} from "@/lib/editor/project";
import { FONT_STACKS } from "@/lib/editor/draw";
import type { BrandStyle } from "@/lib/editor/templates";
import type { TimelineSelection } from "./Timeline";

const PRESET_COLORS = ["#ffffff", "#000000", "#ff3b30", "#ffcc00", "#34c759", "#0a84ff"];

const ANIMATIONS: { key: AnimationKind; fr: string; en: string }[] = [
  { key: "none", fr: "Aucune", en: "None" },
  { key: "fade", fr: "Fondu", en: "Fade" },
  { key: "slide-up", fr: "Glisse ↑", en: "Slide ↑" },
  { key: "slide-down", fr: "Glisse ↓", en: "Slide ↓" },
  { key: "slide-left", fr: "Glisse ←", en: "Slide ←" },
  { key: "slide-right", fr: "Glisse →", en: "Slide →" },
  { key: "zoom", fr: "Zoom", en: "Zoom" },
];

export function PropertyPanel({
  project,
  selection,
  playhead,
  brand,
  onChange,
  onDeselect,
}: {
  project: EditorProject;
  selection: TimelineSelection;
  playhead: number;
  brand: BrandStyle;
  onChange: (fn: (p: EditorProject) => EditorProject) => void;
  onDeselect: () => void;
}) {
  const t = useT();
  const total = projectDuration(project);

  if (!selection) {
    return (
      <p className="p-2 text-2xs text-muted">
        {t(
          "Sélectionnez un plan ou un calque — sur la timeline ou dans la zone de travail — pour en régler les propriétés.",
          "Select a clip or layer — on the timeline or in the work area — to adjust its properties."
        )}
      </p>
    );
  }

  const clip = selection.kind === "clip" ? project.clips.find((c) => c.id === selection.id) : null;
  const text = selection.kind === "text" ? project.texts.find((l) => l.id === selection.id) : null;
  const image = selection.kind === "image" ? project.images.find((l) => l.id === selection.id) : null;
  const shape = selection.kind === "shape" ? project.shapes.find((l) => l.id === selection.id) : null;
  const audio = selection.kind === "audio" ? project.audios.find((a) => a.id === selection.id) : null;

  /** Applique un patch au calque visuel sélectionné, quel que soit son type. */
  const patchVisual = (patch: Partial<VisualLayer>) => {
    if (text) onChange((p) => updateText(p, text.id, patch));
    else if (image) onChange((p) => updateImageLayer(p, image.id, patch));
    else if (shape) onChange((p) => updateShape(p, shape.id, patch));
  };

  const visual: VisualLayer | null = text ?? image ?? shape ?? null;

  return (
    <div className="space-y-3">
      {/* ── Plan ─────────────────────────────────────────────────────────── */}
      {clip && (
        <Panel title={t("Plan", "Clip")}>
          <NumberRow
            label={t("Durée", "Length")} unit="s" value={clip.length} step={0.1} min={0.1}
            onChange={(v) => onChange((p) => setClipLength(p, clip.id, v))}
          />
          <NumberRow
            label={t("Début", "Start")} unit="s" value={clip.start} step={0.1} min={0}
            onChange={(v) => onChange((p) => ({ ...p, clips: p.clips.map((c) => (c.id === clip.id ? { ...c, start: v } : c)) }))}
          />
          <Range
            label={t("Vitesse", "Speed")} min={0.5} max={2} step={0.1} value={clip.speed}
            display={`${clip.speed.toFixed(1)}×`}
            onChange={(v) => onChange((p) => setClipSpeed(p, clip.id, v))}
          />

          {/* Cadrage — publier une source horizontale en vertical sans
              décapiter le sujet. */}
          <div className="flex flex-wrap items-center gap-2 text-2xs text-muted">
            <span className="w-20 shrink-0">{t("Cadrage", "Framing")}</span>
            <Toggle on={clip.fit === "cover"} onClick={() => onChange((p) => setClipFraming(p, clip.id, { fit: "cover" }))}>
              {t("Remplir", "Fill")}
            </Toggle>
            <Toggle on={clip.fit === "contain"} onClick={() => onChange((p) => setClipFraming(p, clip.id, { fit: "contain" }))}>
              {t("Entier", "Whole")}
            </Toggle>
          </div>
          {clip.fit === "cover" && (
            <>
              <Range label={t("Recadrage ↔", "Reframe ↔")} min={0} max={1} step={0.05} value={clip.focusX}
                display={`${Math.round(clip.focusX * 100)}%`}
                onChange={(v) => onChange((p) => setClipFraming(p, clip.id, { focusX: v }))} />
              <Range label={t("Recadrage ↕", "Reframe ↕")} min={0} max={1} step={0.05} value={clip.focusY}
                display={`${Math.round(clip.focusY * 100)}%`}
                onChange={(v) => onChange((p) => setClipFraming(p, clip.id, { focusY: v }))} />
            </>
          )}

          <SelectRow
            label={t("Piste", "Track")}
            value={String(clip.track)}
            options={[0, 1, 2].map((n) => ({ value: String(n), label: n === 0 ? t("Base", "Base") : `${t("Superposée", "Overlay")} ${n}` }))}
            onChange={(v) => onChange((p) => ({ ...p, clips: p.clips.map((c) => (c.id === clip.id ? { ...c, track: Number(v) } : c)) }))}
          />

          {project.clips.some((c) => c.track === clip.track && c.start < clip.start) && (
            <SelectRow
              label={t("Transition", "Transition")}
              value={clip.transitionIn}
              options={[
                { value: "none", label: t("Coupe franche", "Hard cut") },
                { value: "fade", label: t("Fondu", "Fade") },
                { value: "dissolve", label: t("Fondu enchaîné", "Dissolve") },
              ]}
              onChange={(v) => onChange((p) => setClipTransition(p, clip.id, v as TransitionKind))}
            />
          )}

          <p className="text-2xs text-muted">
            {t("Entrée dans la source", "Source in-point")} : {clip.trimStart.toFixed(1)}s
          </p>
        </Panel>
      )}

      {/* ── Bloc commun à tout élément visuel ────────────────────────────── */}
      {visual && (
        <Panel title={t("Position et apparence", "Position and appearance")}>
          <div className="grid grid-cols-2 gap-2">
            <NumberRow label="X" unit="%" value={visual.x * 100} step={1} compact
              onChange={(v) => patchVisual({ x: v / 100 })} />
            <NumberRow label="Y" unit="%" value={visual.y * 100} step={1} compact
              onChange={(v) => patchVisual({ y: v / 100 })} />
            {image && (
              <>
                <NumberRow label={t("Largeur", "Width")} unit="%" value={image.scale * 100} step={1} compact
                  onChange={(v) => onChange((p) => updateImageLayer(p, image.id, { scale: v / 100 }))} />
                <NumberRow label={t("Hauteur", "Height")} unit="%" value={image.heightPct * 100} step={1} compact
                  onChange={(v) => onChange((p) => updateImageLayer(p, image.id, { heightPct: v / 100 }))} />
              </>
            )}
            {shape && (
              <>
                <NumberRow label={t("Largeur", "Width")} unit="%" value={shape.w * 100} step={1} compact
                  onChange={(v) => onChange((p) => updateShape(p, shape.id, { w: v / 100 }))} />
                <NumberRow label={t("Hauteur", "Height")} unit="%" value={shape.h * 100} step={1} compact
                  onChange={(v) => onChange((p) => updateShape(p, shape.id, { h: v / 100 }))} />
              </>
            )}
            <NumberRow label={t("Rotation", "Rotation")} unit="°" value={visual.rotation} step={5} compact
              onChange={(v) => patchVisual({ rotation: v })} />
            <NumberRow label={t("Opacité", "Opacity")} unit="%" value={visual.opacity * 100} step={5} min={0} max={100} compact
              onChange={(v) => patchVisual({ opacity: v / 100 })} />
          </div>

          {/* Alignement — le champ existait dans le modèle sans être exposé
              nulle part, et rien ne permettait de caler un élément au cadre. */}
          <div className="flex flex-wrap items-center gap-1 text-2xs text-muted">
            <span className="w-20 shrink-0">{t("Aligner", "Align")}</span>
            <AlignButton label="⇤" title={t("À gauche", "Left")} onClick={() => patchVisual({ x: 0.05 })} />
            <AlignButton label="⇔" title={t("Centré", "Centre")} onClick={() => patchVisual({ x: centerX(visual, image?.scale ?? shape?.w) })} />
            <AlignButton label="⇥" title={t("À droite", "Right")} onClick={() => patchVisual({ x: rightX(visual, image?.scale ?? shape?.w) })} />
            <AlignButton label="⤒" title={t("En haut", "Top")} onClick={() => patchVisual({ y: 0.05 })} />
            <AlignButton label="⇕" title={t("Milieu", "Middle")} onClick={() => patchVisual({ y: centerY(shape?.h ?? image?.heightPct) })} />
            <AlignButton label="⤓" title={t("En bas", "Bottom")} onClick={() => patchVisual({ y: bottomY(shape?.h ?? image?.heightPct) })} />
          </div>

          <BoundsRow
            start={visual.start} end={visual.end} max={total} playhead={playhead}
            onStart={(v) => patchVisual({ start: v })}
            onEnd={(v) => patchVisual({ end: v })}
          />

          <div className="grid grid-cols-2 gap-2">
            <SelectRow
              label={t("Entrée", "In")} value={visual.animIn}
              options={ANIMATIONS.map((a) => ({ value: a.key, label: t(a.fr, a.en) }))}
              onChange={(v) => patchVisual({ animIn: v as AnimationKind })}
            />
            <SelectRow
              label={t("Sortie", "Out")} value={visual.animOut}
              options={ANIMATIONS.map((a) => ({ value: a.key, label: t(a.fr, a.en) }))}
              onChange={(v) => patchVisual({ animOut: v as AnimationKind })}
            />
          </div>
          {(visual.animIn !== "none" || visual.animOut !== "none") && (
            <p className="text-2xs text-muted">
              {t(`Animation de ${ANIMATION_SECONDS}s`, `${ANIMATION_SECONDS}s animation`)}
            </p>
          )}
        </Panel>
      )}

      {/* ── Texte ────────────────────────────────────────────────────────── */}
      {text && (
        <Panel title={t("Texte", "Text")}>
          <textarea
            value={text.text}
            onChange={(e) => onChange((p) => updateText(p, text.id, { text: e.target.value }))}
            rows={3}
            className="input resize-none text-xs"
          />
          <SelectRow
            label={t("Police", "Font")} value={text.font}
            options={Object.entries(FONT_STACKS).map(([key, f]) => ({ value: key, label: f.label }))}
            onChange={(v) => onChange((p) => updateText(p, text.id, { font: v as typeof text.font }))}
          />
          <Range label={t("Taille", "Size")} min={0.03} max={0.2} step={0.005} value={text.sizePct}
            display={`${Math.round(text.sizePct * 100)}%`}
            onChange={(v) => onChange((p) => updateText(p, text.id, { sizePct: v }))} />
          <Range label={t("Interligne", "Line height")} min={0.9} max={2} step={0.05} value={text.lineHeight}
            display={text.lineHeight.toFixed(2)}
            onChange={(v) => onChange((p) => updateText(p, text.id, { lineHeight: v }))} />
          <Range label={t("Largeur de bloc", "Wrap width")} min={0} max={1} step={0.02} value={text.wrapPct}
            display={text.wrapPct === 0 ? t("libre", "free") : `${Math.round(text.wrapPct * 100)}%`}
            onChange={(v) => onChange((p) => updateText(p, text.id, { wrapPct: v }))} />

          <div className="flex flex-wrap items-center gap-1.5">
            {[...PRESET_COLORS, ...brand.palette].slice(0, 10).map((c, i) => (
              <button key={`${c}-${i}`} type="button" aria-label={c}
                onClick={() => onChange((p) => updateText(p, text.id, { color: c }))}
                className={`h-5 w-5 rounded-full ring-1 ring-hair ${text.color === c ? "ring-2 ring-page" : ""}`}
                style={{ background: c }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Toggle on={text.bold} onClick={() => onChange((p) => updateText(p, text.id, { bold: !text.bold }))}>G</Toggle>
            <Toggle on={text.bg} onClick={() => onChange((p) => updateText(p, text.id, { bg: !text.bg }))}>▬</Toggle>
            <Toggle on={text.outline} onClick={() => onChange((p) => updateText(p, text.id, { outline: !text.outline }))}>◌</Toggle>
            <Toggle on={text.shadow} onClick={() => onChange((p) => updateText(p, text.id, { shadow: !text.shadow }))}>◍</Toggle>
            {(["left", "center", "right"] as const).map((a) => (
              <Toggle key={a} on={text.align === a} onClick={() => onChange((p) => updateText(p, text.id, { align: a }))}>
                {a === "left" ? "⯇" : a === "center" ? "≡" : "⯈"}
              </Toggle>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Forme ────────────────────────────────────────────────────────── */}
      {shape && (
        <Panel title={t("Forme", "Shape")}>
          <div className="flex flex-wrap items-center gap-1.5">
            {[...PRESET_COLORS, ...brand.palette].slice(0, 10).map((c, i) => (
              <button key={`${c}-${i}`} type="button" aria-label={c}
                onClick={() => onChange((p) => updateShape(p, shape.id, { fill: c }))}
                className={`h-5 w-5 rounded-full ring-1 ring-hair ${shape.fill === c ? "ring-2 ring-page" : ""}`}
                style={{ background: c }} />
            ))}
          </div>
          {shape.shape === "round" && (
            <Range label={t("Rayon", "Radius")} min={0} max={0.2} step={0.005} value={shape.radius}
              display={`${Math.round(shape.radius * 100)}%`}
              onChange={(v) => onChange((p) => updateShape(p, shape.id, { radius: v }))} />
          )}
          <Range label={t("Contour", "Stroke")} min={0} max={0.02} step={0.001} value={shape.strokeWidth}
            display={shape.strokeWidth === 0 ? t("aucun", "none") : `${(shape.strokeWidth * 100).toFixed(1)}%`}
            onChange={(v) => onChange((p) => updateShape(p, shape.id, { strokeWidth: v, stroke: v > 0 && shape.stroke === "transparent" ? "#000000" : shape.stroke }))} />
        </Panel>
      )}

      {/* ── Piste son ────────────────────────────────────────────────────── */}
      {audio && (
        <Panel title={audio.name}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audio.src} controls className="w-full" />
          <Range label={t("Volume", "Volume")} min={0} max={1} step={0.05} value={audio.volume}
            display={`${Math.round(audio.volume * 100)}%`}
            onChange={(v) => onChange((p) => updateAudio(p, audio.id, { volume: v }))} />
          <Range label={t("Fondu d'entrée", "Fade in")} min={0} max={5} step={0.1} value={audio.fadeIn}
            display={`${audio.fadeIn.toFixed(1)}s`}
            onChange={(v) => onChange((p) => updateAudio(p, audio.id, { fadeIn: v }))} />
          <Range label={t("Fondu de sortie", "Fade out")} min={0} max={5} step={0.1} value={audio.fadeOut}
            display={`${audio.fadeOut.toFixed(1)}s`}
            onChange={(v) => onChange((p) => updateAudio(p, audio.id, { fadeOut: v }))} />
          <NumberRow label={t("Début", "Start")} unit="s" value={audio.start} step={0.1} min={0}
            onChange={(v) => onChange((p) => updateAudio(p, audio.id, { start: v }))} />
          <NumberRow label={t("Durée", "Length")} unit="s" value={audio.length} step={0.1} min={0.1}
            onChange={(v) => onChange((p) => updateAudio(p, audio.id, { length: v }))} />
          <Toggle on={audio.muted} onClick={() => onChange((p) => updateAudio(p, audio.id, { muted: !audio.muted }))}>
            {audio.muted ? "🔇" : "🔊"}
          </Toggle>
        </Panel>
      )}

      <button type="button" onClick={onDeselect} className="w-full text-2xs text-muted hover:text-ink">
        {t("Désélectionner", "Deselect")}
      </button>
    </div>
  );
}

/* ── Aides d'alignement ──────────────────────────────────────────────────── */

const centerX = (l: VisualLayer, w?: number) => (w ? (1 - w) / 2 : 0.5 - 0.2);
const rightX = (l: VisualLayer, w?: number) => (w ? 0.95 - w : 0.75);
const centerY = (h?: number) => (h ? (1 - h) / 2 : 0.45);
const bottomY = (h?: number) => (h ? 0.95 - h : 0.85);

/* ── Petits composants ───────────────────────────────────────────────────── */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-hair p-3">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`h-5 min-w-[1.25rem] rounded px-1 text-2xs font-bold ${on ? "bg-page text-white" : "text-muted ring-1 ring-hair"}`}>
      {children}
    </button>
  );
}

function AlignButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className="h-5 w-5 rounded text-2xs text-muted ring-1 ring-hair hover:text-ink">
      {label}
    </button>
  );
}

function Range({
  label, min, max, step, value, display, onChange,
}: {
  label: string; min: number; max: number; step: number; value: number; display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-2xs text-muted">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-page" />
      <span className="w-10 shrink-0 text-right text-ink">{display}</span>
    </label>
  );
}

/**
 * Saisie numérique — l'audit relevait qu'aucune propriété ne s'entrait au
 * clavier : tout passait par un curseur ou un glisser, donc à l'estime.
 */
function NumberRow({
  label, unit, value, step, min, max, compact, onChange,
}: {
  label: string; unit: string; value: number; step: number;
  min?: number; max?: number; compact?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className={`flex items-center gap-1.5 text-2xs text-muted ${compact ? "" : "w-full"}`}>
      <span className={compact ? "w-14 shrink-0" : "w-20 shrink-0"}>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full min-w-0 rounded-md border border-hair bg-transparent px-1.5 py-0.5 text-right tabular-nums text-ink"
      />
      <span className="shrink-0">{unit}</span>
    </label>
  );
}

function SelectRow({
  label, value, options, onChange,
}: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-2xs text-muted">
      <span className="w-20 shrink-0">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input flex-1 py-0.5 text-2xs">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Bornes d'apparition d'un calque, posables à la tête de lecture. */
function BoundsRow({
  start, end, max, playhead, onStart, onEnd,
}: {
  start: number; end: number; max: number; playhead: number;
  onStart: (v: number) => void; onEnd: (v: number) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <NumberRow label={t("De", "From")} unit="s" value={start} step={0.1} min={0} max={max} compact onChange={onStart} />
        <NumberRow label={t("À", "To")} unit="s" value={end} step={0.1} min={0} max={max} compact onChange={onEnd} />
      </div>
      <div className="flex flex-wrap items-center gap-1 text-2xs text-muted">
        <button type="button" onClick={() => onStart(Math.min(playhead, end - 0.1))}
          className="rounded px-1.5 py-0.5 ring-1 ring-hair hover:text-ink">{t("Début ici", "Start here")}</button>
        <button type="button" onClick={() => onEnd(Math.max(playhead, start + 0.1))}
          className="rounded px-1.5 py-0.5 ring-1 ring-hair hover:text-ink">{t("Fin ici", "End here")}</button>
        <button type="button" onClick={() => { onStart(0); onEnd(max); }}
          className="rounded px-1.5 py-0.5 ring-1 ring-hair hover:text-ink">{t("Tout le film", "Whole film")}</button>
      </div>
    </div>
  );
}
