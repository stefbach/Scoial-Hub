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

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  ANIMATION_SECONDS,
  moveElement,
  projectDuration,
  setClipAudio,
  setClipBox,
  setClipFraming,
  setClipLength,
  setClipOpacity,
  setClipSpeed,
  setClipTransition,
  updateAudio,
  updateImageLayer,
  animatableProps,
  clearKeyframes,
  hasKeyframes,
  keyframesOf,
  patchAnimated,
  removeKeyframe,
  setKeyframe,
  staticValue,
  updateShape,
  updateText,
  valueAt,
  type Animatable,
  type AnimatableKind,
  type AnimatableProp,
  type AnimationKind,
  type EasingKind,
  type AudioTrack,
  type Clip,
  type EditorProject,
  type ImageLayer,
  type ShapeLayer,
  type TrackFamily,
  type TransitionKind,
  type TextLayer,
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
  multiSelectionItems = [],
  playhead,
  brand,
  onChange,
  onDeselect,
  onSeek,
  gesture,
}: {
  project: EditorProject;
  selection: TimelineSelection;
  /**
   * Éléments d'une sélection multiple (vide ou un seul élément = sélection
   * simple, comportement inchangé). Éditer les propriétés détaillées d'un
   * SEUL des éléments d'un groupe sans le dire donnerait l'illusion que le
   * réglage s'applique à tous — on affiche donc un résumé neutre à la place
   * plutôt que le panneau complet du seul élément principal, SAUF si tout le
   * groupe est du même type « texte » : c'est alors le lot de sous-titres
   * qu'une transcription vient de poser, et un réglage commun (couleur,
   * police, gras) redevient un besoin réel plutôt qu'une ambiguïté (audit
   * Editing Bench, P2-10).
   */
  multiSelectionItems?: NonNullable<TimelineSelection>[];
  playhead: number;
  brand: BrandStyle;
  onChange: (fn: (p: EditorProject) => EditorProject) => void;
  onDeselect: () => void;
  /** Déplace la tête de lecture — la navigation d'image-clé à image-clé en a
      besoin : atteindre une clé sans y amener la lecture ne servirait à rien. */
  onSeek: (time: number) => void;
  /**
   * Geste continu — l'ajustement d'une valeur au glisser. `live` écrit sans
   * empiler d'historique, `begin`/`commit` scellent le tout en UNE entrée :
   * sans quoi un glisser de deux centimètres produirait cinquante annulations
   * à défaire une par une.
   */
  gesture: {
    begin: () => void;
    live: (fn: (p: EditorProject) => EditorProject) => void;
    commit: () => void;
  };
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

  if (multiSelectionItems.length > 1) {
    return (
      <MultiSelectionPanel
        project={project}
        items={multiSelectionItems}
        total={total}
        brand={brand}
        onChange={onChange}
        gesture={gesture}
      />
    );
  }

  const clip = selection.kind === "clip" ? project.clips.find((c) => c.id === selection.id) : null;
  const text = selection.kind === "text" ? project.texts.find((l) => l.id === selection.id) : null;
  const image = selection.kind === "image" ? project.images.find((l) => l.id === selection.id) : null;
  const shape = selection.kind === "shape" ? project.shapes.find((l) => l.id === selection.id) : null;
  const audio = selection.kind === "audio" ? project.audios.find((a) => a.id === selection.id) : null;

  /**
   * Applique un patch au calque visuel sélectionné, quel que soit son type.
   *
   * Une propriété ANIMÉE reçoit une image-clé à la tête de lecture plutôt
   * qu'une nouvelle valeur fixe (`patchAnimated`) : sur un calque animé, taper
   * une valeur ne peut pas vouloir dire « décale toute l'animation », sinon
   * plus aucune clé ne serait modifiable après coup. Les propriétés non
   * animées, elles, se comportent exactement comme avant.
   */
  const patchVisual = (patch: Partial<VisualLayer>) => {
    const kind = text ? "text" : image ? "image" : shape ? "shape" : null;
    const id = text?.id ?? image?.id ?? shape?.id;
    if (!kind || !id) return;
    onChange((p) => patchAnimated(p, { kind, id }, patch, playhead));
  };

  const visual: VisualLayer | null = text ?? image ?? shape ?? null;
  /** `visual` est élargi à `VisualLayer` (perd `id`) — repris ici pour la
      piste, seul réglage qui a besoin de savoir lequel des trois c'est. */
  const visualKind: "text" | "image" | "shape" | null = text ? "text" : image ? "image" : shape ? "shape" : null;
  const visualId = text?.id ?? image?.id ?? shape?.id;
  /**
   * Largeur utilisée pour centrer/aligner à droite horizontalement — jusqu'ici
   * toujours `undefined` pour un texte (ni image ni forme), donc les boutons
   * « Centré »/« À droite » retombaient sur une largeur arbitraire de 0.4,
   * ignorant totalement `wrapPct` quand un retour à la ligne était réglé : le
   * texte se retrouvait décalé, pas centré (audit Editing Bench, P1-8/P2-8).
   * Un texte à largeur libre (wrapPct 0, hauteur = contenu) reste sans mesure
   * connue — repli identique à avant dans ce cas précis.
   */
  const horizontalWidth = image?.scale ?? shape?.w ?? (text && text.wrapPct > 0 ? text.wrapPct : undefined);

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

          {/* Cadre — position et taille de la FENÊTRE d'incrustation, distinct
              du recadrage ci-dessus qui règle ce que la source montre À
              L'INTÉRIEUR de cette fenêtre. Plein cadre par défaut : sans ce
              bloc, une incrustation vidéo ne pouvait pas se poser en petite
              fenêtre dans un coin — seulement en plein écran (audit Editing
              Bench, P2-1). N'importe quel plan peut désormais s'en servir,
              pas seulement une « piste d'incrustation » — une piste n'a plus
              de statut particulier depuis les pistes libres (Lot A2). */}
          {/* Un plan s'anime comme un calque : le cadre et l'opacité portent
              leur propre chronomètre, sur la même ligne que la valeur. */}
          {(["x", "y", "w", "h", "opacity"] as const).map((prop) => (
            <AnimatableRow
              key={prop}
              prop={prop}
              label={PROP_LABEL(t)[prop]}
              unit="%"
              scale={100}
              step={prop === "opacity" ? 5 : 1}
              min={prop === "w" || prop === "h" ? 2 : prop === "opacity" ? 0 : undefined}
              max={prop === "opacity" ? 100 : undefined}
              element={clip}
              sel={{ kind: "clip", id: clip.id }}
              playhead={playhead}
              onChange={onChange}
              onSeek={onSeek} gesture={gesture}
            />
          ))}

          <TrackPicker
            project={project} family="visual" value={clip.trackId}
            onChange={(trackId) => onChange((p) => moveElement(p, { kind: "clip", id: clip.id }, { trackId }))}
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

          {/* Son embarqué — une propriété du plan lui-même, désormais, plutôt
              qu'une déduction depuis sa piste (Lot A4, audit Editing Bench
              v4). Sans objet pour une photo. */}
          {clip.kind === "video" && (
            <>
              <AnimatableRow
                prop="volume" label={t("Volume", "Volume")} unit="%" scale={100} step={5} min={0} max={100}
                element={clip} sel={{ kind: "clip", id: clip.id }} playhead={playhead}
                onChange={onChange} onSeek={onSeek} gesture={gesture}
              />
              <Range label={t("Fondu d'entrée", "Fade in")} min={0} max={5} step={0.1} value={clip.fadeIn}
                display={`${clip.fadeIn.toFixed(1)}s`}
                onChange={(v) => onChange((p) => setClipAudio(p, clip.id, { fadeIn: v }))} />
              <Range label={t("Fondu de sortie", "Fade out")} min={0} max={5} step={0.1} value={clip.fadeOut}
                display={`${clip.fadeOut.toFixed(1)}s`}
                onChange={(v) => onChange((p) => setClipAudio(p, clip.id, { fadeOut: v }))} />
              <Toggle
                title={clip.muted ? t("Muet — cliquer pour réactiver", "Muted — click to unmute") : t("Audible — cliquer pour couper", "Audible — click to mute")}
                on={clip.muted} onClick={() => onChange((p) => setClipAudio(p, clip.id, { muted: !clip.muted }))}
              >
                {clip.muted ? "🔇" : "🔊"}
              </Toggle>
            </>
          )}
        </Panel>
      )}

      {/* ── Bloc commun à tout élément visuel ────────────────────────────── */}
      {visual && (
        <Panel title={t("Position et apparence", "Position and appearance")}>
          {visualKind && visualId && (
            <>
              <AnimatableRow prop="x" label={PROP_LABEL(t).x} unit="%" scale={100} step={1}
                element={visual} sel={{ kind: visualKind, id: visualId }} playhead={playhead}
                onChange={onChange} onSeek={onSeek} gesture={gesture} />
              <AnimatableRow prop="y" label={PROP_LABEL(t).y} unit="%" scale={100} step={1}
                element={visual} sel={{ kind: visualKind, id: visualId }} playhead={playhead}
                onChange={onChange} onSeek={onSeek} gesture={gesture} />
              {image && (
                <>
                  <AnimatableRow prop="scale" label={PROP_LABEL(t).w} unit="%" scale={100} step={1} min={1}
                    element={image} sel={{ kind: "image", id: image.id }} playhead={playhead}
                    onChange={onChange} onSeek={onSeek} gesture={gesture} />
                  {/* La hauteur d'une incrustation n'est pas animable : elle
                      se déduit du rapport natif de l'image dès qu'on ne la
                      force pas, ce qu'une clé rendrait incompréhensible. */}
                  <NumberRow label={PROP_LABEL(t).h} unit="%" value={image.heightPct * 100} step={1}
                    autoLabel={t("auto", "auto")}
                    onChange={(v) => onChange((p) => updateImageLayer(p, image.id, { heightPct: v / 100 }))}
                    scrub={{
                      begin: gesture.begin,
                      commit: gesture.commit,
                      live: (v) => gesture.live((p) => updateImageLayer(p, image.id, { heightPct: v / 100 })),
                    }} />
                </>
              )}
              {shape && (
                <>
                  <AnimatableRow prop="w" label={PROP_LABEL(t).w} unit="%" scale={100} step={1} min={2}
                    element={shape} sel={{ kind: "shape", id: shape.id }} playhead={playhead}
                    onChange={onChange} onSeek={onSeek} gesture={gesture} />
                  <AnimatableRow prop="h" label={PROP_LABEL(t).h} unit="%" scale={100} step={1} min={2}
                    element={shape} sel={{ kind: "shape", id: shape.id }} playhead={playhead}
                    onChange={onChange} onSeek={onSeek} gesture={gesture} />
                </>
              )}
              <AnimatableRow prop="rotation" label={PROP_LABEL(t).rotation} unit="°" step={5}
                element={visual} sel={{ kind: visualKind, id: visualId }} playhead={playhead}
                onChange={onChange} onSeek={onSeek} gesture={gesture} />
              <AnimatableRow prop="opacity" label={PROP_LABEL(t).opacity} unit="%" scale={100} step={5} min={0} max={100}
                element={visual} sel={{ kind: visualKind, id: visualId }} playhead={playhead}
                onChange={onChange} onSeek={onSeek} gesture={gesture} />
            </>
          )}

          {/* Alignement — le champ existait dans le modèle sans être exposé
              nulle part, et rien ne permettait de caler un élément au cadre. */}
          <div className="flex flex-wrap items-center gap-1 text-2xs text-muted">
            <span className="w-20 shrink-0">{t("Aligner", "Align")}</span>
            <AlignButton label="⇤" title={t("À gauche", "Left")} onClick={() => patchVisual({ x: 0.05 })} />
            <AlignButton label="⇔" title={t("Centré", "Centre")} onClick={() => patchVisual({ x: centerX(horizontalWidth) })} />
            <AlignButton label="⇥" title={t("À droite", "Right")} onClick={() => patchVisual({ x: rightX(horizontalWidth) })} />
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
            <SelectRow compact
              label={t("Entrée", "In")} value={visual.animIn}
              options={ANIMATIONS.map((a) => ({ value: a.key, label: t(a.fr, a.en) }))}
              onChange={(v) => patchVisual({ animIn: v as AnimationKind })}
            />
            <SelectRow compact
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

          {visualKind && visualId && (
            <TrackPicker
              project={project} family="visual" value={visual.trackId}
              onChange={(trackId) => onChange((p) => moveElement(p, { kind: visualKind, id: visualId }, { trackId }))}
            />
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

          <ColorSwatches value={text.color} onChange={(c) => onChange((p) => updateText(p, text.id, { color: c }))} brand={brand} />

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted">{t("Style", "Style")}</p>
            <div className="flex flex-wrap items-center gap-1">
              <ToggleChip icon="𝐁" label={t("Gras", "Bold")} on={text.bold}
                onClick={() => onChange((p) => updateText(p, text.id, { bold: !text.bold }))} />
              <ToggleChip icon="▬" label={t("Bandeau", "Band")}
                title={t("Bandeau semi-transparent derrière le texte", "Semi-transparent band behind the text")}
                on={text.bg} onClick={() => onChange((p) => updateText(p, text.id, { bg: !text.bg }))} />
              <ToggleChip icon="◌" label={t("Contour", "Outline")}
                title={t("Contour sombre — lisibilité sur fond clair", "Dark outline — legibility on a light background")}
                on={text.outline} onClick={() => onChange((p) => updateText(p, text.id, { outline: !text.outline }))} />
              <ToggleChip icon="◍" label={t("Ombre", "Shadow")}
                title={t("Ombre portée — lisibilité sur fond chargé", "Drop shadow — legibility on a busy background")}
                on={text.shadow} onClick={() => onChange((p) => updateText(p, text.id, { shadow: !text.shadow }))} />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted">{t("Alignement", "Alignment")}</p>
            <div className="flex flex-wrap items-center gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <ToggleChip
                  key={a}
                  on={text.align === a}
                  icon={a === "left" ? "⯇" : a === "center" ? "≡" : "⯈"}
                  label={a === "left" ? t("Gauche", "Left") : a === "center" ? t("Centre", "Centre") : t("Droite", "Right")}
                  onClick={() => onChange((p) => updateText(p, text.id, { align: a }))}
                />
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* ── Forme ────────────────────────────────────────────────────────── */}
      {shape && (
        <Panel title={t("Forme", "Shape")}>
          <ColorSwatches value={shape.fill} onChange={(c) => onChange((p) => updateShape(p, shape.id, { fill: c }))} brand={brand} />
          {shape.shape === "round" && (
            <Range label={t("Rayon", "Radius")} min={0} max={0.2} step={0.005} value={shape.radius}
              display={`${Math.round(shape.radius * 100)}%`}
              onChange={(v) => onChange((p) => updateShape(p, shape.id, { radius: v }))} />
          )}
          <Range label={t("Contour", "Stroke")} min={0} max={0.02} step={0.001} value={shape.strokeWidth}
            display={shape.strokeWidth === 0 ? t("aucun", "none") : `${(shape.strokeWidth * 100).toFixed(1)}%`}
            onChange={(v) => onChange((p) => updateShape(p, shape.id, { strokeWidth: v, stroke: v > 0 && shape.stroke === "transparent" ? "#000000" : shape.stroke }))} />
          {/* Couleur du contour — le champ existait dans le modèle sans être
              jamais exposé : le code forçait le noir sans que l'utilisateur
              puisse le changer (itération 3, C-07). Même palette que le
              remplissage, plus une option « aucun » qui rend le contour
              transparent sans toucher à son épaisseur. */}
          {shape.strokeWidth > 0 && (
            <ColorSwatches
              value={shape.stroke} onChange={(c) => onChange((p) => updateShape(p, shape.id, { stroke: c }))} brand={brand}
              before={
                <button type="button" aria-label={t("Aucun contour", "No stroke")}
                  title={t("Aucun contour", "No stroke")}
                  onClick={() => onChange((p) => updateShape(p, shape.id, { stroke: "transparent" }))}
                  className={`flex h-5 w-5 items-center justify-center rounded-full bg-[length:8px_8px] bg-[linear-gradient(45deg,transparent_45%,rgb(var(--color-hair))_45%,rgb(var(--color-hair))_55%,transparent_55%)] ring-1 ring-hair ${shape.stroke === "transparent" ? "ring-2 ring-page" : ""}`}
                />
              }
            />
          )}
        </Panel>
      )}

      {/* ── Piste son ────────────────────────────────────────────────────── */}
      {audio && (
        // En-tête par CATÉGORIE, comme « Plan »/« Texte »/« Forme » — le
        // panneau son affichait à la place le nom du fichier, seul type à
        // rompre le motif (audit Editing Bench, P3-2). Le nom reste visible,
        // en second, dans le corps du panneau.
        <Panel title={
          audio.role === "original" ? t("Son d'origine", "Original audio")
          : audio.role === "voice" ? t("Voix off", "Voiceover")
          : t("Musique", "Music")
        }>
          <p className="truncate text-2xs text-muted" title={audio.name}>{audio.name}</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audio.src} controls className="w-full" />
          {/* Le seul réglage animable d'un son — et le plus utile : baisser la
              musique sous une voix off se fait exactement comme ça. */}
          <AnimatableRow
            prop="volume" label={t("Volume", "Volume")} unit="%" scale={100} step={5} min={0} max={100}
            element={audio} sel={{ kind: "audio", id: audio.id }} playhead={playhead}
            onChange={onChange} onSeek={onSeek} gesture={gesture}
          />
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
          <Toggle
            title={audio.muted ? t("Muet — cliquer pour réactiver", "Muted — click to unmute") : t("Audible — cliquer pour couper", "Audible — click to mute")}
            on={audio.muted} onClick={() => onChange((p) => updateAudio(p, audio.id, { muted: !audio.muted }))}
          >
            {audio.muted ? "🔇" : "🔊"}
          </Toggle>

          <TrackPicker
            project={project} family="audio" value={audio.trackId}
            onChange={(trackId) => onChange((p) => moveElement(p, { kind: "audio", id: audio.id }, { trackId }))}
          />
        </Panel>
      )}

      <button type="button" onClick={onDeselect} className="w-full text-2xs text-muted hover:text-ink">
        {t("Désélectionner", "Deselect")}
      </button>
    </div>
  );
}

/* ── Aides d'alignement ──────────────────────────────────────────────────── */

const centerX = (w?: number) => (w ? (1 - w) / 2 : 0.5 - 0.2);
const rightX = (w?: number) => (w ? 0.95 - w : 0.75);
const centerY = (h?: number) => (h ? (1 - h) / 2 : 0.45);
const bottomY = (h?: number) => (h ? 0.95 - h : 0.85);

/* ── Petits composants ───────────────────────────────────────────────────── */

/* ── Ajustement au glisser ───────────────────────────────────────────────── */

/** Déplacement minimal avant qu'un clic devienne un glisser d'ajustement. */
const SCRUB_THRESHOLD_PX = 3;

/**
 * Rend un champ numérique AJUSTABLE À LA SOURIS : le curseur devient une
 * double flèche au survol, et tirer à gauche ou à droite fait varier la valeur.
 *
 * C'est le geste par lequel on règle une valeur dans tous les logiciels de
 * création — précisément parce qu'on cherche presque toujours une valeur PAR
 * ESSAIS, en regardant l'image, plutôt qu'un chiffre connu d'avance. Cliquer,
 * sélectionner, taper, valider pour voir le résultat, recommencer : c'est
 * quatre gestes pour ce qui devrait en être un.
 *
 * Le clic simple continue de donner le focus au champ pour la saisie au
 * clavier — le glisser ne s'enclenche qu'au-delà de quelques pixels, sans quoi
 * il deviendrait impossible de taper une valeur exacte. Maj ralentit le
 * réglage d'un facteur dix, pour l'approche fine.
 */
function useValueScrubber({
  value, step, min, max, onScrub, onStart, onEnd,
}: {
  value: number;
  step: number;
  min?: number;
  max?: number;
  onScrub: (v: number) => void;
  onStart: () => void;
  onEnd: () => void;
}) {
  const drag = useRef<{ x: number; from: number; moved: boolean; pointerId: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  return {
    scrubbing,
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLInputElement>) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, from: value, moved: false, pointerId: e.pointerId };
      },
      onPointerMove: (e: React.PointerEvent<HTMLInputElement>) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (!d.moved) {
          if (Math.abs(dx) < SCRUB_THRESHOLD_PX) return;
          d.moved = true;
          setScrubbing(true);
          // Le champ perd le focus : garder un curseur de saisie clignotant
          // pendant qu'on tire la valeur donnerait deux modes à la fois.
          e.currentTarget.blur();
          e.currentTarget.setPointerCapture?.(d.pointerId);
          onStart();
        }
        e.preventDefault();
        const fine = e.shiftKey ? 0.1 : 1;
        let next = d.from + dx * step * fine;
        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        onScrub(Math.round(next * 1000) / 1000);
      },
      onPointerUp: (e: React.PointerEvent<HTMLInputElement>) => {
        const d = drag.current;
        drag.current = null;
        if (!d?.moved) return;
        e.currentTarget.releasePointerCapture?.(d.pointerId);
        setScrubbing(false);
        onEnd();
      },
      onPointerCancel: () => {
        const d = drag.current;
        drag.current = null;
        if (!d?.moved) return;
        setScrubbing(false);
        onEnd();
      },
    },
  };
}

/** Classe commune d'un champ numérique ajustable au glisser. */
const SCRUB_INPUT =
  "cursor-ew-resize rounded-md border border-hair bg-transparent px-1 py-0.5 text-right tabular-nums text-ink placeholder:text-muted placeholder:italic [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/* ── Propriété animable ──────────────────────────────────────────────────── */

/** Libellés des propriétés animables — les mêmes partout dans le panneau. */
const PROP_LABEL = (t: (fr: string, en: string) => string): Record<AnimatableProp, string> => ({
  x: t("Position X", "Position X"),
  y: t("Position Y", "Position Y"),
  w: t("Largeur", "Width"),
  h: t("Hauteur", "Height"),
  opacity: t("Opacité", "Opacity"),
  rotation: t("Rotation", "Rotation"),
  scale: t("Largeur", "Width"),
  volume: t("Volume", "Volume"),
});

const EASINGS: { key: EasingKind; fr: string; en: string }[] = [
  { key: "linear", fr: "Linéaire", en: "Linear" },
  { key: "ease-in", fr: "Départ doux", en: "Ease in" },
  { key: "ease-out", fr: "Arrivée douce", en: "Ease out" },
  { key: "ease-in-out", fr: "Doux ↔", en: "Ease both" },
];

/** Tolérance pour dire qu'une clé se trouve « à » la tête de lecture. */
const AT_PLAYHEAD = 0.02;

/**
 * Une propriété réglable, avec son chronomètre d'images-clés SUR LA MÊME
 * LIGNE.
 *
 * C'est la disposition de tous les bancs de montage professionnels, et elle
 * n'est pas cosmétique : une animation se règle en allant et venant entre la
 * valeur et le temps. Séparer les deux dans deux blocs distincts obligeait à
 * relier de tête un nom de propriété d'un côté à un champ de l'autre, et
 * rendait invisible le fait qu'une propriété est animée quand on la modifie.
 *
 * La seconde ligne — navigation, accélération, décompte — n'apparaît QUE si la
 * propriété est animée : une ligne inerte sous chaque réglage serait du bruit
 * dans une colonne de trois cents pixels.
 */
function AnimatableRow({
  label, unit, prop, element, sel, playhead, scale = 1, step, min, max, autoLabel, onChange, onSeek, gesture,
}: {
  label: string;
  unit: string;
  prop: AnimatableProp;
  /** L'élément TEL QU'IL EST ENREGISTRÉ — pas résolu : on lit ses clés. */
  element: Animatable;
  sel: { kind: AnimatableKind; id: string };
  playhead: number;
  /** Facteur d'affichage : 100 pour une fraction montrée en pourcentage. */
  scale?: number;
  step: number;
  min?: number;
  max?: number;
  /** Texte en filigrane quand 0 signifie « déduite » plutôt que « nulle ». */
  autoLabel?: string;
  onChange: (fn: (p: EditorProject) => EditorProject) => void;
  onSeek: (time: number) => void;
  gesture: { begin: () => void; live: (fn: (p: EditorProject) => EditorProject) => void; commit: () => void };
}) {
  const t = useT();
  const keys = keyframesOf(element, prop);
  const animated = keys.length > 0;
  const here = keys.find((k) => Math.abs(k.time - playhead) <= AT_PLAYHEAD) ?? null;
  const prev = [...keys].reverse().find((k) => k.time < playhead - AT_PLAYHEAD) ?? null;
  const next = keys.find((k) => k.time > playhead + AT_PLAYHEAD) ?? null;
  // La valeur MONTRÉE est celle de l'instant courant, animée ou non — sans
  // quoi le champ afficherait une valeur fixe que l'écran ne montre plus.
  const shown = valueAt(element, prop, playhead) * scale;
  const isAuto = autoLabel !== undefined && shown === 0;

  const write = (value: number) =>
    onChange((p) => patchAnimated(p, sel, { [prop]: value / scale }, playhead));

  // Le glisser écrit SANS empiler d'historique, et le relâchement scelle le
  // tout en une seule entrée : sans quoi un réglage à la souris produirait des
  // dizaines d'annulations à défaire une par une.
  const { scrubbing, handlers } = useValueScrubber({
    value: shown,
    step,
    min,
    max,
    onScrub: (v) => gesture.live((p) => patchAnimated(p, sel, { [prop]: v / scale }, playhead)),
    onStart: gesture.begin,
    onEnd: gesture.commit,
  });

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-2xs text-muted">
        <button
          type="button"
          aria-pressed={animated}
          title={animated
            ? t(`${label} : animée — cliquer pour figer sur la valeur actuelle`, `${label}: animated — click to freeze at the current value`)
            : t(`${label} : fixe — cliquer pour l'animer`, `${label}: static — click to animate it`)}
          onClick={() => onChange((p) => (animated
            ? clearKeyframes(p, sel, prop, playhead)
            : setKeyframe(p, sel, prop, playhead, staticValue(element, prop), "linear")))}
          className={`h-5 w-5 shrink-0 rounded text-[10px] leading-none ${
            animated ? "bg-page text-white" : "text-muted ring-1 ring-hair hover:text-ink"
          }`}
        >
          ⏱
        </button>
        <span className="min-w-0 flex-1 truncate" title={label}>{label}</span>
        <input
          type="number"
          value={isAuto ? "" : Math.round(shown * 100) / 100}
          placeholder={isAuto ? autoLabel : undefined}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(v)) write(v);
          }}
          {...handlers}
          title={t(
            "Tirez à gauche ou à droite pour ajuster · Maj pour affiner · cliquez pour saisir",
            "Drag left or right to adjust · Shift to fine-tune · click to type"
          )}
          className={`w-16 shrink-0 ${SCRUB_INPUT} ${scrubbing ? "select-none ring-1 ring-page" : ""}`}
        />
        <span className="w-3 shrink-0 text-[10px]">{unit}</span>
      </div>

      {animated && (
        <div className="flex items-center gap-1 pl-6 text-2xs text-muted">
          <KfButton label="◀" title={t("Clé précédente", "Previous keyframe")}
            disabled={!prev} onClick={() => prev && onSeek(prev.time)} />
          {/* Losange plein : une clé est posée ICI. Creux : il n'y en a pas —
              en poser une reprend la valeur interpolée du moment, ce qui ne
              change donc rien à l'image tant qu'on ne la modifie pas. */}
          <KfButton
            label={here ? "◆" : "◇"}
            title={here ? t("Retirer la clé ici", "Remove the keyframe here") : t("Poser une clé ici", "Add a keyframe here")}
            onClick={() => onChange((p) => (here
              ? removeKeyframe(p, sel, prop, here.time)
              : setKeyframe(p, sel, prop, playhead, valueAt(element, prop, playhead), "linear")))}
          />
          <KfButton label="▶" title={t("Clé suivante", "Next keyframe")}
            disabled={!next} onClick={() => next && onSeek(next.time)} />
          <select
            value={here?.easing ?? "linear"}
            disabled={!here}
            title={t("Accélération du segment qui part de cette clé", "Easing of the segment starting at this keyframe")}
            onChange={(e) => here && onChange((p) => setKeyframe(p, sel, prop, here.time, here.value, e.target.value as EasingKind))}
            className="input min-w-0 flex-1 py-0.5 text-[10px] disabled:opacity-40"
          >
            {EASINGS.map((o) => (
              <option key={o.key} value={o.key}>{t(o.fr, o.en)}</option>
            ))}
          </select>
          <span className="shrink-0 tabular-nums" title={t("Nombre de clés", "Number of keyframes")}>{keys.length}</span>
        </div>
      )}
    </div>
  );
}

function KfButton({ label, title, onClick, disabled }: { label: string; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="h-5 w-5 shrink-0 rounded text-[10px] leading-none text-muted ring-1 ring-hair enabled:hover:text-ink disabled:opacity-30"
    >
      {label}
    </button>
  );
}

/* ── Sélection multiple ──────────────────────────────────────────────────── */

/** N'importe quel élément sélectionnable, vu par ses champs communs. */
type AnyElement = Clip | TextLayer | ImageLayer | ShapeLayer | AudioTrack;

function elementOf(p: EditorProject, sel: NonNullable<TimelineSelection>): AnyElement | undefined {
  if (sel.kind === "clip") return p.clips.find((c) => c.id === sel.id);
  if (sel.kind === "text") return p.texts.find((l) => l.id === sel.id);
  if (sel.kind === "image") return p.images.find((l) => l.id === sel.id);
  if (sel.kind === "shape") return p.shapes.find((l) => l.id === sel.id);
  return p.audios.find((a) => a.id === sel.id);
}

/** Marqueur d'une valeur qui DIFFÈRE d'un élément à l'autre du groupe. */
const MIXED = Symbol("mixed");
type Shared<T> = T | typeof MIXED | undefined;

/**
 * Valeur commune à tout le groupe, ou `MIXED`. Les nombres sont comparés
 * arrondis : deux positions issues d'un même glisser diffèrent au dix-millième
 * sans que l'utilisateur ait la moindre raison de les voir comme distinctes.
 */
function sharedValue<T>(values: (T | undefined)[]): Shared<T> {
  const known = values.filter((v): v is T => v !== undefined);
  if (known.length === 0) return undefined;
  const key = (v: T) => (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v);
  const first = key(known[0]);
  return known.every((v) => key(v) === first) ? known[0] : MIXED;
}

/**
 * Panneau d'une sélection de plusieurs éléments.
 *
 * Il ne se contentait jusqu'ici que d'un résumé neutre — sauf pour un groupe
 * de textes, qui n'obtenait que police et couleur. Sélectionner douze
 * sous-titres pour en changer la TAILLE, geste le plus courant après une
 * transcription, était donc impossible autrement qu'un par un (audit v4,
 * constat 2).
 *
 * Chaque bloc n'apparaît que si TOUS les éléments du groupe le possèdent :
 * proposer un réglage qui n'en toucherait qu'une partie serait pire que ne
 * pas le proposer. Un champ dont la valeur diffère d'un élément à l'autre
 * s'affiche VIDE plutôt qu'avec la valeur du premier — y écrire l'applique à
 * tout le groupe, la convention de tous les logiciels de montage.
 */
function MultiSelectionPanel({
  project, items, total, brand, onChange, gesture,
}: {
  project: EditorProject;
  items: NonNullable<TimelineSelection>[];
  total: number;
  brand: BrandStyle;
  onChange: (fn: (p: EditorProject) => EditorProject) => void;
  gesture: { begin: () => void; live: (fn: (p: EditorProject) => EditorProject) => void; commit: () => void };
}) {
  const t = useT();

  const kinds = new Set(items.map((i) => i.kind));
  const allTexts = kinds.size === 1 && kinds.has("text");
  const allAudio = kinds.size === 1 && kinds.has("audio");
  // Un plan porte x/y/opacité comme un calque, mais NI rotation NI animations
  // d'entrée/sortie : les deux ensembles ne se recouvrent pas complètement.
  const allVisual = !kinds.has("audio");
  const allLayers = allVisual && !kinds.has("clip");

  const elements = items.map((sel) => elementOf(project, sel)).filter((el): el is AnyElement => Boolean(el));
  const texts = allTexts
    ? items.map((sel) => project.texts.find((l) => l.id === sel.id)).filter((l): l is TextLayer => Boolean(l))
    : [];

  /** Une seule entrée d'historique pour tout le groupe, jamais une par élément. */
  const batch = (fn: (p: EditorProject, sel: NonNullable<TimelineSelection>) => EditorProject) =>
    onChange((p) => items.reduce((acc, sel) => fn(acc, sel), p));

  /** Champs visuels communs, appliqués selon le type réel de chaque élément. */
  const patchVisual = (patch: { x?: number; y?: number; opacity?: number; rotation?: number; animIn?: AnimationKind; animOut?: AnimationKind }) =>
    batch((p, sel) => patchOne(p, sel, patch));

  /** Le même patch, sur UN élément — partagé par le réglage et le glisser. */
  function patchOne(
    p: EditorProject,
    sel: NonNullable<TimelineSelection>,
    patch: { x?: number; y?: number; opacity?: number; rotation?: number; animIn?: AnimationKind; animOut?: AnimationKind }
  ): EditorProject {
    if (sel.kind === "clip") {
      let q = p;
      if (patch.x !== undefined || patch.y !== undefined) q = setClipBox(q, sel.id, { x: patch.x, y: patch.y });
      if (patch.opacity !== undefined) q = setClipOpacity(q, sel.id, patch.opacity);
      // Un plan n'a ni rotation ni animation d'entrée/sortie — les blocs qui
      // les portent ne s'affichent pas quand un plan est dans le groupe.
      return q;
    }
    if (sel.kind === "text") return updateText(p, sel.id, patch);
    if (sel.kind === "image") return updateImageLayer(p, sel.id, patch);
    if (sel.kind === "shape") return updateShape(p, sel.id, patch);
    return p;
  }

  const batchText = (patch: Partial<TextLayer>) =>
    batch((p, sel) => (sel.kind === "text" ? updateText(p, sel.id, patch) : p));

  /** Ajustement au glisser d'une propriété commune, en UNE entrée d'historique
      pour tout le groupe — comme n'importe quel autre réglage groupé. */
  const scrubVisual = (apply: (v: number) => (p: EditorProject, sel: NonNullable<TimelineSelection>) => EditorProject) => ({
    begin: gesture.begin,
    commit: gesture.commit,
    live: (v: number) => gesture.live((p) => items.reduce((acc, sel) => apply(v)(acc, sel), p)),
  });

  /** Idem pour un réglage propre au texte. */
  const scrubText = (patch: (v: number) => Partial<TextLayer>) => ({
    begin: gesture.begin,
    commit: gesture.commit,
    live: (v: number) => gesture.live((p) =>
      items.reduce((acc, sel) => (sel.kind === "text" ? updateText(acc, sel.id, patch(v)) : acc), p)),
  });

  /**
   * Décalage dans le temps, en secondes. C'est un DÉCALAGE et non un instant
   * absolu : reposer douze sous-titres au même début les empilerait tous au
   * même moment, ce que personne ne demande jamais.
   */
  const nudge = (delta: number) =>
    batch((p, sel) => {
      const el = elementOf(p, sel);
      if (!el) return p;
      return moveElement(p, { kind: sel.kind, id: sel.id }, { start: Math.max(0, el.start + delta) });
    });

  const num = (read: (el: AnyElement) => number | undefined) => sharedValue(elements.map(read));
  const visualOf = (el: AnyElement): VisualLayer | undefined => ("rotation" in el ? el : undefined);

  const x = num((el) => ("x" in el ? el.x : undefined));
  const y = num((el) => ("y" in el ? el.y : undefined));
  const opacity = num((el) => ("opacity" in el ? el.opacity : undefined));
  const rotation = num((el) => visualOf(el)?.rotation);
  const track = sharedValue(elements.map((el) => el.trackId));
  const animIn = sharedValue(elements.map((el) => visualOf(el)?.animIn));
  const animOut = sharedValue(elements.map((el) => visualOf(el)?.animOut));

  const title = allTexts
    ? t(`${items.length} textes sélectionnés`, `${items.length} text layers selected`)
    : t(`${items.length} éléments sélectionnés`, `${items.length} elements selected`);

  return (
    <div className="space-y-3">
      <Panel title={title}>
        <p className="text-2xs text-muted">
          {t(
            "Un réglage s'applique à tout le groupe, en une seule annulation. Un champ vide signale une valeur qui diffère d'un élément à l'autre — y écrire l'uniformise.",
            "A setting applies to the whole group, as a single undo. An empty field means the value differs between elements — typing one makes them match."
          )}
        </p>
        {!allVisual && !allAudio && (
          <p className="text-2xs text-muted">
            {t(
              "Le groupe mêle des sons et des éléments visuels : seuls le décalage dans le temps, Dupliquer et Supprimer s'appliquent à tous.",
              "The group mixes audio and visual elements: only the time offset, Duplicate and Delete apply to all of them."
            )}
          </p>
        )}
      </Panel>

      {/* ── Position et apparence — dès que le groupe est entièrement visuel ── */}
      {allVisual && (
        <Panel title={t("Position et apparence", "Position and appearance")}>
          <div className="grid grid-cols-2 gap-2">
            <MultiNumberRow label="X" unit="%" value={x} scale={100} step={1} compact
              onChange={(v) => patchVisual({ x: v / 100 })}
              scrub={scrubVisual((v) => (p, sel) => patchOne(p, sel, { x: v / 100 }))} />
            <MultiNumberRow label="Y" unit="%" value={y} scale={100} step={1} compact
              onChange={(v) => patchVisual({ y: v / 100 })}
              scrub={scrubVisual((v) => (p, sel) => patchOne(p, sel, { y: v / 100 }))} />
            {allLayers && (
              <MultiNumberRow label={t("Rotation", "Rotation")} unit="°" value={rotation} step={5} compact
                onChange={(v) => patchVisual({ rotation: v })}
                scrub={scrubVisual((v) => (p, sel) => patchOne(p, sel, { rotation: v }))} />
            )}
            <MultiNumberRow label={t("Opacité", "Opacity")} unit="%" value={opacity} scale={100} step={5} min={0} max={100} compact
              onChange={(v) => patchVisual({ opacity: v / 100 })}
              scrub={scrubVisual((v) => (p, sel) => patchOne(p, sel, { opacity: v / 100 }))} />
          </div>

          {/* L'alignement pose une valeur ABSOLUE, identique pour tous — c'est
              précisément ce qu'on attend de « tout aligner à gauche ». */}
          <div className="flex flex-wrap items-center gap-1 text-2xs text-muted">
            <span className="w-20 shrink-0">{t("Aligner", "Align")}</span>
            <AlignButton label="⇤" title={t("À gauche", "Left")} onClick={() => patchVisual({ x: 0.05 })} />
            <AlignButton label="⇔" title={t("Centré", "Centre")} onClick={() => patchVisual({ x: 0.5 })} />
            <AlignButton label="⇥" title={t("À droite", "Right")} onClick={() => patchVisual({ x: 0.95 })} />
            <AlignButton label="⤒" title={t("En haut", "Top")} onClick={() => patchVisual({ y: 0.05 })} />
            <AlignButton label="⇕" title={t("Milieu", "Middle")} onClick={() => patchVisual({ y: 0.5 })} />
            <AlignButton label="⤓" title={t("En bas", "Bottom")} onClick={() => patchVisual({ y: 0.9 })} />
          </div>
        </Panel>
      )}

      {/* ── Texte — le lot de sous-titres d'une transcription ──────────────── */}
      {allTexts && (
        <Panel title={t("Texte", "Text")}>
          <SelectRow
            label={t("Police", "Font")}
            value={(sharedValue(texts.map((l) => l.font)) as TextLayer["font"] | undefined) ?? "sans"}
            options={Object.entries(FONT_STACKS).map(([key, f]) => ({ value: key, label: f.label }))}
            onChange={(v) => batchText({ font: v as TextLayer["font"] })}
          />
          <div className="grid grid-cols-2 gap-2">
            <MultiNumberRow label={t("Taille", "Size")} unit="%" scale={100} step={1} min={1} compact
              value={sharedValue(texts.map((l) => l.sizePct))}
              onChange={(v) => batchText({ sizePct: v / 100 })}
              scrub={scrubText((v) => ({ sizePct: v / 100 }))} />
            <MultiNumberRow label={t("Interligne", "Line height")} unit="×" step={0.05} min={0.5} compact
              value={sharedValue(texts.map((l) => l.lineHeight))}
              onChange={(v) => batchText({ lineHeight: v })}
              scrub={scrubText((v) => ({ lineHeight: v }))} />
            <MultiNumberRow label={t("Retour ligne", "Wrap")} unit="%" scale={100} step={5} min={0} max={100} compact
              value={sharedValue(texts.map((l) => l.wrapPct))}
              onChange={(v) => batchText({ wrapPct: v / 100 })}
              scrub={scrubText((v) => ({ wrapPct: v / 100 }))} />
          </div>
          <ColorSwatches
            value={(sharedValue(texts.map((l) => l.color)) as string | undefined) ?? PRESET_COLORS[0]}
            onChange={(c) => batchText({ color: c })}
            brand={brand}
          />
          <div className="flex flex-wrap items-center gap-1">
            <ToggleChip icon="𝐁" label={t("Gras", "Bold")} on={sharedValue(texts.map((l) => l.bold)) === true}
              onClick={() => batchText({ bold: sharedValue(texts.map((l) => l.bold)) !== true })} />
            <ToggleChip icon="▬" label={t("Bandeau", "Band")} on={sharedValue(texts.map((l) => l.bg)) === true}
              onClick={() => batchText({ bg: sharedValue(texts.map((l) => l.bg)) !== true })} />
            <ToggleChip icon="◌" label={t("Contour", "Outline")} on={sharedValue(texts.map((l) => l.outline)) === true}
              onClick={() => batchText({ outline: sharedValue(texts.map((l) => l.outline)) !== true })} />
            <ToggleChip icon="◍" label={t("Ombre", "Shadow")} on={sharedValue(texts.map((l) => l.shadow)) === true}
              onClick={() => batchText({ shadow: sharedValue(texts.map((l) => l.shadow)) !== true })} />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <ToggleChip
                key={a}
                on={sharedValue(texts.map((l) => l.align)) === a}
                icon={a === "left" ? "⯇" : a === "center" ? "≡" : "⯈"}
                label={a === "left" ? t("Gauche", "Left") : a === "center" ? t("Centre", "Centre") : t("Droite", "Right")}
                onClick={() => batchText({ align: a })}
              />
            ))}
          </div>
        </Panel>
      )}

      {/* ── Animations — un plan n'en a pas, le bloc l'exclut donc ─────────── */}
      {allLayers && (
        <Panel title={t("Animation", "Animation")}>
          <div className="grid grid-cols-2 gap-2">
            <SelectRow compact label={t("Entrée", "In")}
              value={(animIn as AnimationKind | undefined) ?? "none"}
              options={ANIMATIONS.map((a) => ({ value: a.key, label: t(a.fr, a.en) }))}
              onChange={(v) => patchVisual({ animIn: v as AnimationKind })} />
            <SelectRow compact label={t("Sortie", "Out")}
              value={(animOut as AnimationKind | undefined) ?? "none"}
              options={ANIMATIONS.map((a) => ({ value: a.key, label: t(a.fr, a.en) }))}
              onChange={(v) => patchVisual({ animOut: v as AnimationKind })} />
          </div>
          <p className="text-2xs text-muted">
            {t(`Durée fixe de ${ANIMATION_SECONDS} s.`, `Fixed duration of ${ANIMATION_SECONDS}s.`)}
          </p>
        </Panel>
      )}

      {/* ── Minutage et piste — communs à TOUS les types, son compris ──────── */}
      <Panel title={t("Minutage et piste", "Timing and track")}>
        <div className="flex flex-wrap items-center gap-1 text-2xs text-muted">
          <span className="w-20 shrink-0">{t("Décaler", "Offset")}</span>
          {[-1, -0.1, 0.1, 1].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => nudge(d)}
              className="rounded px-1.5 py-0.5 tabular-nums ring-1 ring-hair hover:text-ink"
            >
              {d > 0 ? `+${d}` : d} s
            </button>
          ))}
        </div>
        {(allVisual || allAudio) && (
          <TrackPicker
            project={project}
            family={allAudio ? "audio" : "visual"}
            value={typeof track === "string" ? track : ""}
            onChange={(trackId) => batch((p, sel) => moveElement(p, { kind: sel.kind, id: sel.id }, { trackId }))}
          />
        )}
        <p className="text-2xs text-muted">
          {t(
            `Film de ${total.toFixed(1)} s. Le décalage conserve les écarts entre les éléments du groupe.`,
            `${total.toFixed(1)}s film. The offset preserves the gaps between the elements of the group.`
          )}
        </p>
      </Panel>
    </div>
  );
}

/**
 * Champ numérique d'une sélection multiple. `MIXED` s'affiche VIDE, avec un
 * tiret en filigrane : montrer la valeur du premier élément laisserait croire
 * que tout le groupe la partage. `scale` évite de convertir de part et
 * d'autre (0..1 dans le modèle, pourcentage à l'écran).
 */
function MultiNumberRow({
  label, unit, value, scale = 1, step, min, max, compact, onChange, scrub,
}: {
  label: string;
  unit: string;
  value: Shared<number>;
  scale?: number;
  step: number;
  min?: number;
  max?: number;
  compact?: boolean;
  onChange: (v: number) => void;
  scrub?: { begin: () => void; live: (v: number) => void; commit: () => void };
}) {
  const t = useT();
  const mixed = value === MIXED || value === undefined;
  // Une valeur MIXTE part de zéro : il n'y a pas de valeur commune d'où
  // partir, et le glisser vaut alors comme une saisie — il uniformise.
  const { scrubbing, handlers } = useValueScrubber({
    value: mixed ? 0 : (value as number) * scale,
    step, min, max,
    onScrub: (v) => (scrub ? scrub.live(v) : onChange(v)),
    onStart: () => scrub?.begin(),
    onEnd: () => scrub?.commit(),
  });
  return (
    <label className={`flex items-center gap-1.5 text-2xs text-muted ${compact ? "" : "w-full"}`}>
      <span className={compact ? "w-14 shrink-0" : "w-20 shrink-0"}>{label}</span>
      <input
        type="number"
        value={mixed ? "" : Math.round((value as number) * scale * 100) / 100}
        placeholder={mixed ? "—" : undefined}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v)) onChange(v);
        }}
        {...(scrub ? handlers : {})}
        title={scrub
          ? t("Tirez à gauche ou à droite pour ajuster tout le groupe", "Drag left or right to adjust the whole group")
          : undefined}
        className={`w-full min-w-0 ${SCRUB_INPUT} ${scrub ? "" : "cursor-text"} ${scrubbing ? "select-none ring-1 ring-page" : ""}`}
      />
      <span className="shrink-0">{unit}</span>
    </label>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    // `min-w-0` + `overflow-hidden` : un enfant en `flex` peut sinon imposer sa
    // largeur intrinsèque et déborder du cadre, ce qui se voyait sur les
    // libellés longs et la rangée de pastilles de couleur.
    <div className="min-w-0 space-y-2 overflow-hidden rounded-lg border border-hair p-3">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

/**
 * `title` explique un symbole autrement indéchiffrable — G, ▬, ◌, ◍, les
 * flèches d'alignement de texte… Sans lui, ces boutons ne portaient AUCUNE
 * explication, ni infobulle ni lecteur d'écran (audit Editing Bench, P3-1).
 * Optionnel : un bouton déjà libellé en toutes lettres (« Remplir », etc.)
 * n'en a pas besoin.
 */
/**
 * Bascule LIBELLÉE. Les symboles seuls — G, ▬, ◌, ◍ — n'étaient déchiffrables
 * qu'en cliquant pour voir ce qui change : une infobulle ne se lit qu'au
 * survol, et jamais sur un écran tactile. Le mot tient dans la largeur du
 * panneau dès qu'on laisse les puces passer à la ligne.
 */
function ToggleChip({
  on, onClick, icon, label, title,
}: {
  on: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title ?? label}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-none ${
        on ? "bg-page text-white" : "text-muted ring-1 ring-hair hover:text-ink"
      }`}
    >
      <span aria-hidden className="text-[11px]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Toggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={title} aria-label={title}
      className={`h-5 min-w-[1.25rem] rounded px-1 text-2xs font-bold ${on ? "bg-page text-white" : "text-muted ring-1 ring-hair"}`}>
      {children}
    </button>
  );
}

/**
 * Palette de couleurs — préréglages ET couleur libre.
 *
 * Les préréglages (blanc, noir, quelques teintes vives, la palette de marque)
 * couvrent le cas courant d'un geste, mais restaient les 10 SEULES couleurs
 * atteignables : une teinte de marque hors palette, ou un simple ajustement
 * fin, n'avaient nulle part où se poser (audit Editing Bench, P2-12). Le
 * sélecteur natif ferme cette impasse sans réinventer un choisisseur de
 * couleur — le navigateur en fournit déjà un, complet et accessible.
 */
function ColorSwatches({
  value, onChange, brand, before,
}: {
  value: string;
  onChange: (c: string) => void;
  brand: BrandStyle;
  /** Bouton(s) supplémentaire(s) affiché(s) avant les préréglages — ex. « aucun contour ». */
  before?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {before}
      {[...PRESET_COLORS, ...brand.palette].slice(0, 10).map((c, i) => (
        <button key={`${c}-${i}`} type="button" aria-label={c} title={c}
          onClick={() => onChange(c)}
          className={`h-5 w-5 shrink-0 rounded-full ring-1 ring-hair ${value === c ? "ring-2 ring-page" : ""}`}
          style={{ background: c }} />
      ))}
      <label
        className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[length:8px_8px] bg-[linear-gradient(45deg,transparent_45%,rgb(var(--color-hair))_45%,rgb(var(--color-hair))_55%,transparent_55%)] text-[10px] leading-none text-muted ring-1 ring-hair"
        title={t("Couleur personnalisée", "Custom color")}
      >
        +
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t("Couleur personnalisée", "Custom color")}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
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
  // Étiquette et valeur SUR LEUR PROPRE LIGNE, curseur en dessous. Sur une
  // seule ligne, une étiquette fixée à 80 px et une valeur à 40 px ne
  // laissaient presque rien au curseur dans une colonne de 300 px, et un
  // libellé un peu long débordait de son cadre (« Largeur de bloc … libre »).
  return (
    <label className="block space-y-0.5 text-2xs text-muted">
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate" title={label}>{label}</span>
        <span className="shrink-0 tabular-nums text-ink">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-page" />
    </label>
  );
}

/**
 * Saisie numérique — l'audit relevait qu'aucune propriété ne s'entrait au
 * clavier : tout passait par un curseur ou un glisser, donc à l'estime.
 */
function NumberRow({
  label, unit, value, step, min, max, compact, onChange, autoLabel, scrub,
}: {
  label: string; unit: string; value: number; step: number;
  min?: number; max?: number; compact?: boolean;
  onChange: (v: number) => void;
  /**
   * Ajustement au glisser. Absent, le champ reste une simple saisie — c'est le
   * cas des valeurs qu'on ne cherche PAS par essais (un instant précis en
   * secondes), où tirer à la souris n'apporterait rien.
   */
  scrub?: { begin: () => void; live: (v: number) => void; commit: () => void };
  /**
   * Si fourni, une valeur de 0 affiche ce texte en filigrane plutôt que le
   * chiffre « 0 » — pour un champ où 0 signifie « valeur déduite », pas une
   * dimension réellement nulle (ex. hauteur d'incrustation : project.ts,
   * heightPct: 0 = déduite du rapport natif de l'image). Sans ça, le champ
   * se lisait comme si l'élément avait été aplati à zéro (audit Editing
   * Bench, P1-11).
   */
  autoLabel?: string;
}) {
  const isAuto = autoLabel !== undefined && value === 0;
  const t = useT();
  const { scrubbing, handlers } = useValueScrubber({
    value, step, min, max,
    onScrub: (v) => (scrub ? scrub.live(v) : onChange(v)),
    onStart: () => scrub?.begin(),
    onEnd: () => scrub?.commit(),
  });
  return (
    <label className={`flex items-center gap-1.5 text-2xs text-muted ${compact ? "" : "w-full"}`}>
      <span className={`truncate ${compact ? "w-14 shrink-0" : "w-20 shrink-0"}`} title={label}>{label}</span>
      <input
        type="number"
        value={isAuto ? "" : Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        placeholder={isAuto ? autoLabel : undefined}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        {...(scrub ? handlers : {})}
        title={scrub
          ? t("Tirez à gauche ou à droite pour ajuster · Maj pour affiner · cliquez pour saisir",
              "Drag left or right to adjust · Shift to fine-tune · click to type")
          : undefined}
        // Les flèches natives d'incrément consomment à elles seules ~16 px —
        // dans une colonne de 300 px partagée en deux, il ne restait presque
        // plus de place pour le CHIFFRE : une opacité de 100 % s'affichait
        // tronquée en « 10 » (valeur réelle correcte, seul l'affichage était
        // en cause — audit Editing Bench, P1-12).
        className={`w-full min-w-0 ${SCRUB_INPUT} ${scrub ? "" : "cursor-text"} ${scrubbing ? "select-none ring-1 ring-page" : ""}`}
      />
      <span className="shrink-0">{unit}</span>
    </label>
  );
}

/**
 * Sélecteur de piste, partagé par les cinq types d'éléments (Lot A2, audit
 * Editing Bench v4) — jusqu'ici réservé aux plans, et limité à trois options
 * codées en dur ([0,1,2]) indépendamment du nombre de pistes réellement
 * posées. Même numérotation que la timeline (V1, V2… / A1, A2…), lue
 * directement dans `project.tracks` plutôt que recalculée ici.
 */
function TrackPicker({
  project, family, value, onChange,
}: {
  project: EditorProject;
  family: TrackFamily;
  value: string;
  onChange: (trackId: string) => void;
}) {
  const t = useT();
  const tracks = (project.tracks ?? []).filter((tr) => tr.family === family);
  const prefix = family === "visual" ? "V" : "A";
  return (
    <SelectRow
      label={t("Piste", "Track")}
      value={value}
      options={tracks.map((tr, i) => ({ value: tr.id, label: `${prefix}${i + 1}` }))}
      onChange={onChange}
    />
  );
}

function SelectRow({
  label, value, options, onChange, compact,
}: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  /**
   * Même défaut que NumberRow : une étiquette fixée à 80 px (w-20) ne pose
   * aucun problème seule sur une ligne pleine largeur, mais dans une grille à
   * deux colonnes de 300 px (ex. Entrée / Sortie d'une animation), elle ne
   * laissait presque plus de place au `<select>` — la valeur choisie
   * (« Fondu », « Glisse ↑ »…) devenait invisible, réduite à la seule flèche
   * (audit Editing Bench, P1-10 — même cause que P1-12).
   */
  compact?: boolean;
}) {
  return (
    <label className={`flex items-center gap-1.5 text-2xs text-muted ${compact ? "" : "gap-2"}`}>
      <span className={`truncate ${compact ? "w-12 shrink-0" : "w-20 shrink-0"}`} title={label}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input min-w-0 flex-1 py-0.5 text-2xs">
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
