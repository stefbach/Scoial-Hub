"use client";

// Banc de montage — l'éditeur complet.
//
// Il ne détient AUCUNE logique de montage : il orchestre un document de projet
// (lib/editor/project.ts), une pile d'historique (lib/editor/history.ts) et deux
// projections de rendu (lib/editor/render-plan.ts) — tous purs et testés.
// Ce composant se contente de câbler des gestes sur des opérations.
//
// Ce que cela apporte, sans code spécifique :
//   • non-destructivité — le média source n'est jamais modifié ;
//   • annuler / rétablir — restaurer un état antérieur ;
//   • minutage — chaque élément porte ses bornes ;
//   • reprise — le document est rechargeable des jours plus tard.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import { hostMedia, MAX_UPLOAD_BYTES, formatSize } from "@/lib/media/host";
import {
  addAudio, addClip, addImageLayer, addText, duplicateClip, emptyProject,
  FORMAT_SIZE, projectDuration, removeAudio, removeClip, removeImageLayer,
  imagesAt, removeText, reorderClip, setClipFraming, setClipSpeed, setClipTransition,
  splitAt, textsAt, trimClip, updateAudio, updateImageLayer, updateText,
  type EditorFormat, type EditorProject, type TransitionKind,
} from "@/lib/editor/project";
import {
  applyTemplate, brandStyleFrom, rescaleTextsForFormat, TEMPLATES, type BrandStyle,
} from "@/lib/editor/templates";
import { canRedo, canUndo, initHistory, push, redo, undo, type History } from "@/lib/editor/history";
import { decideRenderTarget, overlayIntervals, toBrowserPlan, type OverlayInput } from "@/lib/editor/render-plan";
import { drawImages, drawTexts, loadImage } from "@/lib/editor/draw";
import { Timeline, type TimelineSelection } from "./Timeline";
import { Preview } from "./Preview";
import { ProjectLibrary } from "./ProjectLibrary";
import type { UploadedMedia } from "@/components/ui/MediaUpload";

const FORMATS: EditorFormat[] = ["9:16", "1:1", "4:5", "16:9"];
const PRESET_COLORS = ["#ffffff", "#000000", "#ff3b30", "#ffcc00", "#34c759", "#0a84ff"];

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
  /** Poids cumulé des sources — décide du moteur de rendu. */
  const sourceBytes = useRef(0);
  const lang: "fr" | "en" = t("fr", "en") === "en" ? "en" : "fr";

  /** Applique une opération de montage en l'inscrivant dans l'historique. */
  const apply = useCallback((fn: (p: EditorProject) => EditorProject) => {
    setHistory((h) => push(h, fn(h.present)));
  }, []);

  /**
   * Change le format de publication. Les textes sont retranspostés : leur taille
   * est stockée en fraction de HAUTEUR, qui ne veut pas dire la même chose d'un
   * cadre à l'autre — sans cela, un titre réglé en 9:16 devenait minuscule en
   * 16:9. Le média source, lui, n'est pas touché : le cadrage est une intention.
   */
  const changeFormat = useCallback((format: EditorFormat) => {
    apply((p) => (p.format === format ? p : rescaleTextsForFormat({ ...p, format }, p.format)));
  }, [apply]);

  /* ── Identité de marque ────────────────────────────────────────────────── */
  // Les modèles de composition s'y calibrent. Un kit absent ne bloque rien :
  // `brandStyleFrom` retombe sur un réglage lisible.
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
  // Toutes les 10 secondes après une modification : aucune perte de travail,
  // sans marteler l'API à chaque geste.
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

  /* ── Export ────────────────────────────────────────────────────────────── */
  const decision = useMemo(() => decideRenderTarget(project, sourceBytes.current), [project]);

  /**
   * Compose un PNG de calques PAR INTERVALLE de temps.
   *
   * L'export ne composait qu'un seul calque, pris à la position de la tête de
   * lecture, puis le gravait sur tout le film : les bornes d'apparition
   * n'étaient pas respectées, et un texte hors de la position courante était
   * perdu sans avertissement. Les incrustations d'image, elles, n'étaient tout
   * simplement jamais dessinées.
   */
  const buildOverlays = useCallback(async (): Promise<{ overlay: OverlayInput; bytes: Uint8Array }[]> => {
    const intervals = overlayIntervals(project);
    if (intervals.length === 0) return [];
    const { width, height } = FORMAT_SIZE[project.format];

    // Les images sont chargées UNE fois pour tout l'export, pas par intervalle.
    const loaded = new Map<string, HTMLImageElement>();
    for (const src of new Set(project.images.map((l) => l.src))) {
      const img = await loadImage(src);
      if (img) loaded.set(src, img);
    }

    const out: { overlay: OverlayInput; bytes: Uint8Array }[] = [];
    for (const [i, span] of intervals.entries()) {
      const mid = (span.start + span.end) / 2;
      const texts = textsAt(project, mid);
      const images = imagesAt(project, mid);
      if (texts.length === 0 && images.length === 0) continue;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      // Ordre de dessin identique à l'aperçu : incrustations, puis textes.
      drawImages(ctx, width, height, images, loaded);
      drawTexts(ctx, width, height, texts);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) continue;
      out.push({
        overlay: { name: `ov${i}.png`, start: span.start, end: span.end },
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
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

  /* ── Rendu ─────────────────────────────────────────────────────────────── */

  const selectedText = selection?.kind === "text" ? project.texts.find((l) => l.id === selection.id) : null;
  const selectedClip = selection?.kind === "clip" ? project.clips.find((c) => c.id === selection.id) : null;
  const selectedAudio = selection?.kind === "audio" ? project.audios.find((a) => a.id === selection.id) : null;
  const selectedImage = selection?.kind === "image" ? project.images.find((l) => l.id === selection.id) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">🎬 {t("Banc de montage", "Editing bench")}</h3>
            <input
              value={project.name}
              onChange={(e) => apply((p) => ({ ...p, name: e.target.value }))}
              placeholder={t("Nom du montage", "Edit name")}
              aria-label={t("Nom du montage", "Edit name")}
              className="w-40 rounded-md border border-hair bg-transparent px-2 py-0.5 text-2xs text-ink placeholder:text-muted"
            />
            <span className="text-2xs text-muted">
              {projectDuration(project).toFixed(1)}s · {project.clips.length} {t("plan(s)", "clip(s)")}
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
            <button type="button" onClick={onClose} className="px-1 text-muted hover:text-ink" aria-label={t("Fermer", "Close")}>✕</button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted">
            <Spinner size={16} className="text-page" /> {t("Chargement du projet…", "Loading project…")}
          </div>
        ) : (
          <div className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[320px_1fr]">
            {/* Colonne gauche : aperçu */}
            <div className="space-y-3">
              <Preview
                project={project}
                playhead={playhead}
                onSeek={setPlayhead}
                onDragText={(id, x, y) => apply((p) => updateText(p, id, { x, y }))}
                onDragImage={(id, x, y) => apply((p) => updateImageLayer(p, id, { x, y }))}
              />
              <div className="grid grid-cols-2 gap-1.5">
                <ImportButton label={t("＋ Plan", "＋ Clip")} accept="video/*,image/*" onFile={(f) => importFile(f, "clip")} />
                <ImportButton label={t("♪ Musique", "♪ Music")} accept="audio/*" onFile={(f) => importFile(f, "music")} />
                <ImportButton label={t("🎙 Voix off", "🎙 Voiceover")} accept="audio/*" onFile={(f) => importFile(f, "voice")} />
                <ImportButton label={t("🖼 Incrustation", "🖼 Overlay")} accept="image/*" onFile={(f) => importFile(f, "overlay")} />
              </div>
              <button
                type="button"
                onClick={() => apply((p) => addText(p, nextId("t"), t("Votre texte", "Your text")))}
                className="btn-secondary w-full text-xs"
              >
                ➕ {t("Ajouter un texte", "Add text")}
              </button>

              {/* Modèles calibrés sur l'identité de marque. Ils AJOUTENT des
                  calques — donc annulables, et sans effacer le travail en cours. */}
              <div className="space-y-1.5 rounded-lg border border-hair p-2.5">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
                  {t("Modèles de marque", "Brand templates")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      title={lang === "en" ? tpl.hint.en : tpl.hint.fr}
                      onClick={() => apply((p) => applyTemplate(p, tpl.key, brand, nextId, lang))}
                      className="btn-secondary text-2xs"
                    >
                      {lang === "en" ? tpl.label.en : tpl.label.fr}
                    </button>
                  ))}
                </div>
                <p className="text-2xs text-muted">
                  {brand.palette.length > 0 || brand.logoUrl
                    ? t("Couleurs et logo repris du kit de marque.", "Colours and logo taken from the brand kit.")
                    : t("Kit de marque absent — modèles en blanc lisible.", "No brand kit — templates use readable white.")}
                </p>
              </div>
            </div>

            {/* Colonne droite : timeline + réglages */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <ToolButton onClick={() => apply((p) => splitAt(p, playhead, () => nextId("c")))} disabled={project.clips.length === 0}>
                  ✂ {t("Scinder", "Split")}
                </ToolButton>
                <ToolButton onClick={() => selectedClip && apply((p) => removeClip(p, selectedClip.id))} disabled={!selectedClip}>
                  🗑 {t("Supprimer le plan", "Delete clip")}
                </ToolButton>
                <ToolButton onClick={() => selectedClip && apply((p) => duplicateClip(p, selectedClip.id, nextId("c")))} disabled={!selectedClip}>
                  ⧉ {t("Dupliquer", "Duplicate")}
                </ToolButton>
              </div>

              <Timeline
                project={project}
                playhead={playhead}
                selection={selection}
                onSeek={setPlayhead}
                onSelect={setSelection}
                onTrim={(clipId, edge, delta) => apply((p) => trimClip(p, clipId, edge === "head" ? { head: delta } : { tail: delta }))}
                onReorder={(clipId, toIndex) => apply((p) => reorderClip(p, clipId, toIndex))}
              />

              {/* Panneau contextuel — dépend de la sélection */}
              {selectedClip && (
                <Panel title={t("Plan", "Clip")}>
                  <Range
                    label={t("Vitesse", "Speed")} min={0.5} max={2} step={0.1} value={selectedClip.speed}
                    display={`${selectedClip.speed.toFixed(1)}×`}
                    onChange={(v) => apply((p) => setClipSpeed(p, selectedClip.id, v))}
                  />
                  {/* Cadrage — c'est ce qui permet de publier une source
                      horizontale en vertical sans décapiter le sujet. */}
                  <div className="flex flex-wrap items-center gap-2 text-2xs text-muted">
                    <span className="w-24 shrink-0">{t("Cadrage", "Framing")}</span>
                    <Toggle on={selectedClip.fit === "cover"}
                      onClick={() => apply((p) => setClipFraming(p, selectedClip.id, { fit: "cover" }))}>
                      {t("Remplir", "Fill")}
                    </Toggle>
                    <Toggle on={selectedClip.fit === "contain"}
                      onClick={() => apply((p) => setClipFraming(p, selectedClip.id, { fit: "contain" }))}>
                      {t("Entier", "Whole")}
                    </Toggle>
                  </div>
                  {selectedClip.fit === "cover" && (
                    <>
                      <Range label={t("Recadrage ↔", "Reframe ↔")} min={0} max={1} step={0.05} value={selectedClip.focusX}
                        display={`${Math.round(selectedClip.focusX * 100)}%`}
                        onChange={(v) => apply((p) => setClipFraming(p, selectedClip.id, { focusX: v }))} />
                      <Range label={t("Recadrage ↕", "Reframe ↕")} min={0} max={1} step={0.05} value={selectedClip.focusY}
                        display={`${Math.round(selectedClip.focusY * 100)}%`}
                        onChange={(v) => apply((p) => setClipFraming(p, selectedClip.id, { focusY: v }))} />
                    </>
                  )}
                  {project.clips.indexOf(selectedClip) > 0 && (
                    <label className="flex items-center gap-2 text-2xs text-muted">
                      <span className="w-24 shrink-0">{t("Transition", "Transition")}</span>
                      <select
                        value={selectedClip.transitionIn}
                        onChange={(e) => apply((p) => setClipTransition(p, selectedClip.id, e.target.value as TransitionKind))}
                        className="input flex-1 py-0.5 text-2xs"
                      >
                        <option value="none">{t("Coupe franche", "Hard cut")}</option>
                        <option value="fade">{t("Fondu", "Fade")}</option>
                        <option value="dissolve">{t("Fondu enchaîné", "Dissolve")}</option>
                      </select>
                    </label>
                  )}
                  <p className="text-2xs text-muted">
                    {t("Entrée dans la source", "Source in-point")} : {selectedClip.trimStart.toFixed(1)}s ·{" "}
                    {t("durée", "length")} {selectedClip.length.toFixed(1)}s
                  </p>
                </Panel>
              )}

              {selectedText && (
                <Panel title={t("Texte", "Text")}>
                  <textarea
                    value={selectedText.text}
                    onChange={(e) => apply((p) => updateText(p, selectedText.id, { text: e.target.value }))}
                    rows={2}
                    className="input resize-none text-xs"
                  />
                  <Range label={t("Taille", "Size")} min={0.03} max={0.2} step={0.005} value={selectedText.sizePct}
                    display={`${Math.round(selectedText.sizePct * 100)}%`}
                    onChange={(v) => apply((p) => updateText(p, selectedText.id, { sizePct: v }))} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button" aria-label={c}
                        onClick={() => apply((p) => updateText(p, selectedText.id, { color: c }))}
                        className={`h-5 w-5 rounded-full ring-1 ring-hair ${selectedText.color === c ? "ring-2 ring-page" : ""}`}
                        style={{ background: c }} />
                    ))}
                    <Toggle on={selectedText.bold} onClick={() => apply((p) => updateText(p, selectedText.id, { bold: !selectedText.bold }))}>G</Toggle>
                    <Toggle on={selectedText.bg} onClick={() => apply((p) => updateText(p, selectedText.id, { bg: !selectedText.bg }))}>▬</Toggle>
                    <Toggle on={selectedText.outline} onClick={() => apply((p) => updateText(p, selectedText.id, { outline: !selectedText.outline }))}>◌</Toggle>
                    <Toggle on={selectedText.shadow} onClick={() => apply((p) => updateText(p, selectedText.id, { shadow: !selectedText.shadow }))}>◍</Toggle>
                  </div>
                  <BoundsRow
                    start={selectedText.start} end={selectedText.end} max={projectDuration(project)} playhead={playhead}
                    onStart={(v) => apply((p) => updateText(p, selectedText.id, { start: v }))}
                    onEnd={(v) => apply((p) => updateText(p, selectedText.id, { end: v }))}
                  />
                  <button type="button" onClick={() => { apply((p) => removeText(p, selectedText.id)); setSelection(null); }}
                    className="text-2xs text-danger-600 hover:underline">🗑 {t("Supprimer", "Delete")}</button>
                </Panel>
              )}

              {selectedAudio && (
                <Panel title={selectedAudio.name}>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio src={selectedAudio.src} controls className="w-full" />
                  <Range label={t("Volume", "Volume")} min={0} max={1} step={0.05} value={selectedAudio.volume}
                    display={`${Math.round(selectedAudio.volume * 100)}%`}
                    onChange={(v) => apply((p) => updateAudio(p, selectedAudio.id, { volume: v }))} />
                  <Range label={t("Fondu d'entrée", "Fade in")} min={0} max={5} step={0.1} value={selectedAudio.fadeIn}
                    display={`${selectedAudio.fadeIn.toFixed(1)}s`}
                    onChange={(v) => apply((p) => updateAudio(p, selectedAudio.id, { fadeIn: v }))} />
                  <Range label={t("Fondu de sortie", "Fade out")} min={0} max={5} step={0.1} value={selectedAudio.fadeOut}
                    display={`${selectedAudio.fadeOut.toFixed(1)}s`}
                    onChange={(v) => apply((p) => updateAudio(p, selectedAudio.id, { fadeOut: v }))} />
                  <div className="flex items-center gap-2">
                    <Toggle on={selectedAudio.muted} onClick={() => apply((p) => updateAudio(p, selectedAudio.id, { muted: !selectedAudio.muted }))}>
                      {selectedAudio.muted ? "🔇" : "🔊"}
                    </Toggle>
                    <button type="button" onClick={() => { apply((p) => removeAudio(p, selectedAudio.id)); setSelection(null); }}
                      className="text-2xs text-danger-600 hover:underline">🗑 {t("Retirer la piste", "Remove track")}</button>
                  </div>
                </Panel>
              )}

              {selectedImage && (
                <Panel title={t("Incrustation", "Overlay")}>
                  <Range label={t("Taille", "Size")} min={0.05} max={1} step={0.05} value={selectedImage.scale}
                    display={`${Math.round(selectedImage.scale * 100)}%`}
                    onChange={(v) => apply((p) => updateImageLayer(p, selectedImage.id, { scale: v }))} />
                  <Range label={t("Opacité", "Opacity")} min={0.1} max={1} step={0.05} value={selectedImage.opacity}
                    display={`${Math.round(selectedImage.opacity * 100)}%`}
                    onChange={(v) => apply((p) => updateImageLayer(p, selectedImage.id, { opacity: v }))} />
                  <BoundsRow
                    start={selectedImage.start} end={selectedImage.end} max={projectDuration(project)} playhead={playhead}
                    onStart={(v) => apply((p) => updateImageLayer(p, selectedImage.id, { start: v }))}
                    onEnd={(v) => apply((p) => updateImageLayer(p, selectedImage.id, { end: v }))}
                  />
                  <button type="button" onClick={() => { apply((p) => removeImageLayer(p, selectedImage.id)); setSelection(null); }}
                    className="text-2xs text-danger-600 hover:underline">🗑 {t("Supprimer", "Delete")}</button>
                </Panel>
              )}
            </div>
          </div>
        )}

        {/* Pied : export */}
        <div className="space-y-2 border-t border-hair px-4 py-3">
          {note && <p className="text-2xs text-muted">{note}</p>}
          {busy && (
            <p className="flex items-center gap-2 text-2xs text-muted">
              <Spinner size={12} className="text-page" /> {busy}
            </p>
          )}
          {progress > 0 && progress < 100 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
              <div className="h-full bg-page transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs text-muted">
              {t("Rendu", "Render")} : {decision.target === "server" ? t("nos serveurs", "our servers") : t("votre navigateur", "your browser")}
              {" · "}{decision.reason}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary text-xs">{t("Fermer", "Close")}</button>
              <button
                type="button" onClick={exportProject}
                disabled={Boolean(busy) || project.clips.length === 0}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {t("Exporter", "Export")}
              </button>
            </div>
          </div>
        </div>
      </div>

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
}

/* ── Petits composants d'interface ───────────────────────────────────────── */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-hair p-3">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function ToolButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="btn-secondary text-2xs disabled:opacity-40">{children}</button>
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

function Range({
  label, min, max, step, value, display, onChange,
}: {
  label: string; min: number; max: number; step: number; value: number; display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-2xs text-muted">
      <span className="w-24 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-page" />
      <span className="w-10 text-right text-ink">{display}</span>
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
    <div className="flex flex-wrap items-center gap-2 text-2xs text-muted">
      <span>{t("Visible de", "Visible from")} {start.toFixed(1)}s {t("à", "to")} {end.toFixed(1)}s</span>
      <button type="button" onClick={() => onStart(Math.min(playhead, end - 0.1))}
        className="rounded px-1.5 py-0.5 ring-1 ring-hair hover:text-ink">{t("Début ici", "Start here")}</button>
      <button type="button" onClick={() => onEnd(Math.max(playhead, start + 0.1))}
        className="rounded px-1.5 py-0.5 ring-1 ring-hair hover:text-ink">{t("Fin ici", "End here")}</button>
      <button type="button" onClick={() => { onStart(0); onEnd(max); }}
        className="rounded px-1.5 py-0.5 ring-1 ring-hair hover:text-ink">{t("Tout le film", "Whole film")}</button>
    </div>
  );
}

function ImportButton({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className="btn-secondary text-2xs">{label}</button>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </>
  );
}
