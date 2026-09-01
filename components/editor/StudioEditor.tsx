"use client";

// Banc de montage — l'éditeur complet.
//
// Il ne détient AUCUNE logique de montage : il orchestre un document de projet
// (lib/editor/project.ts), une pile d'historique (lib/editor/history.ts) et deux
// projections de rendu (lib/editor/render-plan.ts) — tous purs et testés.
// Ce composant se contente de câbler des gestes sur des opérations.
//
// UNE DISPOSITION D'ÉDITEUR, PLUS UNE MODALE DE FORMULAIRE
// La version précédente vivait dans une fenêtre de 1 152 pixels au maximum, dont
// le contenu défilait d'un bloc : sur un écran de 1 920 pixels, 40 % de la
// largeur était perdue et la timeline passait sous la ligne de flottaison dès
// qu'un panneau s'ouvrait. Ici, trois zones à défilement indépendant occupent
// tout l'écran et la timeline reste ancrée en bas, toujours visible.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import { hostMedia, MAX_UPLOAD_BYTES, formatSize } from "@/lib/media/host";
import {
  addAudio, addButton, addClip, addImageLayer, addShape, addText, duplicateAudio,
  duplicateClip, duplicateImageLayer, duplicateShape, duplicateText,
  emptyProject, FORMAT_SIZE, moveClip, moveLayerTime, projectDuration, removeAudio,
  removeClip, removeImageLayer, removeShape, removeText, setClipFraming, setClipLength,
  setClipSpeed, setClipTransition, setTrackMeta, shapesAt, splitAt, splitAudioAt, splitLayerAt,
  trimClip, trimLayer,
  updateAudio, updateImageLayer, updateShape, updateText, usedTracks, visibleProject,
  type AnimationKind, type EditorFormat, type EditorProject, type ShapeKind,
  type TimedLayerKind, type TransitionKind, type VisualLayer,
} from "@/lib/editor/project";
import {
  applyTemplate, brandStyleFrom, rescaleTextsForFormat, TEMPLATES, type BrandStyle,
} from "@/lib/editor/templates";
import {
  canRedo, canUndo, commitGesture as commitGestureHistory, initHistory, push, redo,
  replacePresent, undo, type History,
} from "@/lib/editor/history";
import { browserOverlays, decideRenderTarget, toBrowserPlan, type OverlayInput } from "@/lib/editor/render-plan";
import { drawImages, drawShapes, drawTexts, ensureFontsReady, FONT_STACKS, loadImage } from "@/lib/editor/draw";
import { Timeline, type TimelineSelection } from "./Timeline";
import { Preview, type LayerPatch } from "./Preview";
import { ProjectLibrary } from "./ProjectLibrary";
import { TemplateGallery } from "./TemplateGallery";
import { AssetLibrary, type AcquiredAsset } from "./AssetLibrary";
import type { AssetKind } from "@/lib/assets/types";
import { PropertyPanel } from "./PropertyPanel";
import { Tooltip } from "./Tooltip";
import { ShortcutsPanel } from "./ShortcutsPanel";
import type { UploadedMedia } from "@/components/ui/MediaUpload";

const FORMATS: EditorFormat[] = ["9:16", "1:1", "4:5", "16:9"];
const SHAPES: { kind: ShapeKind; glyph: string; fr: string; en: string }[] = [
  { kind: "rect", glyph: "▭", fr: "Bandeau", en: "Bar" },
  { kind: "round", glyph: "▢", fr: "Pastille", en: "Pill" },
  { kind: "ellipse", glyph: "◯", fr: "Cercle", en: "Circle" },
  { kind: "line", glyph: "─", fr: "Trait", en: "Line" },
  { kind: "arrow", glyph: "➜", fr: "Flèche", en: "Arrow" },
];

/** Compteur d'identifiants, stable pour une session d'édition. */
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1).toString(36)}-${Date.now().toString(36)}`;

export function StudioEditor({
  companyId,
  initialMedia,
  projectId,
  onExport,
  onClose,
}: {
  companyId: string;
  /** Média déjà importé dans le composeur — devient le premier plan. */
  initialMedia?: UploadedMedia;
  /** Projet existant à reprendre. */
  projectId?: string;
  onExport: (m: UploadedMedia) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [history, setHistory] = useState<History>(() => initHistory(emptyProject(companyId, "draft")));
  const project = history.present;

  const [savedId, setSavedId] = useState<string | undefined>(projectId);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selection, setSelection] = useState<TimelineSelection>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** Verrouille le montage pendant un export — voir exportProject. */
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [brand, setBrand] = useState<BrandStyle>(() => brandStyleFrom(null));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tool, setTool] = useState<"media" | "templates" | "shapes" | "library">("media");
  /** Poids cumulé des sources — décide du moteur de rendu. */
  const sourceBytes = useRef(0);
  const lang: "fr" | "en" = t("fr", "en") === "en" ? "en" : "fr";

  /**
   * Portail vers <body> — la cause racine du confinement (itération 3, §4.1d).
   * La page Compose enveloppe tout son contenu dans `.animate-fade-in`, dont
   * l'animation `both` laisse un `transform: translateY(0)` en place après son
   * exécution. Un ancêtre transformé crée un nouveau bloc de référence : le
   * `fixed inset-0` de l'éditeur se résolvait alors sur CETTE boîte au lieu de
   * la fenêtre, d'où l'obligation de défiler pour atteindre la timeline. Même
   * fix que Modal.tsx et HelpDrawer.tsx pour ce dépôt.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── Confinement : le document ne défile plus tant que l'éditeur est ouvert,
     et Ctrl+molette n'y déclenche jamais le zoom du navigateur (§4.1a, §4.2). */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function blockBrowserZoom(e: WheelEvent) {
      if (e.ctrlKey) e.preventDefault();
    }
    window.addEventListener("wheel", blockBrowserZoom, { passive: false });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("wheel", blockBrowserZoom);
    };
  }, []);

  /** Applique une opération de montage en l'inscrivant dans l'historique. */
  const apply = useCallback((fn: (p: EditorProject) => EditorProject) => {
    setHistory((h) => push(h, fn(h.present)));
  }, []);

  /**
   * Historique groupé par GESTE, pas par tic de pointeur (itération 3,
   * chapitre 9, point 3 ; Lot 2) — `replacePresent`/`commitGesture` sont des
   * fonctions pures de lib/editor/history.ts. `beginGesture` capture l'état
   * d'avant le geste ; chaque tic de glissement appelle `applyLive`, qui ne
   * crée AUCUNE entrée ; `commitGesture`, au relâchement, insère l'état de
   * départ une seule fois dans le passé. Une annulation défait alors le geste
   * entier, jamais un pixel à la fois.
   */
  const gestureBaseline = useRef<EditorProject | null>(null);
  const beginGesture = useCallback(() => {
    setHistory((h) => { gestureBaseline.current = h.present; return h; });
  }, []);
  const applyLive = useCallback((fn: (p: EditorProject) => EditorProject) => {
    setHistory((h) => replacePresent(h, fn(h.present)));
  }, []);
  const commitGesture = useCallback(() => {
    setHistory((h) => {
      const baseline = gestureBaseline.current;
      gestureBaseline.current = null;
      return baseline ? commitGestureHistory(h, baseline) : h;
    });
  }, []);

  const duration = projectDuration(project);

  /**
   * Change le format de publication. Les textes sont retransposés : leur taille
   * est stockée en fraction de HAUTEUR, qui ne veut pas dire la même chose d'un
   * cadre à l'autre — sans cela, un titre réglé en 9:16 devenait minuscule en
   * 16:9. Le média source, lui, n'est pas touché : le cadrage est une intention.
   */
  const changeFormat = useCallback((format: EditorFormat) => {
    apply((p) => (p.format === format ? p : rescaleTextsForFormat({ ...p, format }, p.format)));
  }, [apply]);

  /* ── Identité de marque ────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    fetch(`/api/brand-kit?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setBrand(brandStyleFrom(d?.kit ?? null)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [companyId]);

  /* ── Reprise d'un projet existant ──────────────────────────────────────── */
  const openProject = useCallback((id: string) => {
    setLoading(true);
    setLibraryOpen(false);
    setSelection(null);
    setPlayhead(0);
    fetch(`/api/editor/projects?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.project?.doc) return;
        setHistory(initHistory(d.project.doc as EditorProject));
        setSavedId(d.project.id as string);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    fetch(`/api/editor/projects?id=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.project?.doc) return;
        setHistory(initHistory(d.project.doc as EditorProject));
        setSavedId(d.project.id);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [projectId]);

  /* ── Premier plan depuis le média du composeur ─────────────────────────── */
  useEffect(() => {
    if (projectId || !initialMedia) return;
    sourceBytes.current = initialMedia.size;
    // La durée d'une vidéo n'est connue qu'après lecture des métadonnées.
    if (initialMedia.kind === "video") {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        setHistory((h) =>
          push(h, addClip(h.present, {
            id: nextId("c"), src: initialMedia.url, kind: "video",
            sourceDuration: Number.isFinite(probe.duration) ? probe.duration : 0,
          }))
        );
      };
      probe.src = initialMedia.url;
      return;
    }
    setHistory((h) => push(h, addClip(h.present, { id: nextId("c"), src: initialMedia.url, kind: "image" })));
  }, [initialMedia, projectId]);

  /* ── Enregistrement automatique + à la demande (Ctrl+S) ────────────────── */
  const dirty = useRef(false);
  useEffect(() => { dirty.current = true; }, [project]);

  const saveNow = useCallback(async () => {
    if (project.clips.length === 0) return;
    dirty.current = false;
    const res = await fetch("/api/editor/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, id: savedId, doc: project, name: project.name }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (res?.project?.id && !savedId) setSavedId(res.project.id as string);
  }, [project, companyId, savedId]);

  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      if (dirty.current) void saveNow();
    }, 10_000);
    return () => clearInterval(timer);
  }, [loading, saveNow]);

  /**
   * Avertissement à la fermeture de l'onglet si des modifications ne sont pas
   * encore enregistrées — l'enregistrement automatique tourne toutes les 10 s,
   * fermer juste après une modification perdait le travail sans le moindre
   * message (itération 3, chapitre 9, point 5).
   */
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /**
   * Raccourcis clavier (itération 3, chapitre 6).
   *
   * Un ref tient l'état courant : l'écouteur n'est posé qu'UNE fois au montage
   * — le raccourcir à `[apply, playhead]` comme avant le rattachait à chaque
   * frappe et rendait la barre d'espace difficile à garder cohérente avec le
   * focus (§6.1, piège n°2).
   */
  const kb = useRef({ playhead, duration, selection, apply, saveNow, playing, shortcutsOpen, exporting });
  kb.current = { playhead, duration, selection, apply, saveNow, playing, shortcutsOpen, exporting };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Jamais pendant une saisie de texte — le garde existant, étendu au
      // contenu éditable (§6.1, piège n°1).
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;

      const {
        playhead: ph, duration: dur, selection: sel, apply: doApply, saveNow: doSave,
        playing: isPlaying, shortcutsOpen: refOpen, exporting: isExporting,
      } = kb.current;

      // Le montage est verrouillé pendant un export — seul Échap reste actif,
      // pour désélectionner sans rien modifier (chapitre 9, point 7).
      if (isExporting && e.key !== "Escape") return;
      // Panneau de référence ouvert : seuls Échap et ? restent actifs, pour ne
      // pas monter un plan ou supprimer une sélection par inadvertance pendant
      // la lecture de l'aide.
      if (refOpen && e.key !== "Escape" && e.key !== "?") return;
      const meta = e.metaKey || e.ctrlKey;
      const lower = e.key.toLowerCase();

      if (meta && lower === "z") {
        e.preventDefault();
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
        return;
      }
      if (meta && lower === "s") {
        // Neutralise l'enregistrement de page du navigateur (§6.1).
        e.preventDefault();
        void doSave();
        return;
      }
      if (meta && lower === "d") {
        // Neutralise le marque-page du navigateur (§6.1).
        e.preventDefault();
        if (!sel) return;
        if (sel.kind === "clip") doApply((p) => duplicateClip(p, sel.id, nextId("c")));
        else if (sel.kind === "text") doApply((p) => duplicateText(p, sel.id, nextId("t")));
        else if (sel.kind === "image") doApply((p) => duplicateImageLayer(p, sel.id, nextId("i")));
        else if (sel.kind === "shape") doApply((p) => duplicateShape(p, sel.id, nextId("s")));
        else doApply((p) => duplicateAudio(p, sel.id, nextId("a")));
        return;
      }
      if (meta) return; // autre combinaison Ctrl/Cmd : laissée au navigateur

      if (lower === "c" || lower === "s") {
        // C remplace S (alias silencieux conservé le temps de la transition).
        e.preventDefault();
        // Scinde l'élément SÉLECTIONNÉ (pas systématiquement un plan trouvé
        // par balayage du temps) — même correction que le bouton d'outil
        // (audit Editing Bench, P0-3).
        if (!sel) doApply((p) => splitAt(p, ph, () => nextId("c")));
        else if (sel.kind === "clip") doApply((p) => splitAt(p, ph, () => nextId("c"), sel.id));
        else if (sel.kind === "text") doApply((p) => splitLayerAt(p, "text", sel.id, ph, nextId("t")));
        else if (sel.kind === "image") doApply((p) => splitLayerAt(p, "image", sel.id, ph, nextId("i")));
        else if (sel.kind === "shape") doApply((p) => splitLayerAt(p, "shape", sel.id, ph, nextId("s")));
        else doApply((p) => splitAudioAt(p, sel.id, ph, nextId("a")));
        return;
      }
      if (e.key === " " || e.key === "Spacebar") {
        // Sans ce blur, la barre d'espace « rejoue » le bouton qui a le focus
        // au lieu de (dé)lancer la lecture (§6.1, piège n°2).
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        setPlaying(!isPlaying);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelection();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        // Pas de fréquence d'image stockée dans le document de projet : 1/30 s
        // est l'approximation la plus proche d'un « pas d'image ».
        const step = e.shiftKey ? 1 : 1 / 30;
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        setPlayhead((p) => Math.max(0, Math.min(dur, p + dir * step)));
        return;
      }
      if (e.key === "Home") { e.preventDefault(); setPlayhead(0); return; }
      if (e.key === "End") { e.preventDefault(); setPlayhead(dur); return; }
      if (e.key === "Escape") {
        // Ne ferme jamais l'éditeur — risque de perte de travail (§6.1).
        e.preventDefault();
        if (refOpen) setShortcutsOpen(false);
        else setSelection(null);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Import de médias ──────────────────────────────────────────────────── */
  const importFile = useCallback(
    async (file: File, as: "clip" | "music" | "voice" | "overlay") => {
      if (file.size > MAX_UPLOAD_BYTES) {
        setNote(t(
          `Fichier de ${formatSize(file.size)} — au-delà de ${formatSize(MAX_UPLOAD_BYTES)}, le montage dépasse la mémoire du navigateur.`,
          `File is ${formatSize(file.size)} — above ${formatSize(MAX_UPLOAD_BYTES)}, editing exceeds the browser's memory.`
        ));
        return;
      }
      setBusy(t("Hébergement du média…", "Hosting the media…"));
      const res = await hostMedia(companyId, file, file.name, "editor");
      setBusy(null);
      if (!res.url) {
        setNote(t(`Hébergement impossible (${res.error ?? "erreur"}).`, `Hosting failed (${res.error ?? "error"}).`));
        return;
      }
      sourceBytes.current += file.size;
      const url = res.url;

      if (as === "clip") {
        const kind = file.type.startsWith("video") ? "video" : "image";
        if (kind === "image") {
          apply((p) => addClip(p, { id: nextId("c"), src: url, kind: "image" }));
          return;
        }
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.onloadedmetadata = () =>
          apply((p) => addClip(p, {
            id: nextId("c"), src: url, kind: "video",
            sourceDuration: Number.isFinite(probe.duration) ? probe.duration : 0,
          }));
        probe.src = url;
        return;
      }
      if (as === "overlay") {
        apply((p) => addImageLayer(p, nextId("i"), url));
        return;
      }
      const probe = document.createElement("audio");
      probe.preload = "metadata";
      probe.onloadedmetadata = () =>
        apply((p) => addAudio(p, {
          id: nextId("a"), src: url, name: file.name, role: as,
          sourceDuration: Number.isFinite(probe.duration) ? probe.duration : 0,
        }));
      probe.src = url;
    },
    [apply, companyId, t]
  );

  /**
   * Insertion d'un média acquis depuis la bibliothèque externe (Lot A-3).
   * L'image rejoint la piste de base comme un plan — c'est là que la photo de
   * stock sert le plus souvent, contrairement à l'« Incrustation » du panneau
   * Médias (logo, pastille). La provenance est écrite dans le même geste,
   * jamais après (règle 4 de la mission bibliothèque).
   */
  const insertAsset = useCallback((kind: AssetKind, asset: AcquiredAsset) => {
    if (kind === "image") {
      apply((p) => addClip(p, { id: nextId("c"), src: asset.url, kind: "image", provenance: asset.provenance }));
      return;
    }
    if (kind === "video") {
      apply((p) => addClip(p, {
        id: nextId("c"), src: asset.url, kind: "video",
        sourceDuration: asset.durationSec ?? 0, provenance: asset.provenance,
      }));
      return;
    }
    apply((p) => addAudio(p, {
      id: nextId("a"), src: asset.url, name: t("Musique de la bibliothèque", "Library music"),
      role: "music", sourceDuration: asset.durationSec, provenance: asset.provenance,
    }));
  }, [apply, t]);

  /* ── Sous-titrage automatique ──────────────────────────────────────────── */
  const transcribe = useCallback(async () => {
    // On transcrit la voix off si elle existe, sinon le son du premier plan.
    const voice = project.audios.find((a) => a.role === "voice" && !a.muted);
    const source = voice?.src ?? project.clips.find((c) => c.track === 0 && c.kind === "video")?.src;
    if (!source) {
      setNote(t("Aucune piste parlée à transcrire.", "No spoken track to transcribe."));
      return;
    }
    setBusy(t("Transcription en cours…", "Transcribing…"));
    try {
      const res = await fetch("/api/editor/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, src: source, lang }),
      });
      const d = (await res.json().catch(() => ({}))) as { segments?: { start: number; end: number; text: string }[]; error?: string };
      if (!res.ok || !d.segments?.length) throw new Error(d.error ?? t("aucun segment", "no segment"));

      apply((p) => {
        let next = p;
        for (const seg of d.segments!) {
          const id = nextId("t");
          next = addText(next, id, seg.text);
          // Bandeau bas, lisible sur n'importe quel fond — la convention du
          // sous-titrage social.
          next = updateText(next, id, {
            x: 0.5, y: 0.78, align: "center", sizePct: 0.045,
            bg: true, bold: true, shadow: false, wrapPct: 0.86,
            start: seg.start, end: seg.end,
          });
        }
        return next;
      });
      setNote(t(`${d.segments.length} sous-titres posés — relisez-les avant publication.`,
        `${d.segments.length} subtitles added — proofread before publishing.`));
    } catch (e) {
      setNote(t("Transcription impossible : ", "Transcription failed: ") + (e instanceof Error ? e.message.slice(0, 140) : ""));
    } finally {
      setBusy(null);
    }
  }, [project.audios, project.clips, companyId, lang, apply, t]);

  /**
   * Le montage tel qu'on le voit et qu'on l'exporte : les pistes masquées en
   * sont retirées (chapitre 8.1). La timeline et le panneau de propriétés,
   * eux, continuent de travailler sur `project` en entier — masquer une piste
   * ne doit pas empêcher de la retrouver pour la démasquer.
   */
  const displayProject = useMemo(() => visibleProject(project), [project]);

  /* ── Export ────────────────────────────────────────────────────────────── */
  const decision = useMemo(() => decideRenderTarget(displayProject, sourceBytes.current), [displayProject]);

  /**
   * Compose un PNG PAR CALQUE.
   *
   * L'export ne composait qu'un seul calque, pris à la position de la tête de
   * lecture, puis le gravait sur tout le film : les bornes d'apparition
   * n'étaient pas respectées, et un texte hors de cette position était perdu
   * sans avertissement. Les incrustations d'image n'étaient jamais dessinées.
   */
  const buildOverlays = useCallback(async (): Promise<{ overlay: OverlayInput; bytes: Uint8Array }[]> => {
    const wanted = browserOverlays(project);
    if (wanted.length === 0) return [];
    const { width, height } = FORMAT_SIZE[project.format];

    const loaded = new Map<string, HTMLImageElement>();
    for (const src of new Set(project.images.map((l) => l.src))) {
      const img = await loadImage(src);
      if (img) loaded.set(src, img);
    }
    // Les polices doivent être PRÊTES avant le dessin : sans cela le canevas
    // retombe sur une police de secours et le fichier ne ressemble plus à
    // l'aperçu — une divergence qui ne produit aucune erreur.
    await ensureFontsReady(project.texts.map((l) => l.font));

    const out: { overlay: OverlayInput; bytes: Uint8Array }[] = [];
    for (const overlay of wanted) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      if (overlay.kind === "shape") {
        const l = project.shapes.find((s) => s.id === overlay.layerId);
        if (l) drawShapes(ctx, width, height, [l]);
      } else if (overlay.kind === "image") {
        const l = project.images.find((s) => s.id === overlay.layerId);
        if (l) drawImages(ctx, width, height, [l], loaded);
      } else {
        const l = project.texts.find((s) => s.id === overlay.layerId);
        if (l) drawTexts(ctx, width, height, [l]);
      }

      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) continue;
      out.push({ overlay, bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
    return out;
  }, [project]);

  const exportProject = useCallback(async () => {
    if (project.clips.length === 0) return;
    setNote(null);
    setProgress(0);
    // Verrouille le montage pour toute la durée du rendu — rien n'empêchait
    // jusqu'ici de continuer à monter pendant un export, et le résultat ne
    // correspondait alors plus à ce que l'écran affichait (itération 3,
    // chapitre 9, point 7).
    setExporting(true);

    // Rendu SERVEUR : le document part tel quel, l'onglet est libéré.
    if (decision.target === "server") {
      setBusy(t("Rendu sur nos serveurs…", "Rendering on our servers…"));
      try {
        // On transmet le DOCUMENT, pas une timeline déjà construite : c'est le
        // serveur qui en fait la projection. Le contrat porte ainsi sur une
        // structure qu'il sait valider, et la règle de rendu reste unique.
        const res = await fetch("/api/video/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, project: displayProject }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((d as { error?: string }).error ?? `HTTP ${res.status}`);
        setNote(t(
          "Rendu lancé sur nos serveurs — vous pouvez fermer cette fenêtre, le fichier vous attendra dans la médiathèque.",
          "Render started on our servers — you can close this window, the file will wait in your library."
        ));
      } catch (e) {
        setNote(t("Rendu serveur impossible : ", "Server render failed: ") + (e instanceof Error ? e.message.slice(0, 140) : ""));
      } finally {
        setBusy(null);
        setExporting(false);
      }
      return;
    }

    // Rendu NAVIGATEUR : gratuit, aucune donnée sortante.
    setBusy(t("Préparation du moteur vidéo…", "Loading video engine…"));
    try {
      const composed = await buildOverlays();
      const plan = toBrowserPlan(displayProject, composed.map((c) => c.overlay));

      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress: p }) => setProgress(Math.min(99, Math.round(p * 100))));
      let lastLog = "";
      ffmpeg.on("log", ({ message }) => { lastLog = message; });

      // Cœur ffmpeg servi par NOTRE origine : plus de dépendance à un CDN
      // tiers, ni de blocage derrière un pare-feu d'entreprise (audit A-09).
      const base = "/ffmpeg";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });

      setBusy(t("Rendu de la vidéo…", "Rendering video…"));
      const composedByName = new Map(composed.map((c) => [c.overlay.name, c.bytes]));
      for (const input of plan.inputs) {
        const bytes = composedByName.get(input.name);
        if (bytes) await ffmpeg.writeFile(input.name, bytes);
        else await ffmpeg.writeFile(input.name, await fetchFile(input.src));
      }

      // `exec` de ffmpeg.wasm : arguments passés en TABLEAU à un module
      // WebAssembly — aucun shell, donc aucune interpolation possible.
      const code = await ffmpeg.exec(plan.args);
      if (code !== 0) throw new Error(lastLog || `ffmpeg code ${code}`);
      const data = (await ffmpeg.readFile(plan.output)) as Uint8Array;
      if (!data?.length) throw new Error(lastLog || "sortie vide");
      const bytes = new Uint8Array(data.length);
      bytes.set(data);
      const blob = new Blob([bytes], { type: "video/mp4" });

      // Hébergement PUBLIC : une adresse blob: n'est pas publiable (A-06).
      setBusy(t("Hébergement du rendu…", "Hosting the render…"));
      const hosted = await hostMedia(companyId, blob, "montage.mp4", "edited");
      if (!hosted.url) {
        setNote(t(`Hébergement impossible (${hosted.error ?? "erreur"}). Le média n'a pas été remplacé.`, `Hosting failed (${hosted.error ?? "error"}). The media was not replaced.`));
        return;
      }

      // Le rendu est rattaché au projet : la bibliothèque peut le proposer sans
      // refaire un export, et on garde la trace de ce qu'a produit ce montage.
      await fetch("/api/editor/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, id: savedId, doc: project, name: project.name, renderUrl: hosted.url }),
      }).catch(() => null);

      onExport({ url: hosted.url, name: "montage.mp4", size: blob.size, kind: "video" });
      onClose();
    } catch (e) {
      setNote(t("Échec du rendu : ", "Render failed: ") + (e instanceof Error ? e.message.slice(0, 160) : ""));
    } finally {
      setBusy(null);
      setExporting(false);
    }
  }, [project, displayProject, decision.target, companyId, savedId, buildOverlays, onExport, onClose, t]);

  /**
   * Manipulation directe dans la zone de travail — glisser, redimensionner,
   * pivoter un calque. Même geste continu que dans la timeline : `applyLive`
   * pendant le glissement, une seule entrée d'historique à son relâchement
   * (chapitre 9, point 3).
   */
  const onLayerChange = useCallback((sel: NonNullable<TimelineSelection>, patch: LayerPatch) => {
    applyLive((p) => {
      const box: Partial<VisualLayer> = {};
      if (patch.x !== undefined) box.x = patch.x;
      if (patch.y !== undefined) box.y = patch.y;
      if (patch.rotation !== undefined) box.rotation = patch.rotation;

      if (sel.kind === "text") {
        return updateText(p, sel.id, { ...box, ...(patch.w !== undefined ? { wrapPct: patch.w } : {}) });
      }
      if (sel.kind === "image") {
        return updateImageLayer(p, sel.id, {
          ...box,
          ...(patch.w !== undefined ? { scale: patch.w } : {}),
          ...(patch.h !== undefined ? { heightPct: patch.h } : {}),
        });
      }
      if (sel.kind === "shape") {
        return updateShape(p, sel.id, {
          ...box,
          ...(patch.w !== undefined ? { w: patch.w } : {}),
          ...(patch.h !== undefined ? { h: patch.h } : {}),
        });
      }
      return p;
    });
  }, [applyLive]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-canvas">
      {/* En-tête */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-hair bg-card px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="shrink-0 text-sm font-semibold text-ink">🎬 {t("Banc de montage", "Editing bench")}</h3>
          <input
            value={project.name}
            onChange={(e) => apply((p) => ({ ...p, name: e.target.value }))}
            placeholder={t("Nom du montage", "Edit name")}
            aria-label={t("Nom du montage", "Edit name")}
            className="w-44 rounded-md border border-hair bg-transparent px-2 py-0.5 text-2xs text-ink placeholder:text-muted"
          />
          <span className="hidden text-2xs text-muted sm:inline">
            {duration.toFixed(1)}s · {project.clips.length} {t("plan(s)", "clip(s)")} · {usedTracks(project).length} {t("piste(s)", "track(s)")}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button" onClick={() => setLibraryOpen(true)}
            title={t("Mes montages", "My edits")} aria-label={t("Mes montages", "My edits")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink"
          >📁</button>
          <button
            type="button" onClick={() => setShortcutsOpen(true)}
            title={t("Raccourcis clavier (?)", "Keyboard shortcuts (?)")} aria-label={t("Raccourcis clavier", "Keyboard shortcuts")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink"
          >?</button>
          <button
            type="button" onClick={() => setHistory(undo)} disabled={!canUndo(history)}
            title={t("Annuler (Ctrl+Z)", "Undo (Ctrl+Z)")} aria-label={t("Annuler", "Undo")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink disabled:opacity-40"
          >↺</button>
          <button
            type="button" onClick={() => setHistory(redo)} disabled={!canRedo(history)}
            title={t("Rétablir (Ctrl+Maj+Z)", "Redo (Ctrl+Shift+Z)")} aria-label={t("Rétablir", "Redo")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted ring-1 ring-hair hover:text-ink disabled:opacity-40"
          >↻</button>
          <div className="mx-1 inline-flex rounded-lg border border-hair p-0.5">
            {FORMATS.map((f) => (
              <button
                key={f} type="button"
                onClick={() => changeFormat(f)}
                className={`rounded-md px-2 py-0.5 text-2xs font-semibold ${project.format === f ? "bg-page text-white" : "text-muted hover:text-ink"}`}
              >{f}</button>
            ))}
          </div>
          <button
            type="button" onClick={exportProject}
            disabled={Boolean(busy) || project.clips.length === 0}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {t("Exporter", "Export")}
          </button>
          <button type="button" onClick={onClose} className="px-1 text-muted hover:text-ink" aria-label={t("Fermer", "Close")}>✕</button>
        </div>
      </header>

      {/* Repli explicite sous le seuil large : les colonnes Outils et
          Propriétés se cachent en dessous de 1024 px (`lg`) faute de place —
          la fenêtre disparaissait alors silencieusement, sans que rien
          n'explique pourquoi certains réglages devenaient inaccessibles
          (itération 3, chapitre 9, point 12). */}
      <p className="shrink-0 border-b border-hair bg-warning-50 px-4 py-1.5 text-2xs text-warning-700 lg:hidden">
        {t(
          "Fenêtre trop étroite pour les outils et les propriétés — agrandissez-la (1024 px ou plus) pour y accéder.",
          "Window too narrow for the tools and properties panels — widen it (1024px or more) to reach them."
        )}
      </p>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted">
          <Spinner size={16} className="text-page" /> {t("Chargement du projet…", "Loading project…")}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Trois zones à défilement INDÉPENDANT — largeurs fixes, jamais de
              redimensionnement au gré du contenu ou d'une sélection (loi 4). */}
          <div className="grid min-h-[320px] flex-1 grid-cols-1 lg:grid-cols-[240px_1fr_300px]">
            {/* Colonne gauche : outils */}
            <aside className="hidden min-h-0 flex-col overflow-y-auto overscroll-contain border-r border-hair bg-card p-3 lg:flex">
              {/* Grille 2×2, pas la rangée simple des autres `.studio-seg` :
                  « Bibliothèque » ne tient pas sur quatre colonnes égales à
                  cette largeur de panneau (240 px) sans se couper au clic. */}
              <div className="studio-seg mb-3 grid grid-cols-2">
                <button type="button" data-active={tool === "media"} onClick={() => setTool("media")} className="studio-seg-btn">{t("Médias", "Media")}</button>
                <button type="button" data-active={tool === "templates"} onClick={() => setTool("templates")} className="studio-seg-btn">{t("Modèles", "Templates")}</button>
                <button type="button" data-active={tool === "shapes"} onClick={() => setTool("shapes")} className="studio-seg-btn">{t("Formes", "Shapes")}</button>
                <button type="button" data-active={tool === "library"} onClick={() => setTool("library")} className="studio-seg-btn">{t("Bibliothèque", "Library")}</button>
              </div>

              {tool === "media" && (
                <div className="space-y-2">
                  <ImportButton label={t("＋ Plan vidéo ou photo", "＋ Video or photo")} accept="video/*,image/*" onFile={(f) => importFile(f, "clip")} />
                  <ImportButton label={t("♪ Musique", "♪ Music")} accept="audio/*" onFile={(f) => importFile(f, "music")} />
                  <ImportButton label={t("🎙 Voix off", "🎙 Voiceover")} accept="audio/*" onFile={(f) => importFile(f, "voice")} />
                  <ImportButton label={t("🖼 Incrustation", "🖼 Overlay")} accept="image/*" onFile={(f) => importFile(f, "overlay")} />
                  <hr className="border-hair" />
                  <button
                    type="button"
                    onClick={() => apply((p) => addText(p, nextId("t"), t("Votre texte", "Your text")))}
                    className="btn-secondary w-full text-xs"
                  >
                    ➕ {t("Ajouter un texte", "Add text")}
                  </button>
                  <button
                    type="button"
                    onClick={transcribe}
                    disabled={Boolean(busy)}
                    className="btn-secondary w-full text-xs disabled:opacity-50"
                    title={t("Transcrit la parole et pose des sous-titres minutés", "Transcribes speech into timed subtitles")}
                  >
                    💬 {t("Sous-titrer automatiquement", "Auto-subtitle")}
                  </button>
                </div>
              )}

              {tool === "templates" && (
                <TemplateGallery
                  templates={TEMPLATES}
                  brand={brand}
                  format={project.format}
                  lang={lang}
                  onApply={(key) => apply((p) => applyTemplate(p, key, brand, nextId, lang))}
                />
              )}

              {tool === "shapes" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {SHAPES.map((s) => (
                      <button
                        key={s.kind}
                        type="button"
                        onClick={() => apply((p) => addShape(p, nextId("s"), s.kind, brand.palette[0] ?? "#5b2d8e"))}
                        className="flex flex-col items-center gap-1 rounded-lg border border-hair py-2 text-lg hover:border-page"
                      >
                        <span aria-hidden>{s.glyph}</span>
                        <span className="text-[9px] text-muted">{lang === "en" ? s.en : s.fr}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => apply((p) => addButton(
                      p,
                      { shape: nextId("s"), text: nextId("t") },
                      t("En savoir plus", "Learn more"),
                      { fill: brand.palette[0] ?? "#5b2d8e", text: brand.textColor }
                    ))}
                    className="btn-secondary w-full text-xs"
                  >
                    🔘 {t("Bouton d'appel à l'action", "Call-to-action button")}
                  </button>
                </div>
              )}

              {tool === "library" && (
                <AssetLibrary companyId={companyId} lang={lang} onInsert={insertAsset} />
              )}
            </aside>

            {/* Colonne centrale : zone de travail */}
            <main className="flex min-h-0 flex-col gap-2 p-3">
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <Tooltip label={t("Coupe l'élément sélectionné (ou le plan) à la position de la tête de lecture — C", "Cuts the selected element (or the clip) at the playhead — C")}>
                  <ToolButton onClick={() => splitSelectionAt(playhead)} disabled={!selection && project.clips.length === 0}>
                    ✂ {t("Scinder", "Split")}
                  </ToolButton>
                </Tooltip>
                <Tooltip label={t("Duplique l'élément sélectionné — Ctrl/⌘ + D", "Duplicates the selected element — Ctrl/⌘ + D")}>
                  <ToolButton onClick={() => duplicateSelection()} disabled={!selection}>
                    ⧉ {t("Dupliquer", "Duplicate")}
                  </ToolButton>
                </Tooltip>
                <Tooltip label={t("Supprime l'élément sélectionné — Suppr", "Deletes the selected element — Delete")}>
                  <ToolButton onClick={() => removeSelection()} disabled={!selection}>
                    🗑 {t("Supprimer", "Delete")}
                  </ToolButton>
                </Tooltip>
              </div>
              <Preview
                project={displayProject}
                playhead={playhead}
                selection={selection}
                playing={playing}
                onPlayingChange={setPlaying}
                onSeek={setPlayhead}
                onSelect={setSelection}
                onLayerChange={onLayerChange}
                onTextEdit={(id, textValue) => apply((p) => updateText(p, id, { text: textValue }))}
                onDragStart={beginGesture}
                onDragEnd={commitGesture}
              />
            </main>

            {/* Colonne droite : propriétés */}
            <aside className="hidden min-h-0 overflow-y-auto overscroll-contain border-l border-hair bg-card p-3 lg:block">
              <PropertyPanel
                project={project}
                selection={selection}
                playhead={playhead}
                brand={brand}
                onChange={apply}
                onDeselect={() => setSelection(null)}
              />
            </aside>
          </div>

          {/* Timeline ANCRÉE en bas — toujours visible */}
          <div className="shrink-0 border-t border-hair bg-card px-3 py-2">
            <Timeline
              project={project}
              playhead={playhead}
              selection={selection}
              onSeek={setPlayhead}
              onSelect={setSelection}
              onTrim={(clipId, edge, delta) => applyLive((p) => trimClip(p, clipId, edge === "head" ? { head: delta } : { tail: delta }))}
              onMoveClip={(clipId, patch) => applyLive((p) => moveClip(p, clipId, patch))}
              onTrimLayer={(kind, id, edge, delta) => applyLive((p) => trimLayer(p, kind, id, edge, delta))}
              onMoveLayer={(kind, id, start) => applyLive((p) => moveLayerTime(p, kind, id, start))}
              onDragStart={beginGesture}
              onDragEnd={commitGesture}
              onToggleTrackLock={(track) => apply((p) => setTrackMeta(p, track, { locked: !p.trackMeta?.[track]?.locked }))}
              onToggleTrackHidden={(track) => apply((p) => setTrackMeta(p, track, { hidden: !p.trackMeta?.[track]?.hidden }))}
            />
          </div>

          {/* Verrouillage pendant l'export — le montage ne doit plus bouger
              tant que le rendu en cours décrit un état différent de celui
              affiché (chapitre 9, point 7). */}
          {exporting && (
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-0 z-20 flex cursor-not-allowed items-center justify-center gap-2 bg-canvas/70 text-sm text-ink backdrop-blur-[1px]"
            >
              <Spinner size={16} className="text-page" />
              {t("Montage verrouillé pendant l'export…", "Edit locked while exporting…")}
            </div>
          )}
        </div>
      )}

      {/* Pied : état du rendu */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-hair bg-card px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xs text-muted">
            {t("Rendu", "Render")} : {decision.target === "server" ? t("nos serveurs", "our servers") : t("votre navigateur", "your browser")}
            {" · "}{decision.reason}
          </span>
          {busy && (
            <span className="flex items-center gap-2 text-2xs text-muted">
              <Spinner size={12} className="text-page" /> {busy}
            </span>
          )}
          {progress > 0 && progress < 100 && (
            <span className="h-1.5 w-32 overflow-hidden rounded-full bg-canvas">
              <span className="block h-full bg-page transition-all" style={{ width: `${progress}%` }} />
            </span>
          )}
        </div>
        {note && <p className="min-w-0 flex-1 truncate text-right text-2xs text-muted" title={note}>{note}</p>}
      </footer>

      {libraryOpen && (
        <ProjectLibrary
          companyId={companyId}
          currentId={savedId}
          onOpen={openProject}
          onClose={() => setLibraryOpen(false)}
        />
      )}
      <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>,
    document.body
  );

  function removeSelection() {
    if (!selection) return;
    const sel = selection;
    apply((p) => {
      if (sel.kind === "clip") return removeClip(p, sel.id);
      if (sel.kind === "text") return removeText(p, sel.id);
      if (sel.kind === "image") return removeImageLayer(p, sel.id);
      if (sel.kind === "shape") return removeShape(p, sel.id);
      return removeAudio(p, sel.id);
    });
    setSelection(null);
  }

  /**
   * Duplique l'élément sélectionné, quel que soit son type — auparavant
   * réservé aux plans vidéo (itération 3, C-04, règle de parité du chapitre 7).
   */
  function duplicateSelection() {
    if (!selection) return;
    const sel = selection;
    if (sel.kind === "clip") apply((p) => duplicateClip(p, sel.id, nextId("c")));
    else if (sel.kind === "text") apply((p) => duplicateText(p, sel.id, nextId("t")));
    else if (sel.kind === "image") apply((p) => duplicateImageLayer(p, sel.id, nextId("i")));
    else if (sel.kind === "shape") apply((p) => duplicateShape(p, sel.id, nextId("s")));
    else apply((p) => duplicateAudio(p, sel.id, nextId("a")));
  }

  /**
   * Scinde l'élément sélectionné à l'instant `time`, quel que soit son type —
   * auparavant réservé au premier plan vidéo trouvé par balayage du temps, en
   * ignorant la sélection réelle et tous les autres types d'éléments
   * (audit Editing Bench, P0-3).
   */
  function splitSelectionAt(time: number) {
    if (!selection) {
      apply((p) => splitAt(p, time, () => nextId("c")));
      return;
    }
    const sel = selection;
    if (sel.kind === "clip") apply((p) => splitAt(p, time, () => nextId("c"), sel.id));
    else if (sel.kind === "text") apply((p) => splitLayerAt(p, "text", sel.id, time, nextId("t")));
    else if (sel.kind === "image") apply((p) => splitLayerAt(p, "image", sel.id, time, nextId("i")));
    else if (sel.kind === "shape") apply((p) => splitLayerAt(p, "shape", sel.id, time, nextId("s")));
    else apply((p) => splitAudioAt(p, sel.id, time, nextId("a")));
  }
}

/* ── Petits composants d'interface ───────────────────────────────────────── */

function ToolButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="btn-secondary text-2xs disabled:opacity-40">{children}</button>
  );
}

function ImportButton({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className="btn-secondary w-full text-2xs">{label}</button>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </>
  );
}
