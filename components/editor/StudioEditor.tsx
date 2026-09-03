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
import { SUBTITLE_LANGS } from "@/lib/ai/subtitle-langs";
import {
  addAudio, addButton, addClip, addImageLayer, addShape, addText, duplicateAudio,
  duplicateClip, duplicateImageLayer, duplicateShape, duplicateText,
  emptyProject, FORMAT_SIZE, moveClip, moveLayerTime, projectDuration, removeAudio,
  removeClip, removeImageLayer, removeShape, removeText, setClipBox, setClipFraming, setClipLength,
  setClipSpeed, setClipTransition, setProjectDuration, setTrackMeta, shapesAt, splitAt, splitAudioAt, splitLayerAt,
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
import BrandKitPanel from "@/components/studio/BrandKitPanel";
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

/** Suivi du rendu serveur — mêmes constantes que le Studio Vidéo. */
const RENDER_POLL_MS = 4000;
const RENDER_MAX_POLLS = 45; // ≈ 3 min

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
  /**
   * Éléments ADDITIONNELS d'une sélection multiple (Maj/Ctrl-clic sur la
   * timeline), au-delà de `selection` qui reste la sélection PRINCIPALE — la
   * seule à piloter le panneau de propriétés et le glisser dans l'aperçu.
   * Clé : `kind:id`. Vide tant qu'un seul élément est sélectionné (audit
   * Editing Bench, P2-4 — sélection multiple était totalement absente).
   */
  const [multiSelection, setMultiSelection] = useState<Map<string, NonNullable<TimelineSelection>>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** Verrouille le montage pendant un export — voir exportProject. */
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  /**
   * Suivi du rendu SERVEUR — jusqu'ici le banc de montage soumettait le
   * montage puis n'interrogeait plus jamais son état : aucune progression,
   * aucun fichier récupéré, aucun résultat affiché (audit Editing Bench,
   * P0-4). Même point d'accès que le Studio Vidéo (studio-video/page.tsx),
   * qui le fait déjà.
   */
  const [renderState, setRenderState] = useState<"idle" | "queued" | "rendering" | "done" | "failed">("idle");
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [renderErr, setRenderErr] = useState<string | null>(null);
  const renderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (renderPollRef.current) clearInterval(renderPollRef.current); }, []);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [brand, setBrand] = useState<BrandStyle>(() => brandStyleFrom(null));
  const [libraryOpen, setLibraryOpen] = useState(false);
  /** Panneau « kit de marque » ouvert par-dessus l'éditeur (P2-13). */
  const [brandKitOpen, setBrandKitOpen] = useState(false);
  /**
   * Langue RÉELLEMENT parlée dans le média à sous-titrer — "" = détection
   * automatique par Whisper. Jusqu'ici le sous-titrage forçait silencieusement
   * la langue de L'INTERFACE, indépendante de la langue du média (audit
   * Editing Bench, P1-7).
   */
  const [subtitleLang, setSubtitleLang] = useState("");
  /** true = traduit vers l'anglais (seule sortie que Whisper propose). */
  const [subtitleTranslate, setSubtitleTranslate] = useState(false);
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
   * Brouillon de la « durée maîtresse » — `null` tant que le champ n'est pas
   * en cours d'édition, sinon le texte tapé. Un commit sur chaque frappe
   * couperait le montage à un chiffre intermédiaire (taper "30" passe par
   * "3") : l'opération, destructive, ne s'applique qu'au blur ou à Entrée
   * (audit Editing Bench, P2-5).
   */
  const [durationDraft, setDurationDraft] = useState<string | null>(null);
  // Échap déclenche blur() SYNCHRONEMENT, avant que setDurationDraft(null) ne
  // soit répercuté : sans cette référence, le commit relit encore l'ancien
  // brouillon (0,1 s au lieu d'annuler) — bug constaté à l'usage (P2-5).
  const cancelingDuration = useRef(false);
  const commitDuration = () => {
    if (cancelingDuration.current) { cancelingDuration.current = false; return; }
    const v = Number(durationDraft);
    if (durationDraft !== null && Number.isFinite(v) && v > 0) apply((p) => setProjectDuration(p, v));
    setDurationDraft(null);
  };

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
  /**
   * L'enregistrement automatique tournait déjà toutes les 10 s, mais rien à
   * l'écran ne le montrait — impossible de savoir si le montage était à jour
   * (audit Editing Bench, P2-19). Un échec marquait aussi silencieusement
   * `dirty` à false SANS avoir réellement sauvegardé : les modifications
   * suivantes n'étaient alors plus retentées avant la prochaine frappe.
   */
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Miroir RÉACTIF de `dirty.current`, uniquement pour l'affichage — le ref
  // reste la source de vérité pour l'intervalle et beforeunload, qui n'ont pas
  // besoin d'un rendu à chaque frappe.
  const [dirtyDisplay, setDirtyDisplay] = useState(false);
  useEffect(() => { dirty.current = true; setDirtyDisplay(true); }, [project]);

  const saveNow = useCallback(async () => {
    if (project.clips.length === 0) return;
    const res = await fetch("/api/editor/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, id: savedId, doc: project, name: project.name }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (res) {
      dirty.current = false;
      setDirtyDisplay(false);
      setLastSavedAt(new Date());
      setSaveFailed(false);
    } else {
      // L'échec laisse `dirty` à true : le prochain tic de l'enregistrement
      // automatique retente, au lieu d'abandonner en silence.
      setSaveFailed(true);
    }
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
  const kb = useRef({
    playhead, duration, selection, apply, saveNow, playing, shortcutsOpen, exporting,
    removeSelection, duplicateSelection,
  });
  kb.current = {
    playhead, duration, selection, apply, saveNow, playing, shortcutsOpen, exporting,
    removeSelection, duplicateSelection,
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Jamais pendant une saisie de texte — le garde existant, étendu au
      // contenu éditable (§6.1, piège n°1).
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;

      const {
        playhead: ph, duration: dur, selection: sel, apply: doApply, saveNow: doSave,
        playing: isPlaying, shortcutsOpen: refOpen, exporting: isExporting,
        removeSelection: doRemoveSelection, duplicateSelection: doDuplicateSelection,
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
        // Neutralise le marque-page du navigateur (§6.1). Passe par la version
        // consciente de la sélection multiple (P2-4) — un seul endroit pour
        // dupliquer, que ce soit au clavier, à l'outil ou au menu contextuel.
        e.preventDefault();
        doDuplicateSelection();
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
        doRemoveSelection();
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
        else {
          setSelection(null);
          setMultiSelection(new Map());
          setContextMenu(null);
        }
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

  /** Referme le menu contextuel au clic ailleurs — sans quoi il reste ouvert
      indéfiniment, recouvrant la timeline (P3-7). */
  useEffect(() => {
    if (!contextMenu) return;
    // Un clic DANS le menu (Dupliquer/Supprimer) ne doit pas le fermer avant
    // que son propre bouton n'ait eu la main — sans ce garde, le clic sur
    // « Dupliquer le groupe » fermait le menu (et annulait l'action) au lieu
    // de la déclencher.
    function onPointerDown(e: PointerEvent) {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    }
    // Un cran après le clic qui vient de l'ouvrir (clic droit) : sans ce
    // report, le même événement le fermerait à l'instant où il s'affiche.
    const id = window.setTimeout(() => window.addEventListener("pointerdown", onPointerDown), 0);
    return () => { window.clearTimeout(id); window.removeEventListener("pointerdown", onPointerDown); };
  }, [contextMenu]);

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
        apply((p) => addImageLayer(p, nextId("i"), url, undefined, playhead));
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
    [apply, companyId, playhead, t]
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
    // La durée déclarée par le fournisseur (asset.durationSec) est une
    // METADONNÉE, pas une mesure du fichier réellement livré — un écart
    // programmait la piste plus longue que le son réel, et la lecture butait
    // en fin de fichier à chaque boucle de resynchronisation (currentTime
    // rappelé au-delà de la fin réelle) : la piste ajoutée par ce chemin
    // était donc la seule à « saccader » (audit Editing Bench, P1-6). Le
    // chemin d'import de fichier, lui, sonde déjà la vraie durée via l'élément
    // <audio> — on fait maintenant de même ici.
    const probe = document.createElement("audio");
    probe.preload = "metadata";
    probe.onloadedmetadata = () =>
      apply((p) => addAudio(p, {
        id: nextId("a"), src: asset.url, name: t("Musique de la bibliothèque", "Library music"),
        role: "music",
        sourceDuration: Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : asset.durationSec,
        provenance: asset.provenance,
      }));
    probe.onerror = () =>
      apply((p) => addAudio(p, {
        id: nextId("a"), src: asset.url, name: t("Musique de la bibliothèque", "Library music"),
        role: "music", sourceDuration: asset.durationSec, provenance: asset.provenance,
      }));
    probe.src = asset.url;
  }, [apply, t]);

  /* ── Sous-titrage automatique ──────────────────────────────────────────── */
  const transcribe = useCallback(async () => {
    // On transcrit la voix off si elle existe, sinon le son du plan de la
    // piste visuelle la plus basse — autrefois « piste 0 », qui n'a plus de
    // statut particulier une fois les pistes libres (Lot A3, audit Editing
    // Bench v4).
    const voice = project.audios.find((a) => a.role === "voice" && !a.muted);
    const bottomVisualTrackId = (project.tracks ?? []).find((tr) => tr.family === "visual")?.id;
    const source = voice?.src ??
      project.clips.find((c) => c.trackId === bottomVisualTrackId && c.kind === "video")?.src;
    if (!source) {
      setNote(t("Aucune piste parlée à transcrire.", "No spoken track to transcribe."));
      return;
    }
    setBusy(t("Transcription en cours…", "Transcribing…"));
    try {
      const res = await fetch("/api/editor/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, src: source,
          // Langue RÉELLEMENT parlée dans le média — jamais celle de
          // l'interface (P1-7). Vide = détection automatique par Whisper.
          ...(subtitleLang ? { lang: subtitleLang } : {}),
          ...(subtitleTranslate ? { task: "translate" } : {}),
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { segments?: { start: number; end: number; text: string }[]; error?: string };
      if (!res.ok || !d.segments?.length) throw new Error(d.error ?? t("aucun segment", "no segment"));

      const newIds: string[] = [];
      apply((p) => {
        let next = p;
        for (const seg of d.segments!) {
          const id = nextId("t");
          newIds.push(id);
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
      // Le lot entier part sélectionné : reformater ou supprimer une
      // transcription qui ne convient pas exigeait jusqu'ici de reprendre
      // chaque sous-titre un par un — souvent plusieurs dizaines pour une
      // vidéo de quelques minutes (audit Editing Bench, P2-10).
      if (newIds.length > 0) {
        setSelection({ kind: "text", id: newIds[newIds.length - 1] });
        setMultiSelection(new Map(newIds.map((id) => [`text:${id}`, { kind: "text" as const, id }])));
      }
      setNote(t(`${d.segments.length} sous-titres posés — relisez-les avant publication.`,
        `${d.segments.length} subtitles added — proofread before publishing.`));
    } catch (e) {
      setNote(t("Transcription impossible : ", "Transcription failed: ") + (e instanceof Error ? e.message.slice(0, 140) : ""));
    } finally {
      setBusy(null);
    }
  }, [project.audios, project.clips, project.tracks, companyId, subtitleLang, subtitleTranslate, apply, t]);

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
    // Efface un panneau de rendu serveur d'un export précédent — sinon un
    // export navigateur qui suit reste affiché à côté d'une vidéo obsolète.
    if (renderPollRef.current) { clearInterval(renderPollRef.current); renderPollRef.current = null; }
    setRenderState("idle");
    setRenderUrl(null);
    setRenderErr(null);
    // Verrouille le montage pour toute la durée du rendu — rien n'empêchait
    // jusqu'ici de continuer à monter pendant un export, et le résultat ne
    // correspondait alors plus à ce que l'écran affichait (itération 3,
    // chapitre 9, point 7).
    setExporting(true);

    // Rendu SERVEUR : le document part au moteur, puis on SUIT son état.
    // Jusqu'ici la fonction s'arrêtait dès la soumission — aucune progression,
    // aucune récupération, aucun résultat affiché (audit Editing Bench, P0-4).
    // Même point d'accès de suivi que le Studio Vidéo (studio-video/page.tsx),
    // qui l'appelle déjà.
    if (decision.target === "server") {
      setRenderState("queued");
      setBusy(t("Envoi du montage…", "Sending the edit…"));
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
        if (!res.ok || !d.id) throw new Error((d as { error?: string }).error ?? `HTTP ${res.status}`);
        const id = d.id as string;
        setBusy(null);
        // L'édition reste possible pendant que le rendu tourne côté serveur —
        // rien dans le montage n'est modifié par le rendu en cours.
        setExporting(false);

        let polls = 0;
        renderPollRef.current = setInterval(async () => {
          polls += 1;
          // Garde-fou anti-suivi infini : intervalle 4 s × 45 ≈ 3 min max.
          if (polls > RENDER_MAX_POLLS) {
            if (renderPollRef.current) clearInterval(renderPollRef.current);
            renderPollRef.current = null;
            setRenderState("failed");
            setRenderErr(t(
              "Trop long à suivre depuis cet écran — le fichier atterrira quand même dans la médiathèque une fois le rendu terminé.",
              "Taking too long to track from this screen — the file will still land in the media library once the render finishes."
            ));
            return;
          }
          try {
            const s = await fetch(`/api/video/render/${encodeURIComponent(id)}`).then((r) => r.json());
            if (s.status === "done") {
              if (renderPollRef.current) clearInterval(renderPollRef.current);
              renderPollRef.current = null;
              let finalUrl: string | null = s.url ?? null;
              if (finalUrl) {
                // URL Shotstack éphémère → stockage durable, comme le Studio Vidéo.
                try {
                  const pr = await fetch("/api/media/persist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ companyId, url: finalUrl, kind: "video" }),
                  });
                  const pd = await pr.json();
                  if (pr.ok && pd.url) finalUrl = pd.url;
                } catch { /* garde l'URL d'origine */ }
                // TS perd le rétrécissement de `finalUrl` après le try/catch
                // qui le réaffecte ; la reprise ne le remplace jamais par une
                // valeur vide (garde `pd.url` juste au-dessus), donc l'URL
                // reste non nulle ici.
                const url = finalUrl as string;
                await Promise.all([
                  fetch("/api/editor/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ companyId, id: savedId, doc: project, name: project.name, renderUrl: url }),
                  }).catch(() => null),
                  // Honore la promesse « le fichier vous attendra dans la
                  // médiathèque » même si le rappel automatique n'est pas
                  // configuré côté serveur (chapitre 2.3 de l'audit).
                  fetch("/api/media", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ companyId, url, type: "video", format: project.format, source: "editor" }),
                  }).catch(() => null),
                ]);
                // Remplace le média du composeur — comme le fait déjà le rendu
                // navigateur juste au-dessus.
                onExport({ url, name: "montage.mp4", size: 0, kind: "video" });
              }
              setRenderUrl(finalUrl);
              setRenderState("done");
            } else if (s.status === "failed") {
              if (renderPollRef.current) clearInterval(renderPollRef.current);
              renderPollRef.current = null;
              setRenderState("failed");
              setRenderErr(s.error ?? t("Échec du rendu.", "Render failed."));
            } else {
              setRenderState(s.status === "queued" ? "queued" : "rendering");
            }
          } catch { /* nouvelle tentative au prochain intervalle */ }
        }, RENDER_POLL_MS);
      } catch (e) {
        setRenderState("failed");
        setRenderErr(e instanceof Error ? e.message.slice(0, 140) : t("Erreur réseau.", "Network error."));
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
      if (sel.kind === "clip") {
        // Pas de rotation sur un plan (P2-1) : `patch.rotation` n'a nulle part
        // où aller ici, à la différence des trois autres types.
        return setClipBox(p, sel.id, { x: patch.x, y: patch.y, w: patch.w, h: patch.h });
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
          {/* Indicateur de sauvegarde — jusqu'ici l'enregistrement automatique
              tournait sans aucun signe à l'écran (audit Editing Bench, P2-19). */}
          <span
            role="status"
            className={`shrink-0 text-2xs ${saveFailed ? "text-danger" : "text-muted"}`}
          >
            {saveFailed
              ? t("⚠ Échec de l'enregistrement — nouvel essai en cours…", "⚠ Save failed — retrying…")
              : dirtyDisplay
              ? t("Modifications non enregistrées…", "Unsaved changes…")
              : lastSavedAt
              ? t(`Enregistré à ${lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
                  `Saved at ${lastSavedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`)
              : null}
          </span>
          <span className="hidden items-center gap-1 text-2xs text-muted sm:flex">
            {/* Durée maîtresse — jusqu'ici purement affichée, sans aucun
                moyen de fixer directement la longueur totale du montage
                (« il me faut exactement 30 s pour Reels ») autrement qu'en
                rognant chaque piste une par une (audit Editing Bench, P2-5). */}
            {project.clips.length > 0 ? (
              <Tooltip label={t("Durée totale — raccourcit toutes les pistes à cet instant", "Total length — trims every track down to this instant")}>
                <input
                  type="number" min={0.1} step={0.5}
                  value={durationDraft ?? duration.toFixed(1)}
                  aria-label={t("Durée totale du montage", "Total edit length")}
                  onFocus={() => setDurationDraft(duration.toFixed(1))}
                  onChange={(e) => setDurationDraft(e.target.value)}
                  onBlur={commitDuration}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                    else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelingDuration.current = true;
                      setDurationDraft(null);
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-12 rounded border border-hair bg-transparent px-1 py-0.5 text-right text-2xs text-ink [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </Tooltip>
            ) : (
              <span>{duration.toFixed(1)}</span>
            )}
            s · {project.clips.length} {t("plan(s)", "clip(s)")} · {usedTracks(project).length} {t("piste(s)", "track(s)")}
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
            disabled={Boolean(busy) || project.clips.length === 0 || renderState === "queued" || renderState === "rendering"}
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
                    onClick={() => apply((p) => addText(p, nextId("t"), t("Votre texte", "Your text"), playhead, brand.font))}
                    className="btn-secondary w-full text-xs"
                  >
                    ➕ {t("Ajouter un texte", "Add text")}
                  </button>
                  {/* Langue RÉELLEMENT parlée dans le média — jamais imposée
                      depuis la langue de l'interface (audit Editing Bench,
                      P1-7). Vide = détection automatique par Whisper. */}
                  <label className="block text-2xs text-muted">
                    {t("Langue parlée dans le média", "Language spoken in the media")}
                    <select
                      value={subtitleLang}
                      onChange={(e) => setSubtitleLang(e.target.value)}
                      className="input mt-0.5 w-full text-xs"
                    >
                      <option value="">{t("Détection automatique", "Auto-detect")}</option>
                      {SUBTITLE_LANGS.map((l) => (
                        <option key={l.code} value={l.code}>{lang === "en" ? l.en : l.fr}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-2xs text-muted">
                    <input
                      type="checkbox"
                      checked={subtitleTranslate}
                      onChange={(e) => setSubtitleTranslate(e.target.checked)}
                    />
                    {t("Traduire vers l'anglais", "Translate to English")}
                  </label>
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
                  onOpenBrandKit={() => setBrandKitOpen(true)}
                />
              )}

              {tool === "shapes" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {SHAPES.map((s) => (
                      <button
                        key={s.kind}
                        type="button"
                        onClick={() => apply((p) => addShape(p, nextId("s"), s.kind, brand.palette[0] ?? "#5b2d8e", playhead))}
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
                      { fill: brand.palette[0] ?? "#5b2d8e", text: brand.textColor },
                      playhead,
                      brand.font
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
                <Tooltip label={t("Duplique l'élément (ou le groupe) sélectionné — Ctrl/⌘ + D", "Duplicates the selected element (or group) — Ctrl/⌘ + D")}>
                  <ToolButton onClick={() => duplicateSelection()} disabled={!selection}>
                    ⧉ {t("Dupliquer", "Duplicate")}{multiSelection.size > 0 ? ` (${selectedItems().length})` : ""}
                  </ToolButton>
                </Tooltip>
                <Tooltip label={t("Supprime l'élément (ou le groupe) sélectionné — Suppr", "Deletes the selected element (or group) — Delete")}>
                  <ToolButton onClick={() => removeSelection()} disabled={!selection}>
                    🗑 {t("Supprimer", "Delete")}{multiSelection.size > 0 ? ` (${selectedItems().length})` : ""}
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
                multiSelectionItems={multiSelection.size > 0 ? selectedItems() : []}
                playhead={playhead}
                brand={brand}
                onChange={apply}
                onDeselect={() => { setSelection(null); setMultiSelection(new Map()); }}
              />
            </aside>
          </div>

          {/* Timeline ANCRÉE en bas — toujours visible */}
          <div className="shrink-0 border-t border-hair bg-card px-3 py-2">
            <Timeline
              project={project}
              playhead={playhead}
              selection={selection}
              multiSelectedKeys={new Set(multiSelection.keys())}
              onSeek={setPlayhead}
              onSelect={onTimelineSelect}
              onContextMenu={(sel, e) => {
                // Le menu contextuel n'a d'intérêt que sur une sélection de
                // GROUPE — un seul élément a déjà la barre d'outils juste
                // au-dessus de l'aperçu (P3-7). Clic droit sur un élément
                // hors du groupe sélectionné : on ne montre rien plutôt que
                // d'agir sur un élément que l'utilisateur n'a pas choisi.
                const inSelection = selectedItems().some((s) => s.kind === sel.kind && s.id === sel.id);
                if (multiSelection.size === 0 || !inSelection) return;
                setContextMenu({ x: e.clientX, y: e.clientY });
              }}
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

        {/* Suivi du rendu serveur — jusqu'ici rien ne s'affichait après la
            soumission : ni progression réelle, ni fichier, ni échec
            (audit Editing Bench, P0-4). */}
        {(renderState === "queued" || renderState === "rendering") && (
          <div role="status" aria-live="polite" className="flex w-full items-center gap-2 text-2xs text-muted">
            <Spinner size={12} className="text-page" />
            {renderState === "queued"
              ? t("Rendu en file d'attente sur nos serveurs…", "Render queued on our servers…")
              : t("Rendu en cours sur nos serveurs… (peut prendre 1 à 3 min)", "Rendering on our servers… (may take 1–3 min)")}
          </div>
        )}
        {renderState === "done" && renderUrl && (
          <div className="flex w-full flex-wrap items-center gap-2 text-2xs">
            <video src={renderUrl} controls preload="metadata" className="h-14 rounded border border-hair" />
            <span className="text-success-600">
              ✓ {t("Rendu prêt — média remplacé dans le composeur, enregistré dans la médiathèque.", "Render ready — media replaced in the composer, saved to the media library.")}
            </span>
            <a href={renderUrl} target="_blank" rel="noopener noreferrer" download className="btn-secondary text-2xs">
              ⬇ {t("Télécharger", "Download")}
            </a>
            <a href="/media" target="_blank" rel="noopener noreferrer" className="btn-secondary text-2xs">
              {t("Ouvrir la médiathèque", "Open media library")}
            </a>
          </div>
        )}
        {renderState === "failed" && (
          <div className="flex w-full items-center gap-2 text-2xs text-danger">
            {renderErr ?? t("Échec du rendu.", "Render failed.")}
            <button type="button" className="underline" onClick={exportProject}>{t("Réessayer", "Retry")}</button>
          </div>
        )}
      </footer>

      {libraryOpen && (
        <ProjectLibrary
          companyId={companyId}
          currentId={savedId}
          onOpen={openProject}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {/* Le kit de marque se règle d'ordinaire hors de l'éditeur (Composer,
          Studio Vidéo…), un écran que l'éditeur — plein écran — recouvre
          entièrement. Sans ce raccourci, « kit absent » dans la galerie de
          modèles n'offrait aucune prise : il fallait fermer l'éditeur pour
          aller le chercher (audit Editing Bench, P2-13). */}
      {brandKitOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3"
          onClick={() => setBrandKitOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hair px-4 py-2.5">
              <h4 className="text-sm font-semibold text-ink">🎨 {t("Kit de marque", "Brand kit")}</h4>
              <button
                type="button" onClick={() => setBrandKitOpen(false)}
                className="text-muted hover:text-ink" aria-label={t("Fermer", "Close")}
              >✕</button>
            </div>
            <div className="p-3">
              <BrandKitPanel companyId={companyId} onKit={(k) => setBrand(brandStyleFrom(k))} />
            </div>
          </div>
        </div>
      )}
      <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Menu contextuel — n'apparaît que sur une sélection de groupe, où il
          offre une prise directe qui manquait totalement jusqu'ici (audit
          Editing Bench, P3-7). Un seul élément a déjà la barre d'outils. */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          className="fixed z-50 min-w-[10rem] rounded-md border border-hair bg-card py-1 text-xs shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={duplicateSelection}
            className="block w-full px-3 py-1.5 text-left hover:bg-canvas"
          >
            ⧉ {t("Dupliquer le groupe", "Duplicate group")} ({selectedItems().length})
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={removeSelection}
            className="block w-full px-3 py-1.5 text-left text-danger hover:bg-canvas"
          >
            🗑 {t("Supprimer le groupe", "Delete group")} ({selectedItems().length})
          </button>
        </div>
      )}
    </div>,
    document.body
  );

  /** Clé stable d'un élément sélectionnable — pour la sélection multiple. */
  function selKey(sel: NonNullable<TimelineSelection>): string {
    return `${sel.kind}:${sel.id}`;
  }

  /**
   * Tous les éléments actuellement sélectionnés — la sélection PRINCIPALE et
   * les éléments additionnels d'une sélection multiple, dédupliqués. Base des
   * opérations groupées (supprimer, dupliquer) : sans sélection multiple,
   * cette liste ne contient que `selection`, exactement le comportement
   * d'avant (audit Editing Bench, P2-4).
   */
  function selectedItems(): NonNullable<TimelineSelection>[] {
    const byKey = new Map(multiSelection);
    if (selection) byKey.set(selKey(selection), selection);
    return [...byKey.values()];
  }

  /**
   * Maj-clic ou Ctrl/⌘-clic sur la timeline : ajoute/retire un élément de la
   * sélection au lieu de la remplacer. Un clic simple (sans modificateur)
   * retombe sur le comportement d'origine — remplacer la sélection.
   */
  function onTimelineSelect(sel: TimelineSelection, e?: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
    if (sel && e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      setMultiSelection((prev) => {
        const next = new Map(prev);
        if (next.size === 0 && selection) next.set(selKey(selection), selection);
        const k = selKey(sel);
        if (next.has(k)) next.delete(k); else next.set(k, sel);
        return next;
      });
      setSelection(sel);
      return;
    }
    setSelection(sel);
    setMultiSelection(new Map());
  }

  function removeSelection() {
    const items = selectedItems();
    if (items.length === 0) return;
    apply((p) => items.reduce((acc, sel) => {
      if (sel.kind === "clip") return removeClip(acc, sel.id);
      if (sel.kind === "text") return removeText(acc, sel.id);
      if (sel.kind === "image") return removeImageLayer(acc, sel.id);
      if (sel.kind === "shape") return removeShape(acc, sel.id);
      return removeAudio(acc, sel.id);
    }, p));
    setSelection(null);
    setMultiSelection(new Map());
    setContextMenu(null);
  }

  /**
   * Duplique l'élément (ou le groupe) sélectionné, quel que soit son type —
   * auparavant réservé aux plans vidéo (itération 3, C-04, règle de parité du
   * chapitre 7), puis étendu à un groupe entier (P2-4). Une seule entrée
   * d'historique pour tout le groupe, pas une par élément dupliqué.
   */
  function duplicateSelection() {
    const items = selectedItems();
    if (items.length === 0) return;
    apply((p) => items.reduce((acc, sel) => {
      if (sel.kind === "clip") return duplicateClip(acc, sel.id, nextId("c"));
      if (sel.kind === "text") return duplicateText(acc, sel.id, nextId("t"));
      if (sel.kind === "image") return duplicateImageLayer(acc, sel.id, nextId("i"));
      if (sel.kind === "shape") return duplicateShape(acc, sel.id, nextId("s"));
      return duplicateAudio(acc, sel.id, nextId("a"));
    }, p));
    setContextMenu(null);
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
