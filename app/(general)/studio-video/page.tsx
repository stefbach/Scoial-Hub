"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/ui/Toast";
import { VIDEO_PLATFORMS, type VideoMarketingPackage, type VideoPlatform, type PlatformCut } from "@/lib/video/types";
import { captionsToSrt } from "@/lib/video/srt";

// ── Studio Vidéo : déposez une vidéo brute → déclinaisons marketing pro ──────────

export default function StudioVideoPage() {
  const { company } = useCompany();
  const t = useT();
  const { lang } = useLang();

  const [sourceUrl, setSourceUrl] = useState("");
  const [objective, setObjective] = useState("");
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

  // ── Upload de fichier vers Supabase Storage (sinon : coller une URL) ──────────
  const onFile = useCallback(
    async (file: File) => {
      const supabase = createClient();
      if (!supabase) {
        notify(t("Stockage indisponible — collez plutôt l'URL de la vidéo.", "Storage unavailable — paste the video URL instead."));
        return;
      }
      setUploading(true);
      try {
        const path = `${company.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error } = await supabase.storage.from("sh-videos").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "video/mp4",
        });
        if (error) throw error;
        const { data } = supabase.storage.from("sh-videos").getPublicUrl(path);
        setSourceUrl(data.publicUrl);
        notify(t("Vidéo importée.", "Video uploaded."));
      } catch (e) {
        notify(t(`Échec de l'import : ${e instanceof Error ? e.message : "erreur"}`, `Upload failed: ${e instanceof Error ? e.message : "error"}`));
      } finally {
        setUploading(false);
      }
    },
    [company.id, t]
  );

  async function marketize() {
    if (!sourceUrl.trim()) {
      notify(t("Importez une vidéo ou collez son URL.", "Upload a video or paste its URL."));
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
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim(),
          objective,
          platforms,
          brandVoice: company.brandVoice,
          lang,
          companyId: company.id,
        }),
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
    if (!pkg) return;
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

  return (
    <div className="animate-fade-in space-y-5">
      {/* En-tête */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-card px-5 py-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: "linear-gradient(135deg,#5b2d8e,#7c3aed)" }} aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v13A1.5 1.5 0 0 1 14.5 20h-9A1.5 1.5 0 0 1 4 18.5v-13Z" stroke="white" strokeWidth="1.6"/><path d="m16 10 4-2.5v9L16 14" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/></svg>
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{t("Studio Vidéo", "Video Studio")}</h1>
          <p className="mt-0.5 text-sm text-primary-700">
            {t(
              "Déposez une vidéo simple — on la retraite et on la markète automatiquement, réseau par réseau, comme un vrai studio.",
              "Drop in a simple video — we reprocess and market it automatically, network by network, like a real studio."
            )}
          </p>
        </div>
      </div>

      {/* Étape 1 : source */}
      <section className="card p-5">
        <div className="section-label mb-3">{t("1 · Votre vidéo brute", "1 · Your raw video")}</div>

        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hair bg-canvas px-4 py-8 text-center transition-colors hover:border-primary-300"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-muted"><path d="M12 16V4m0 0L7 9m5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          <p className="text-sm text-ink">
            {uploading ? t("Import en cours…", "Uploading…") : t("Glissez-déposez votre vidéo ici", "Drag & drop your video here")}
          </p>
          <button className="btn-secondary text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {t("Choisir un fichier", "Choose a file")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <p className="text-2xs text-muted">{t("MP4, MOV, WebM — jusqu'à 500 Mo", "MP4, MOV, WebM — up to 500 MB")}</p>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">{t("…ou collez une URL de vidéo", "…or paste a video URL")}</label>
          <input className="input w-full" placeholder="https://…/ma-video.mp4" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </div>
      </section>

      {/* Étape 2 : brief */}
      <section className="card p-5">
        <div className="section-label mb-3">{t("2 · Objectif & réseaux", "2 · Objective & networks")}</div>
        <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Objectif marketing", "Marketing objective")}</label>
        <input
          className="input mb-4 w-full"
          placeholder={t("Ex : générer des leads pour notre nouveau service", "E.g. generate leads for our new service")}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
        <label className="mb-2 block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Réseaux cibles", "Target networks")}</label>
        <div className="flex flex-wrap gap-2">
          {platformChips.map((p) => {
            const on = platforms.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`chip transition-colors ${on ? "border-primary-300 bg-primary-50 text-primary-700" : ""}`}
              >
                {on ? "✓ " : ""}{p.label} · {p.aspect}
              </button>
            );
          })}
        </div>
      </section>

      {/* Action */}
      <button className="btn-primary w-full justify-center py-3 text-sm" onClick={marketize} disabled={working || uploading}>
        {working ? t("Le studio travaille…", "The studio is working…") : t("✨ Marketer automatiquement", "✨ Auto-market this video")}
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
                {pkg.aiGenerated ? t("Généré par l'IA", "AI-generated") : t("Modèle (clé IA absente)", "Template (no AI key)")}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-secondary text-xs" onClick={downloadSrt}>{t("⬇ Sous-titres .srt", "⬇ Subtitles .srt")}</button>
              <span className="chip">{pkg.cuts.length} {t("déclinaisons", "cuts")}</span>
              {!pkg.renderConfigured && (
                <span className="chip border-warning-200 bg-warning-50 text-warning-700">{t("Rendu : simulé", "Render: simulated")}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pkg.cuts.map((c) => (
              <CutCard key={c.platform} cut={c} onCopy={copy} t={t} />
            ))}
          </div>
        </section>
      )}

      {toast && <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ── Carte par réseau ────────────────────────────────────────────────────────────

function CutCard({
  cut,
  onCopy,
  t,
}: {
  cut: PlatformCut;
  onCopy: (text: string, label: string) => void;
  t: (fr: string, en: string) => string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{cut.label}</span>
          <span className="chip">{cut.aspect}</span>
          <span className="text-2xs text-muted">~{cut.targetDurationSec}s</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${cut.renderStatus === "queued" ? "bg-primary-50 text-primary-700" : "bg-canvas text-muted ring-1 ring-hair"}`}>
          {cut.renderStatus === "queued" ? t("Rendu en file", "Render queued") : t("Rendu simulé", "Render simulated")}
        </span>
      </div>

      {/* Hook */}
      <Field label={t("Accroche (0-3 s)", "Hook (0-3s)")}>
        <p className="text-sm font-medium text-ink">{cut.hook}</p>
        {cut.hookVariants.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-2xs text-muted">
            {cut.hookVariants.map((h, i) => <li key={i}>• {h}</li>)}
          </ul>
        )}
      </Field>

      {/* Montage */}
      <Field label={t("Montage & rythme", "Editing & pacing")}>
        <p className="text-xs text-muted">🎵 {cut.musicMood}</p>
        <p className="text-xs text-muted">🎬 {cut.pacing}</p>
        <ul className="mt-1 space-y-0.5 text-xs text-ink">
          {cut.editNotes.map((n, i) => <li key={i} className="flex gap-1.5"><span className="text-primary">›</span>{n}</li>)}
        </ul>
      </Field>

      {/* Overlays */}
      {cut.overlays.length > 0 && (
        <Field label={t("Textes à l'écran", "On-screen text")}>
          <ul className="space-y-0.5 text-xs text-muted">
            {cut.overlays.map((o, i) => (
              <li key={i}><span className="font-mono text-2xs text-primary">{o.atSecond}s</span> · {o.text} <span className="text-2xs italic">({o.style})</span></li>
            ))}
          </ul>
        </Field>
      )}

      {/* Copy */}
      <Field label={t("Texte du post", "Post caption")}>
        <p className="whitespace-pre-wrap text-sm text-ink">{cut.caption}</p>
        <p className="mt-1 text-xs text-primary-600">{cut.hashtags.join(" ")}</p>
        <p className="mt-1 text-xs text-muted">📣 {cut.cta}</p>
      </Field>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-hair pt-3">
        <button className="btn-secondary text-2xs" onClick={() => onCopy(`${cut.caption}\n\n${cut.hashtags.join(" ")}`, t("Légende", "Caption"))}>
          {t("Copier la légende", "Copy caption")}
        </button>
        <button className="btn-secondary text-2xs" onClick={() => onCopy(cut.hashtags.join(" "), t("Hashtags", "Hashtags"))}>
          {t("Copier hashtags", "Copy hashtags")}
        </button>
        <button className="btn-secondary text-2xs" onClick={() => onCopy(cut.thumbnailText, t("Vignette", "Thumbnail"))}>
          {t("Texte vignette", "Thumbnail text")}
        </button>
      </div>
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
