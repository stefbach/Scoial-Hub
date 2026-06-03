"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/ui/Toast";
import {
  VIDEO_PLATFORMS,
  ASSEMBLY_MODES,
  MUSIC_TRACKS,
  type AssemblyMode,
  type MediaAsset,
  type MediaKind,
  type VideoMarketingPackage,
  type VideoPlatform,
  type PlatformCut,
  type CaptionSegment,
} from "@/lib/video/types";
import { captionsToSrt } from "@/lib/video/srt";

// ── Studio Créatif : images + vidéos → assemblage & marketing pro ────────────────

function kindFromFile(file: File): MediaKind {
  return file.type.startsWith("video") ? "video" : "image";
}
function kindFromUrl(url: string): MediaKind {
  return /\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i.test(url) ? "video" : "image";
}

export default function StudioPage() {
  const { company } = useCompany();
  const t = useT();
  const { lang } = useLang();

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlKind, setUrlKind] = useState<MediaKind>("image");
  const [objective, setObjective] = useState("");
  const [assembly, setAssembly] = useState<AssemblyMode>("auto");
  const [platforms, setPlatforms] = useState<VideoPlatform[]>(["tiktok", "instagram_reels", "linkedin"]);
  const [uploading, setUploading] = useState(false);
  const [working, setWorking] = useState(false);
  const [pkg, setPkg] = useState<VideoMarketingPackage | null>(null);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = (m: string) => setToast({ message: m, key: Date.now() });

  function togglePlatform(p: VideoPlatform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }
  function removeAsset(url: string) {
    setAssets((prev) => prev.filter((a) => a.url !== url));
  }
  function addUrl() {
    const u = urlInput.trim();
    if (!u) return;
    setAssets((prev) => [...prev, { url: u, kind: urlKind, name: u.split("/").pop() }]);
    setUrlInput("");
  }

  const onFiles = useCallback(
    async (files: FileList) => {
      const supabase = createClient();
      if (!supabase) {
        notify(t("Stockage indisponible — ajoutez plutôt des URLs.", "Storage unavailable — add URLs instead."));
        return;
      }
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const path = `${company.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
          const { error } = await supabase.storage.from("sh-videos").upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });
          if (error) throw error;
          const { data } = supabase.storage.from("sh-videos").getPublicUrl(path);
          setAssets((prev) => [...prev, { url: data.publicUrl, kind: kindFromFile(file), name: file.name }]);
        }
        notify(t("Médias importés.", "Media uploaded."));
      } catch (e) {
        notify(t(`Échec de l'import : ${e instanceof Error ? e.message : "erreur"}`, `Upload failed: ${e instanceof Error ? e.message : "error"}`));
      } finally {
        setUploading(false);
      }
    },
    [company.id, t]
  );

  async function marketize() {
    if (assets.length === 0) {
      notify(t("Ajoutez au moins une image ou vidéo.", "Add at least one image or video."));
      return;
    }
    if (platforms.length === 0) {
      notify(t("Choisissez au moins un réseau.", "Pick at least one network."));
      return;
    }
    setWorking(true);
    setPkg(null);
    try {
      const res = await fetch("/api/video/marketize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets, assembly, objective, platforms, brandVoice: company.brandVoice, lang, companyId: company.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(t(`Erreur : ${data.error ?? res.status}`, `Error: ${data.error ?? res.status}`));
        return;
      }
      setPkg(data as VideoMarketingPackage);
    } catch {
      notify(t("Erreur réseau.", "Network error."));
    } finally {
      setWorking(false);
    }
  }

  function downloadSrt() {
    if (!pkg || pkg.captions.length === 0) return;
    const blob = new Blob([captionsToSrt(pkg.captions)], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sous-titres.srt";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(
      () => notify(t(`${label} copié.`, `${label} copied.`)),
      () => notify(t("Copie impossible.", "Copy failed."))
    );
  }

  const platformChips = useMemo(() => VIDEO_PLATFORMS, []);
  const imageCount = assets.filter((a) => a.kind === "image").length;
  const videoCount = assets.filter((a) => a.kind === "video").length;

  return (
    <div className="animate-fade-in space-y-5">
      {/* En-tête */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-card px-5 py-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: "linear-gradient(135deg,#5b2d8e,#7c3aed)" }} aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="white" strokeWidth="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="white" strokeWidth="1.6"/><path d="M3 16.5A1.5 1.5 0 0 1 4.5 15h6A1.5 1.5 0 0 1 12 16.5v3A1.5 1.5 0 0 1 10.5 21h-6A1.5 1.5 0 0 1 3 19.5v-3Z" stroke="white" strokeWidth="1.6"/><path d="m15 18 6-3v6l-6-3Z" fill="white"/></svg>
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{t("Studio Créatif", "Creative Studio")}</h1>
          <p className="mt-0.5 text-sm text-primary-700">
            {t(
              "Importez des photos et/ou vidéos — on les assemble et on les markète automatiquement, réseau par réseau.",
              "Upload photos and/or videos — we assemble and market them automatically, network by network."
            )}
          </p>
        </div>
      </div>

      {/* Étape 1 : médias */}
      <section className="card p-5">
        <div className="section-label mb-3">{t("1 · Vos médias (photos & vidéos)", "1 · Your media (photos & videos)")}</div>

        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hair bg-canvas px-4 py-7 text-center transition-colors hover:border-primary-300"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-muted"><path d="M12 16V4m0 0L7 9m5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          <p className="text-sm text-ink">{uploading ? t("Import en cours…", "Uploading…") : t("Glissez-déposez vos photos et vidéos", "Drag & drop your photos and videos")}</p>
          <button className="btn-secondary text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>{t("Choisir des fichiers", "Choose files")}</button>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => e.target.files && onFiles(e.target.files)} />
          <p className="text-2xs text-muted">{t("JPG, PNG, MP4, MOV… plusieurs fichiers acceptés", "JPG, PNG, MP4, MOV… multiple files accepted")}</p>
        </div>

        {/* Ajouter par URL */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select className="input sm:w-32" value={urlKind} onChange={(e) => setUrlKind(e.target.value as MediaKind)}>
            <option value="image">{t("Image", "Image")}</option>
            <option value="video">{t("Vidéo", "Video")}</option>
          </select>
          <input
            className="input flex-1"
            placeholder={t("…ou collez une URL puis Ajouter", "…or paste a URL then Add")}
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlKind(kindFromUrl(e.target.value)); }}
            onKeyDown={(e) => e.key === "Enter" && addUrl()}
          />
          <button className="btn-secondary shrink-0 text-xs" onClick={addUrl}>{t("Ajouter", "Add")}</button>
        </div>

        {/* Liste des médias */}
        {assets.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 text-2xs text-muted">{imageCount} {t("image(s)", "image(s)")} · {videoCount} {t("vidéo(s)", "video(s)")}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {assets.map((a) => (
                <div key={a.url} className="group relative overflow-hidden rounded-lg border border-hair bg-canvas">
                  {a.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.name ?? ""} className="h-24 w-full object-cover" />
                  ) : (
                    <video src={a.url} className="h-24 w-full object-cover" muted />
                  )}
                  <span className="absolute left-1 top-1 rounded bg-ink/70 px-1.5 py-0.5 text-2xs font-semibold text-white">
                    {a.kind === "image" ? "IMG" : "VID"}
                  </span>
                  <button
                    onClick={() => removeAsset(a.url)}
                    className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={t("Retirer", "Remove")}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Étape 2 : assemblage */}
      <section className="card p-5">
        <div className="section-label mb-3">{t("2 · Que veut-on en faire ?", "2 · What do we make?")}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ASSEMBLY_MODES.map((mode) => {
            const on = assembly === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setAssembly(mode.id)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${on ? "border-primary-300 bg-primary-50" : "border-hair bg-canvas hover:border-primary-200"}`}
              >
                <div className={`text-sm font-semibold ${on ? "text-primary-700" : "text-ink"}`}>{on ? "✓ " : ""}{t(mode.labelFr, mode.labelEn)}</div>
                <div className="mt-0.5 text-2xs leading-snug text-muted">{t(mode.descFr, mode.descEn)}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Étape 3 : objectif & réseaux */}
      <section className="card p-5">
        <div className="section-label mb-3">{t("3 · Objectif & réseaux", "3 · Objective & networks")}</div>
        <input
          className="input mb-4 w-full"
          placeholder={t("Objectif marketing (ex : générer des leads)", "Marketing objective (e.g. generate leads)")}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {platformChips.map((p) => {
            const on = platforms.includes(p.id);
            return (
              <button key={p.id} onClick={() => togglePlatform(p.id)} className={`chip transition-colors ${on ? "border-primary-300 bg-primary-50 text-primary-700" : ""}`}>
                {on ? "✓ " : ""}{p.label} · {p.aspect}
              </button>
            );
          })}
        </div>
      </section>

      <button className="btn-primary w-full justify-center py-3 text-sm" onClick={marketize} disabled={working || uploading}>
        {working ? t("Le studio travaille…", "The studio is working…") : t("✨ Assembler & marketer", "✨ Assemble & market")}
      </button>

      {/* Résultat */}
      {pkg && (
        <section className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ink">{pkg.title}</h2>
                <p className="mt-0.5 text-sm text-muted">{pkg.summary}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold ${pkg.aiGenerated ? "bg-success-100 text-success-700" : "bg-warning-50 text-warning-700"}`}>
                {pkg.aiGenerated ? t("Généré par l'IA", "AI-generated") : t("Modèle de secours", "Fallback template")}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {pkg.captions.length > 0 && <button className="btn-secondary text-xs" onClick={downloadSrt}>{t("⬇ Sous-titres .srt", "⬇ Subtitles .srt")}</button>}
              <span className="chip">{pkg.cuts.length} {t("déclinaisons", "cuts")}</span>
              {!pkg.renderConfigured && <span className="chip border-warning-200 bg-warning-50 text-warning-700">{t("Rendu : simulé", "Render: simulated")}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pkg.cuts.map((c) => (
              <CutCard key={c.platform} cut={c} assets={pkg.assets} captions={pkg.captions} onCopy={copy} t={t} />
            ))}
          </div>
        </section>
      )}

      {toast && <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ── Carte par réseau ────────────────────────────────────────────────────────────

const ASSEMBLY_BADGE: Record<AssemblyMode, [string, string]> = {
  auto: ["Auto", "Auto"],
  carousel: ["Carrousel", "Carousel"],
  slideshow: ["Diaporama", "Slideshow"],
  collage: ["Collage", "Collage"],
  single: ["Visuel", "Visual"],
  video: ["Vidéo", "Video"],
  video_montage: ["Montage", "Montage"],
};

const RENDERABLE = new Set<AssemblyMode>(["video", "video_montage", "slideshow"]);

function CutCard({
  cut,
  assets,
  captions,
  onCopy,
  t,
}: {
  cut: PlatformCut;
  assets: MediaAsset[];
  captions: CaptionSegment[];
  onCopy: (text: string, label: string) => void;
  t: (fr: string, en: string) => string;
}) {
  const isStatic = cut.targetDurationSec === 0;
  const badge = ASSEMBLY_BADGE[cut.assemblyType] ?? ["", ""];

  // ── Champs ÉDITABLES (vrai studio) ───────────────────────────────────────────
  const [hook, setHook] = useState(cut.hook);
  const [caption, setCaption] = useState(cut.caption);
  const [overlays, setOverlays] = useState(cut.overlays);
  const [caps, setCaps] = useState<CaptionSegment[]>(captions);
  const [musicId, setMusicId] = useState("none");
  const [customMusic, setCustomMusic] = useState("");

  function resolveMusic(): string {
    if (customMusic.trim()) return customMusic.trim();
    return MUSIC_TRACKS.find((m) => m.id === musicId)?.url ?? "";
  }
  function setOverlayText(i: number, text: string) {
    setOverlays((prev) => prev.map((o, j) => (j === i ? { ...o, text } : o)));
  }
  function setCapText(i: number, text: string) {
    setCaps((prev) => prev.map((c, j) => (j === i ? { ...c, text } : c)));
  }

  // ── Rendu vidéo (Shotstack) ──────────────────────────────────────────────────
  const [rState, setRState] = useState<"idle" | "queued" | "rendering" | "done" | "failed" | "unsupported">("idle");
  const [rUrl, setRUrl] = useState<string | null>(null);
  const [rErr, setRErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function startRender() {
    setRErr(null);
    setRUrl(null);
    setRState("queued");
    try {
      const editedCut = { ...cut, hook, caption, overlays, musicUrl: resolveMusic() };
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cut: editedCut, assets, captions: caps }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        setRState(res.status === 422 ? "unsupported" : "failed");
        setRErr(data.error ?? `Erreur ${res.status}`);
        return;
      }
      const id = data.id as string;
      setRState("rendering");
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/video/render/${encodeURIComponent(id)}`).then((r) => r.json());
          if (s.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            setRUrl(s.url ?? null);
            setRState("done");
          } else if (s.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setRErr(s.error ?? "Échec du rendu");
            setRState("failed");
          }
        } catch { /* retry next tick */ }
      }, 4000);
    } catch {
      setRState("failed");
      setRErr("Erreur réseau");
    }
  }

  const renderable = RENDERABLE.has(cut.assemblyType);
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{cut.label}</span>
          <span className="chip">{cut.aspect}</span>
          <span className="chip border-primary-200 bg-primary-50 text-primary-700">{t(badge[0], badge[1])}</span>
          {!isStatic && <span className="text-2xs text-muted">~{cut.targetDurationSec}s</span>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${cut.renderStatus === "queued" ? "bg-primary-50 text-primary-700" : "bg-canvas text-muted ring-1 ring-hair"}`}>
          {cut.renderStatus === "queued" ? t("Rendu en file", "Render queued") : t("Rendu simulé", "Render simulated")}
        </span>
      </div>

      <Field label={t("Accroche (modifiable)", "Hook (editable)")}>
        <input className="input w-full text-sm" value={hook} onChange={(e) => setHook(e.target.value)} />
        {cut.hookVariants.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cut.hookVariants.map((h, i) => (
              <button key={i} type="button" onClick={() => setHook(h)} className="chip text-2xs hover:bg-primary-50 hover:text-primary-700" title={t("Utiliser cette variante", "Use this variant")}>
                {h.length > 38 ? h.slice(0, 38) + "…" : h}
              </button>
            ))}
          </div>
        )}
      </Field>

      {cut.slides.length > 0 && (
        <Field label={t("Slides", "Slides")}>
          <ol className="space-y-1 text-xs text-ink">
            {cut.slides.map((s) => (
              <li key={s.index} className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-2xs font-bold text-primary">{s.index}</span>
                <span><span className="font-medium">{s.onImageText}</span> <span className="text-muted">— {s.note}</span></span>
              </li>
            ))}
          </ol>
        </Field>
      )}

      {(cut.musicMood || cut.pacing || cut.editNotes.length > 0) && (
        <Field label={t("Assemblage & montage", "Assembly & editing")}>
          {cut.musicMood && <p className="text-xs text-muted">🎵 {cut.musicMood}</p>}
          {cut.pacing && <p className="text-xs text-muted">🎬 {cut.pacing}</p>}
          {cut.editNotes.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-ink">{cut.editNotes.map((n, i) => <li key={i} className="flex gap-1.5"><span className="text-primary">›</span>{n}</li>)}</ul>
          )}
        </Field>
      )}

      {overlays.length > 0 && (
        <Field label={t("Textes à l'écran (modifiables)", "On-screen text (editable)")}>
          <div className="space-y-1.5">
            {overlays.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-9 shrink-0 font-mono text-2xs text-primary">{o.atSecond}s</span>
                <input className="input flex-1 text-xs" value={o.text} onChange={(e) => setOverlayText(i, e.target.value)} />
                <span className="shrink-0 text-2xs italic text-muted">{o.style}</span>
              </div>
            ))}
          </div>
        </Field>
      )}

      {renderable && (
        <Field label={t("🎵 Musique", "🎵 Music")}>
          <select className="input w-full text-sm" value={musicId} onChange={(e) => { setMusicId(e.target.value); setCustomMusic(""); }}>
            {MUSIC_TRACKS.map((m) => (
              <option key={m.id} value={m.id}>{t(m.labelFr, m.labelEn)}</option>
            ))}
          </select>
          <input
            className="input mt-1.5 w-full text-xs"
            placeholder={t("…ou collez l'URL d'un MP3 perso", "…or paste a custom MP3 URL")}
            value={customMusic}
            onChange={(e) => setCustomMusic(e.target.value)}
          />
        </Field>
      )}

      {renderable && caps.length > 0 && (
        <Field label={t("Sous-titres incrustés (modifiables)", "Burned-in subtitles (editable)")}>
          <div className="space-y-1.5">
            {caps.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 shrink-0 font-mono text-2xs text-primary">{c.start}-{c.end}s</span>
                <input className="input flex-1 text-xs" value={c.text} onChange={(e) => setCapText(i, e.target.value)} />
              </div>
            ))}
          </div>
        </Field>
      )}

      <Field label={t("Message du post (modifiable)", "Post message (editable)")}>
        <textarea className="input w-full text-sm" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
        {cut.hashtags.length > 0 && <p className="mt-1 text-xs text-primary-600">{cut.hashtags.join(" ")}</p>}
        {cut.cta && <p className="mt-1 text-xs text-muted">📣 {cut.cta}</p>}
      </Field>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-hair pt-3">
        <button className="btn-secondary text-2xs" onClick={() => onCopy(`${caption}\n\n${cut.hashtags.join(" ")}`, t("Légende", "Caption"))}>{t("Copier la légende", "Copy caption")}</button>
        {cut.hashtags.length > 0 && <button className="btn-secondary text-2xs" onClick={() => onCopy(cut.hashtags.join(" "), t("Hashtags", "Hashtags"))}>{t("Copier hashtags", "Copy hashtags")}</button>}
        {cut.thumbnailText && <button className="btn-secondary text-2xs" onClick={() => onCopy(cut.thumbnailText, t("Vignette", "Thumbnail"))}>{t("Texte vignette", "Thumbnail text")}</button>}
      </div>

      {/* Rendu vidéo réel */}
      {renderable && (
        <div className="mt-3 border-t border-hair pt-3">
          {rState === "idle" && (
            <button className="btn-primary w-full justify-center text-2xs" onClick={startRender}>
              🎬 {t("Générer la vidéo (avec mes ajustements)", "Render the video (with my edits)")}
            </button>
          )}
          {(rState === "queued" || rState === "rendering") && (
            <div className="flex items-center gap-2 text-2xs text-muted">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              {t("Rendu en cours… (peut prendre 1-2 min)", "Rendering… (may take 1-2 min)")}
            </div>
          )}
          {rState === "done" && rUrl && (
            <div className="space-y-2">
              <video src={rUrl} controls className="w-full rounded-lg border border-hair" />
              <div className="flex gap-2">
                <a href={rUrl} target="_blank" rel="noopener noreferrer" download className="btn-primary flex-1 justify-center text-2xs">
                  ⬇ {t("Télécharger", "Download")}
                </a>
                <button className="btn-secondary shrink-0 text-2xs" onClick={startRender}>
                  ↻ {t("Régénérer", "Re-render")}
                </button>
              </div>
            </div>
          )}
          {rState === "unsupported" && (
            <p className="text-2xs text-muted">{t("Format statique — pas de rendu vidéo.", "Static format — no video render.")}</p>
          )}
          {rState === "failed" && (
            <div className="text-2xs text-danger">
              {rErr ?? t("Échec du rendu.", "Render failed.")}
              <button className="ml-2 underline" onClick={startRender}>{t("Réessayer", "Retry")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5 border-t border-hair pt-2.5 first:mt-0 first:border-0 first:pt-0">
      <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  );
}
