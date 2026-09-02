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
  setClipBox,
  setClipFraming,
  setClipLength,
  setClipOpacity,
  setClipSpeed,
  setClipTransition,
  updateAudio,
  updateImageLayer,
  updateShape,
  updateText,
  type AnimationKind,
  type EditorProject,
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
    const allTexts = multiSelectionItems.every((s) => s.kind === "text");
    if (!allTexts) {
      return (
        <div className="space-y-2 p-2 text-2xs text-muted">
          <p>
            {t(`${multiSelectionItems.length} éléments sélectionnés.`, `${multiSelectionItems.length} elements selected.`)}
          </p>
          <p>
            {t(
              "Utilisez Dupliquer ou Supprimer (barre d'outils, clic droit, ou Ctrl/⌘+D et Suppr) pour agir sur le groupe entier.",
              "Use Duplicate or Delete (toolbar, right-click, or Ctrl/⌘+D and Delete) to act on the whole group."
            )}
          </p>
        </div>
      );
    }

    const textIds = multiSelectionItems.map((s) => s.id);
    /** Applique un patch commun à TOUS les textes du groupe, en une seule
        entrée d'historique — jamais une par élément reformaté. */
    const batchText = (patch: Partial<TextLayer>) =>
      onChange((p) => textIds.reduce((acc, id) => updateText(acc, id, patch), p));
    const first = project.texts.find((l) => l.id === textIds[0]);

    return (
      <Panel title={t(`${textIds.length} sous-titres sélectionnés`, `${textIds.length} subtitles selected`)}>
        <p className="text-2xs text-muted">
          {t(
            "Réglage commun à tout le groupe — utile après une transcription automatique. Dupliquer/Supprimer (barre d'outils, clic droit) agissent aussi sur le groupe entier.",
            "Setting applied to the whole group — useful right after an automatic transcription. Duplicate/Delete (toolbar, right-click) also act on the whole group."
          )}
        </p>
        <SelectRow
          label={t("Police", "Font")} value={first?.font ?? "sans"}
          options={Object.entries(FONT_STACKS).map(([key, f]) => ({ value: key, label: f.label }))}
          onChange={(v) => batchText({ font: v as TextLayer["font"] })}
        />
        <ColorSwatches value={first?.color ?? PRESET_COLORS[0]} onChange={(c) => batchText({ color: c })} brand={brand} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Toggle title={t("Gras", "Bold")} on={Boolean(first?.bold)} onClick={() => batchText({ bold: !first?.bold })}>G</Toggle>
          <Toggle title={t("Bandeau", "Background band")} on={Boolean(first?.bg)} onClick={() => batchText({ bg: !first?.bg })}>▬</Toggle>
          <Toggle title={t("Contour", "Outline")} on={Boolean(first?.outline)} onClick={() => batchText({ outline: !first?.outline })}>◌</Toggle>
          <Toggle title={t("Ombre", "Shadow")} on={Boolean(first?.shadow)} onClick={() => batchText({ shadow: !first?.shadow })}>◍</Toggle>
        </div>
      </Panel>
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

          {clip.track > 0 && (
            <>
              {/* Cadre — position et taille de la FENÊTRE d'incrustation,
                  distinct du recadrage ci-dessus qui règle ce que la source
                  montre À L'INTÉRIEUR de cette fenêtre. Plein cadre par
                  défaut : sans ce bloc, une incrustation vidéo ne pouvait pas
                  se poser en petite fenêtre dans un coin — seulement en plein
                  écran (audit Editing Bench, P2-1). Comme l'opacité
                  ci-dessous, sans usage réel sur la piste de base. */}
              <div className="grid grid-cols-2 gap-2">
                <NumberRow label="X" unit="%" value={clip.x * 100} step={1} compact
                  onChange={(v) => onChange((p) => setClipBox(p, clip.id, { x: v / 100 }))} />
                <NumberRow label="Y" unit="%" value={clip.y * 100} step={1} compact
                  onChange={(v) => onChange((p) => setClipBox(p, clip.id, { y: v / 100 }))} />
                <NumberRow label={t("Largeur", "Width")} unit="%" value={clip.w * 100} step={1} min={2} compact
                  onChange={(v) => onChange((p) => setClipBox(p, clip.id, { w: v / 100 }))} />
                <NumberRow label={t("Hauteur", "Height")} unit="%" value={clip.h * 100} step={1} min={2} compact
                  onChange={(v) => onChange((p) => setClipBox(p, clip.id, { h: v / 100 }))} />
              </div>
              {/* L'opacité d'un plan n'a d'usage réel que sur une piste
                  d'incrustation — la piste de base couvre déjà tout le
                  cadre, la faire disparaître en fondu ne ferait qu'exposer
                  du noir en dessous (audit Editing Bench, P2-1 / P2-2). */}
              <NumberRow
                label={t("Opacité", "Opacity")} unit="%" value={clip.opacity * 100} step={5} min={0} max={100}
                onChange={(v) => onChange((p) => setClipOpacity(p, clip.id, v / 100))}
              />
            </>
          )}

          <SelectRow
            label={t("Piste", "Track")}
            value={String(clip.track)}
            // Même nommage que la timeline (Timeline.tsx) — qui appelait la
            // même piste « Vidéo 2 » quand ce menu disait « Superposée 1 »
            // pour LE MÊME numéro de piste (audit Editing Bench, P3-3).
            options={[0, 1, 2].map((n) => ({ value: String(n), label: n === 0 ? t("Vidéo", "Video") : `${t("Vidéo", "Video")} ${n + 1}` }))}
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
                  autoLabel={t("auto", "auto")}
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
          <div className="flex flex-wrap items-center gap-1.5">
            <Toggle title={t("Gras", "Bold")} on={text.bold} onClick={() => onChange((p) => updateText(p, text.id, { bold: !text.bold }))}>G</Toggle>
            <Toggle title={t("Bandeau", "Background band")} on={text.bg} onClick={() => onChange((p) => updateText(p, text.id, { bg: !text.bg }))}>▬</Toggle>
            <Toggle title={t("Contour", "Outline")} on={text.outline} onClick={() => onChange((p) => updateText(p, text.id, { outline: !text.outline }))}>◌</Toggle>
            <Toggle title={t("Ombre", "Shadow")} on={text.shadow} onClick={() => onChange((p) => updateText(p, text.id, { shadow: !text.shadow }))}>◍</Toggle>
            {(["left", "center", "right"] as const).map((a) => (
              <Toggle
                key={a} on={text.align === a}
                title={a === "left" ? t("Aligné à gauche", "Left-aligned") : a === "center" ? t("Centré", "Centered") : t("Aligné à droite", "Right-aligned")}
                onClick={() => onChange((p) => updateText(p, text.id, { align: a }))}
              >
                {a === "left" ? "⯇" : a === "center" ? "≡" : "⯈"}
              </Toggle>
            ))}
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
          <Toggle
            title={audio.muted ? t("Muet — cliquer pour réactiver", "Muted — click to unmute") : t("Audible — cliquer pour couper", "Audible — click to mute")}
            on={audio.muted} onClick={() => onChange((p) => updateAudio(p, audio.id, { muted: !audio.muted }))}
          >
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

const centerX = (w?: number) => (w ? (1 - w) / 2 : 0.5 - 0.2);
const rightX = (w?: number) => (w ? 0.95 - w : 0.75);
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

/**
 * `title` explique un symbole autrement indéchiffrable — G, ▬, ◌, ◍, les
 * flèches d'alignement de texte… Sans lui, ces boutons ne portaient AUCUNE
 * explication, ni infobulle ni lecteur d'écran (audit Editing Bench, P3-1).
 * Optionnel : un bouton déjà libellé en toutes lettres (« Remplir », etc.)
 * n'en a pas besoin.
 */
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
          className={`h-5 w-5 rounded-full ring-1 ring-hair ${value === c ? "ring-2 ring-page" : ""}`}
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
  label, unit, value, step, min, max, compact, onChange, autoLabel,
}: {
  label: string; unit: string; value: number; step: number;
  min?: number; max?: number; compact?: boolean;
  onChange: (v: number) => void;
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
  return (
    <label className={`flex items-center gap-1.5 text-2xs text-muted ${compact ? "" : "w-full"}`}>
      <span className={compact ? "w-14 shrink-0" : "w-20 shrink-0"}>{label}</span>
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
        // Les flèches natives d'incrément consomment à elles seules ~16 px —
        // dans une colonne de 300 px partagée en deux, il ne restait presque
        // plus de place pour le CHIFFRE : une opacité de 100 % s'affichait
        // tronquée en « 10 » (valeur réelle correcte, seul l'affichage était
        // en cause — audit Editing Bench, P1-12).
        className="w-full min-w-0 rounded-md border border-hair bg-transparent px-1 py-0.5 text-right tabular-nums text-ink placeholder:text-muted placeholder:italic [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="shrink-0">{unit}</span>
    </label>
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
      <span className={compact ? "w-12 shrink-0" : "w-20 shrink-0"}>{label}</span>
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
