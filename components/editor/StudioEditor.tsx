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
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import { hostMedia, MAX_UPLOAD_BYTES, formatSize } from "@/lib/media/host";
import {
  addAudio, addButton, addClip, addImageLayer, addShape, addText, duplicateClip,
  emptyProject, FORMAT_SIZE, moveClip, projectDuration, removeAudio, removeClip,
  removeImageLayer, removeShape, removeText, setClipFraming, setClipLength,
  setClipSpeed, setClipTransition, shapesAt, splitAt, trimClip, updateAudio,
  updateImageLayer, updateShape, updateText, usedTracks,
  type AnimationKind, type EditorFormat, type EditorProject, type ShapeKind,
  type TransitionKind, type VisualLayer,
} from "@/lib/editor/project";
import {
  applyTemplate, brandStyleFrom, rescaleTextsForFormat, TEMPLATES, type BrandStyle,
} from "@/lib/editor/templates";
import { canRedo, canUndo, initHistory, push, redo, undo, type History } from "@/lib/editor/history";
import { browserOverlays, decideRenderTarget, toBrowserPlan, type OverlayInput } from "@/lib/editor/render-plan";
import { drawImages, drawShapes, drawTexts, ensureFontsReady, FONT_STACKS, loadImage } from "@/lib/editor/draw";
import { Timeline, type TimelineSelection } from "./Timeline";
import { Preview, type LayerPatch } from "./Preview";
import { ProjectLibrary } from "./ProjectLibrary";
import { TemplateGallery } from "./TemplateGallery";
import { PropertyPanel } from "./PropertyPanel";
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
  const [selection, setSelection] = useState<TimelineSelection>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [brand, setBrand] = useState<BrandStyle>(() => brandStyleFrom(null));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tool, setTool] = useState<"media" | "templates" | "shapes">("media");
  /** Poids cumulé des sources — décide du moteur de rendu. */
  const sourceBytes = useRef(0);
  const lang: "fr" | "en" = t("fr", "en") === "en" ? "en" : "fr";

  /** Applique une opération de montage en l'inscrivant dans l'historique. */
  const apply = useCallback((fn: (p: EditorProject) => EditorProject) => {
    setHistory((h) => push(h, fn(h.present)));
  }, []);

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

  /* ── Enregistrement automatique ────────────────────────────────────────── */
  const dirty = useRef(false);
  useEffect(() => { dirty.current = true; }, [project]);
  useEffect(() => {
    if (loading) return;
    const timer = setInterval(async () => {
      if (!dirty.current || project.clips.length === 0) return;
      dirty.current = false;
      const res = await fetch("/api/editor/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, id: savedId, doc: project, name: project.name }),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (res?.project?.id && !savedId) setSavedId(res.project.id as string);
    }, 10_000);
    return () => clearInterval(timer);
  }, [project, companyId, savedId, loading]);

  /* ── Raccourcis clavier ────────────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
      } else if (e.key.toLowerCase() === "s" && !meta) {
        e.preventDefault();
        apply((p) => splitAt(p, playhead, () => nextId("c")));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, playhead]);

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

  /* ── Export ────────────────────────────────────────────────────────────── */
  const decision = useMemo(() => decideRenderTarget(project, sourceBytes.current), [project]);

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
          body: JSON.stringify({ companyId, project }),
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
      }
      return;
    }

    // Rendu NAVIGATEUR : gratuit, aucune donnée sortante.
    setBusy(t("Préparation du moteur vidéo…", "Loading video engine…"));
    try {
      const composed = await buildOverlays();
      const plan = toBrowserPlan(project, composed.map((c) => c.overlay));

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
    }
  }, [project, decision.target, companyId, savedId, buildOverlays, onExport, onClose, t]);

  /* ── Manipulation directe dans la zone de travail ──────────────────────── */
  const onLayerChange = useCallback((sel: NonNullable<TimelineSelection>, patch: LayerPatch) => {
    apply((p) => {
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
  }, [apply]);

  const duration = projectDuration(project);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
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

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted">
          <Spinner size={16} className="text-page" /> {t("Chargement du projet…", "Loading project…")}
        </div>
      ) : (
        <>
          {/* Trois zones à défilement INDÉPENDANT */}
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_1fr_300px]">
            {/* Colonne gauche : outils */}
            <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-hair bg-card p-3 lg:flex">
              <div className="studio-seg mb-3">
                <button type="button" data-active={tool === "media"} onClick={() => setTool("media")} className="studio-seg-btn">{t("Médias", "Media")}</button>
                <button type="button" data-active={tool === "templates"} onClick={() => setTool("templates")} className="studio-seg-btn">{t("Modèles", "Templates")}</button>
                <button type="button" data-active={tool === "shapes"} onClick={() => setTool("shapes")} className="studio-seg-btn">{t("Formes", "Shapes")}</button>
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
            </aside>

            {/* Colonne centrale : zone de travail */}
            <main className="flex min-h-0 flex-col gap-2 p-3">
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <ToolButton onClick={() => apply((p) => splitAt(p, playhead, () => nextId("c")))} disabled={project.clips.length === 0}>
                  ✂ {t("Scinder", "Split")}
                </ToolButton>
                <ToolButton
                  onClick={() => selection?.kind === "clip" && apply((p) => duplicateClip(p, selection.id, nextId("c")))}
                  disabled={selection?.kind !== "clip"}
                >
                  ⧉ {t("Dupliquer", "Duplicate")}
                </ToolButton>
                <ToolButton onClick={() => removeSelection()} disabled={!selection}>
                  🗑 {t("Supprimer", "Delete")}
                </ToolButton>
              </div>
              <Preview
                project={project}
                playhead={playhead}
                selection={selection}
                onSeek={setPlayhead}
                onSelect={setSelection}
                onLayerChange={onLayerChange}
              />
            </main>

            {/* Colonne droite : propriétés */}
            <aside className="hidden min-h-0 overflow-y-auto border-l border-hair bg-card p-3 lg:block">
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
              onTrim={(clipId, edge, delta) => apply((p) => trimClip(p, clipId, edge === "head" ? { head: delta } : { tail: delta }))}
              onMoveClip={(clipId, patch) => apply((p) => moveClip(p, clipId, patch))}
            />
          </div>
        </>
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
    </div>
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
