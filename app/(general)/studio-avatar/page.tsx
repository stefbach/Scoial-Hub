"use client";

// ── Studio Avatar ────────────────────────────────────────────────────────────
// Visage + sujet → script (Claude) → voix (TTS) → lip-sync (Replicate) → vidéo
// d'avatar parlant. Téléchargeable et publiable.

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

export default function StudioAvatarPage() {
  const { company, access } = useCompany();
  const t = useT();
  const canEdit = access.canEdit;

  const [faceUrl, setFaceUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [seconds, setSeconds] = useState(20);
  const [script, setScript] = useState("");

  const [writing, setWriting] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function genScript() {
    if (!topic.trim()) { setError(t("Indiquez un sujet.", "Enter a topic.")); return; }
    setWriting(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/ai/avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, mode: "script", topic, language, seconds }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("Échec.", "Failed."));
      setScript(d.script ?? "");
      if (d.aiGenerated === false) setNote(t("Démo — IA texte non configurée (ANTHROPIC_API_KEY).", "Demo — text AI not configured (ANTHROPIC_API_KEY)."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setWriting(false); }
  }

  async function genVideo() {
    if (!faceUrl.trim()) { setError(t("Ajoutez l'URL d'une image de visage.", "Add a face image URL.")); return; }
    if (!script.trim()) { setError(t("Générez ou écrivez un script.", "Generate or write a script.")); return; }
    setRendering(true); setError(null); setNote(null); setVideoUrl(null);
    try {
      const r = await fetch("/api/ai/avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, mode: "video", script, faceUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("Échec.", "Failed."));
      if (d.simulated) {
        setNote(t("Génération vidéo non configurée (REPLICATE_API_TOKEN).", "Video generation not configured (REPLICATE_API_TOKEN)."));
      } else if (d.videoUrl) {
        setVideoUrl(d.videoUrl);
      } else {
        setError(t("Aucune vidéo renvoyée.", "No video returned."));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setRendering(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <PageHeader title={t("Studio Avatar", "Avatar Studio")} scoped={false} />
        <p className="-mt-3 max-w-3xl text-sm text-muted">
          {t(
            "Un visage + un sujet → l'IA écrit le script, génère la voix et anime un avatar qui parle. Idéal pour des vidéos courtes social media.",
            "A face + a topic → the AI writes the script, generates the voice and animates a talking avatar. Great for short social videos."
          )}
        </p>
      </div>

      {!canEdit ? (
        <div className="card p-8 text-center text-sm text-muted">
          {t("Accès en lecture seule : la génération d'avatars est réservée aux accès en édition.", "View-only access: avatar generation requires edit access.")}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Colonne réglages */}
          <div className="space-y-4">
            <section className="card p-5 space-y-3">
              <p className="section-label">{t("1 · Visage de l'avatar", "1 · Avatar face")}</p>
              <input value={faceUrl} onChange={(e) => setFaceUrl(e.target.value)} placeholder={t("URL d'un portrait (https://…)", "Portrait URL (https://…)")} className="input" />
              <p className="text-2xs text-muted">{t("Collez l'URL d'une photo de visage nette (ou un visuel de la Médiathèque).", "Paste a clear face photo URL (or a Media library asset).")}</p>
              {faceUrl.trim() && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={faceUrl} alt="" className="h-32 w-32 rounded-xl object-cover ring-1 ring-hair" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              )}
            </section>

            <section className="card p-5 space-y-3">
              <p className="section-label">{t("2 · Script", "2 · Script")}</p>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("Sujet (ex. « Notre nouvelle offre minceur »)", "Topic (e.g. \"Our new weight-loss offer\")")} className="input" />
              <div className="flex flex-wrap items-center gap-2">
                <select value={language} onChange={(e) => setLanguage(e.target.value as "fr" | "en")} className="input w-auto">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
                <label className="inline-flex items-center gap-1.5 text-2xs text-muted">
                  {t("Durée", "Duration")}
                  <input type="number" min={8} max={90} value={seconds} onChange={(e) => setSeconds(Number(e.target.value) || 20)} className="input w-20" /> s
                </label>
                <button onClick={genScript} disabled={writing} className="btn-secondary ml-auto inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                  {writing && <Spinner size={14} className="text-current" />}
                  {writing ? t("Rédaction…", "Writing…") : t("✨ Générer le script", "✨ Generate script")}
                </button>
              </div>
              <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={6} placeholder={t("Le script parlé apparaîtra ici (éditable)…", "The spoken script will appear here (editable)…")} className="input" />
            </section>

            <button onClick={genVideo} disabled={rendering} className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-50">
              {rendering ? <span className="inline-flex items-center gap-2"><Spinner size={16} className="text-white" />{t("Génération de l'avatar…", "Generating avatar…")}</span> : t("🎬 Générer la vidéo avatar", "🎬 Generate avatar video")}
            </button>
            {rendering && <BusyHint label={t("Voix + lip-sync en cours… cela peut prendre 1–3 min.", "Voice + lip-sync in progress… this can take 1–3 min.")} eta="~1–3 min" />}
            {note && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{note}</p>}
            {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
          </div>

          {/* Colonne résultat */}
          <div className="space-y-3">
            <p className="section-label">{t("Résultat", "Result")}</p>
            <div className="card flex aspect-[9/16] max-h-[70vh] items-center justify-center overflow-hidden p-0">
              {videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={videoUrl} controls autoPlay className="h-full w-full object-contain bg-black" />
              ) : (
                <div className="px-6 text-center text-sm text-muted">
                  {t("La vidéo de votre avatar s'affichera ici.", "Your avatar video will appear here.")}
                </div>
              )}
            </div>
            {videoUrl && (
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" download className="btn-secondary inline-flex w-full justify-center text-sm">
                {t("⬇︎ Télécharger la vidéo", "⬇︎ Download video")}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
