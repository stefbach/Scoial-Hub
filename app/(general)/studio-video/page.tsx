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
import PromptStudio from "@/components/studio/PromptStudio";
import BrandKitPanel from "@/components/studio/BrandKitPanel";
import { StudioHero, StudioStep } from "@/components/studio/StudioUI";
import { IconFilm } from "@/components/visual/Icons";

// ── Studio Créatif : images + vidéos → assemblage & marketing pro ────────────────

function kindFromFile(file: File): MediaKind {
  return file.type.startsWith("video") ? "video" : "image";
}
function kindFromUrl(url: string): MediaKind {
  return /\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i.test(url) ? "video" : "image";
}

export default function StudioPage() {
  const { company, access } = useCompany();
  const canEdit = access.canEdit;
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
  const [brandHints, setBrandHints] = useState("");
  // URL publique du logo de marque (https) — incrustée dans le rendu vidéo.
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  // Couleurs de marque appliquées aux textes/CTA incrustés.
  const [brandColors, setBrandColors] = useState<{ text?: string; accent?: string }>({});
  const [pkg, setPkg] = useState<VideoMarketingPackage | null>(null);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = (m: string) => setToast({ message: m, key: Date.now() });

  // Réinitialise le studio au changement de société (évite que des médias ou un
  // package générés pour une société restent affichés/enregistrés sous une autre).
  useEffect(() => {
    setAssets([]);
    setUrlInput("");
    setObjective("");
    setPkg(null);
  }, [company.id]);

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

  // Repart d'un projet vierge (rien n'est figé) : vide les médias, l'objectif et
  // le montage généré. Conserve le brand kit (logo/charte) de la marque.
  function resetStudio() {
    if (typeof window !== "undefined" && !window.confirm(
      t("Réinitialiser le projet ? Médias importés, objectif et montage généré seront effacés.",
        "Reset the project? Imported media, objective and generated edit will be cleared.")
    )) return;
    setAssets([]);
    setUrlInput("");
    setObjective("");
    setPkg(null);
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* En-tête immersif */}
      <StudioHero
        icon={<IconFilm size={24} />}
        title={t("Studio Créatif", "Creative Studio")}
        subtitle={t(
          "Importez des photos et/ou vidéos — on les assemble et on les markète automatiquement, réseau par réseau.",
          "Upload photos and/or videos — we assemble and market them automatically, network by network."
        )}
        actions={
          <button onClick={resetStudio} className="btn-ghost shrink-0 text-xs text-muted" title={t("Repartir d'un projet vierge", "Start a blank project")}>
            {t("↺ Réinitialiser", "↺ Reset")}
          </button>
        }
      />
      <a href="/campaigns/new" className="-mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-page hover:underline">
        {t("→ Créer une pub Meta avec votre média", "→ Create a Meta ad with your media")}
      </a>

      {/* Brand kit persistant — logo / charte / palette, réutilisés partout */}
      <BrandKitPanel
        companyId={company.id}
        brandName={company.name}
        onPromptHints={setBrandHints}
        onKit={(k) => {
          setBrandLogoUrl(/^https?:\/\//.test(k.logoUrl) ? k.logoUrl : "");
          setBrandColors({ text: k.recommendedTextColor, accent: k.palette[0] });
        }}
      />

      {/* Génération par prompt (IA) — image ou vidéo, tous formats publiables */}
      <PromptStudio onGenerated={(a) => setAssets((prev) => [...prev, a])} brandHints={brandHints} />

      {/* Étape 1 : médias */}
      <StudioStep n={1} title={t("Vos médias (photos & vidéos)", "Your media (photos & videos)")}>

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
      </StudioStep>

      {/* Étape 2 : assemblage */}
      <StudioStep n={2} title={t("Que veut-on en faire ?", "What do we make?")}>
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
      </StudioStep>

      {/* Étape 3 : objectif & réseaux */}
      <StudioStep n={3} title={t("Objectif & réseaux", "Objective & networks")}>
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
      </StudioStep>

      <button
        className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-50"
        onClick={marketize}
        disabled={working || uploading || !canEdit || assets.length === 0 || platforms.length === 0}
        title={!canEdit ? t("Lecture seule", "View only") : undefined}
      >
        {working ? t("Le studio travaille…", "The studio is working…") : t("✨ Assembler & marketer", "✨ Assemble & market")}
      </button>
      {canEdit && (assets.length === 0 || platforms.length === 0) && (
        <p className="-mt-2 text-center text-2xs text-muted">
          {assets.length === 0
            ? t("Ajoutez au moins un média (import ou génération IA).", "Add at least one media item (import or AI generation).")
            : t("Choisissez au moins un réseau.", "Choose at least one network.")}
        </p>
      )}

      {/* Résultat */}
      {pkg && (
        <section className="space-y-4">
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-ink break-words">{pkg.title}</h2>
                <p className="mt-0.5 text-sm text-muted break-words">{pkg.summary}</p>
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
              <CutCard key={c.platform} cut={c} assets={pkg.assets} captions={pkg.captions} brandLogoUrl={brandLogoUrl} brandColors={brandColors} companyId={company.id} onCopy={copy} t={t} />
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
  brandLogoUrl,
  brandColors,
  companyId,
  onCopy,
  t,
}: {
  cut: PlatformCut;
  assets: MediaAsset[];
  captions: CaptionSegment[];
  brandLogoUrl?: string;
  brandColors?: { text?: string; accent?: string };
  companyId: string;
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
  const [withLogo, setWithLogo] = useState(true);
  const [slides, setSlides] = useState(cut.slides);

  // Génération d'images (Cloudinary) pour les formats statiques.
  const [imgState, setImgState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [images, setImages] = useState<string[]>([]);
  const [imgErr, setImgErr] = useState<string | null>(null);
  function setSlideText(i: number, text: string) {
    setSlides((prev) => prev.map((s, j) => (j === i ? { ...s, onImageText: text } : s)));
  }
  async function generateImages() {
    setImgErr(null);
    setImgState("loading");
    try {
      const editedCut = { ...cut, hook, slides };
      const res = await fetch("/api/video/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cut: editedCut, assets, companyId }),
      });
      const data = await res.json();
      if (!res.ok || !data.images) {
        setImgState("failed");
        setImgErr(data.error ?? `Erreur ${res.status}`);
        return;
      }
      const imgs = data.images as string[];
      setImages(imgs);
      setImgState("done");
      // → bibliothèque média (réutilisable en pub)
      imgs.forEach((u) => fetch("/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, url: u, type: "image", format: cut.aspect, source: "studio-video" }) }).catch(() => {}));
    } catch {
      setImgState("failed");
      setImgErr("Erreur réseau");
    }
  }

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

  // Garde-fou anti-polling infini : intervalle 4s × 45 ≈ 3 min max.
  const POLL_INTERVAL_MS = 4000;
  const MAX_POLLS = 45;

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function startRender() {
    // Évite un double polling si un rendu précédent tourne encore (coût/réseau).
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setRErr(null);
    setRUrl(null);
    setRState("queued");
    try {
      const editedCut = { ...cut, hook, caption, overlays, musicUrl: resolveMusic() };
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cut: editedCut, assets, captions: caps, logoUrl: withLogo ? brandLogoUrl : undefined, brandColors, companyId }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        setRState(res.status === 422 ? "unsupported" : "failed");
        setRErr(data.error ?? `Erreur ${res.status}`);
        return;
      }
      const id = data.id as string;
      setRState("rendering");
      let polls = 0;
      pollRef.current = setInterval(async () => {
        polls += 1;
        // Garde-fou : au-delà du plafond, on arrête et on invite à réessayer.
        if (polls > MAX_POLLS) {
          if (pollRef.current) clearInterval(pollRef.current);
          setRErr(t("Rendu trop long, réessayez.", "Render took too long, please retry."));
          setRState("failed");
          return;
        }
        try {
          const s = await fetch(`/api/video/render/${encodeURIComponent(id)}`).then((r) => r.json());
          if (s.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            setRState("done");
            let finalUrl: string | null = s.url ?? null;
            if (finalUrl) {
              // Persiste le rendu (URL Shotstack éphémère) → stockage durable.
              try {
                const pr = await fetch("/api/media/persist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, url: finalUrl, kind: "video" }) });
                const pd = await pr.json();
                if (pr.ok && pd.url) finalUrl = pd.url;
              } catch { /* garde l'URL d'origine */ }
              setRUrl(finalUrl);
              fetch("/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, url: finalUrl, type: "video", format: cut.aspect, source: "studio-video" }) }).catch(() => {});
            }
          } else if (s.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setRErr(s.error ?? t("Échec du rendu", "Render failed"));
            setRState("failed");
          }
        } catch { /* retry next tick */ }
      }, POLL_INTERVAL_MS);
    } catch {
      setRState("failed");
      setRErr("Erreur réseau");
    }
  }

  const renderable = RENDERABLE.has(cut.assemblyType);
  return (
    <div className="card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 truncate font-semibold text-ink">{cut.label}</span>
          <span className="chip">{cut.aspect}</span>
          <span className="chip border-primary-200 bg-primary-50 text-primary-700">{t(badge[0], badge[1])}</span>
          {!isStatic && <span className="text-2xs text-muted">~{cut.targetDurationSec}s</span>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold ${cut.renderStatus === "queued" ? "bg-primary-50 text-primary-700" : "bg-canvas text-muted ring-1 ring-hair"}`}>
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

      {slides.length > 0 && (
        <Field label={t("Slides — texte modifiable", "Slides — editable text")}>
          <div className="space-y-1.5">
            {slides.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-2xs font-bold text-primary">{s.index}</span>
                <input className="input flex-1 text-xs" value={s.onImageText} onChange={(e) => setSlideText(i, e.target.value)} placeholder={s.note} />
              </div>
            ))}
          </div>
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

      {renderable && (
        <Field label={t("🏷️ Logo de la marque", "🏷️ Brand logo")}>
          {brandLogoUrl ? (
            <label className="flex items-center gap-2 text-xs text-ink">
              <input type="checkbox" checked={withLogo} onChange={(e) => setWithLogo(e.target.checked)} className="accent-primary-600" />
              {t("Incruster le logo (haut droite)", "Burn in the logo (top right)")}
            </label>
          ) : (
            <p className="text-2xs text-muted">{t("Importez un logo dans le brand kit pour l'incruster dans la vidéo.", "Upload a logo in the brand kit to burn it into the video.")}</p>
          )}
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
              <video src={rUrl} controls preload="metadata" className="w-full rounded-lg border border-hair" />
              <p className="text-2xs text-success-600">{t("✓ Enregistrée dans la Médiathèque", "✓ Saved to the Media library")}</p>
              <div className="flex gap-2">
                <a href={rUrl} target="_blank" rel="noopener noreferrer" download className="btn-secondary flex-1 justify-center text-2xs">
                  ⬇ {t("Télécharger", "Download")}
                </a>
                <a href={`/compose?media=${encodeURIComponent(rUrl)}&kind=video`} className="btn-primary flex-1 justify-center text-2xs">
                  {t("Publier / Programmer →", "Publish / Schedule →")}
                </a>
                <button className="btn-ghost shrink-0 text-2xs" onClick={startRender}>
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

      {/* Génération d'images finales (formats statiques) */}
      {!renderable && (
        <div className="mt-3 border-t border-hair pt-3">
          {imgState === "idle" && (
            <button className="btn-primary w-full justify-center text-2xs" onClick={generateImages}>
              🖼️ {t("Générer les visuels", "Generate the visuals")}
            </button>
          )}
          {imgState === "loading" && (
            <div className="flex items-center gap-2 text-2xs text-muted">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              {t("Génération des visuels…", "Generating visuals…")}
            </div>
          )}
          {imgState === "done" && images.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {images.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" download className="group relative block overflow-hidden rounded-lg border border-hair">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`visuel ${i + 1}`} className="h-32 w-full object-cover" />
                    <span className="absolute bottom-1 right-1 rounded bg-ink/70 px-1.5 py-0.5 text-2xs text-white opacity-0 transition-opacity group-hover:opacity-100">⬇</span>
                  </a>
                ))}
              </div>
              <button className="btn-secondary w-full justify-center text-2xs" onClick={generateImages}>
                ↻ {t("Régénérer avec mes textes", "Re-generate with my texts")}
              </button>
            </div>
          )}
          {imgState === "failed" && (
            <div className="text-2xs text-danger">
              {imgErr ?? t("Échec.", "Failed.")}
              <button className="ml-2 underline" onClick={generateImages}>{t("Réessayer", "Retry")}</button>
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
