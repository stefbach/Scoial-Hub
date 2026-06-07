"use client";

// ── Studio Avatar ────────────────────────────────────────────────────────────
// Visage + sujet → script (Claude) → voix (TTS) → lip-sync (Replicate) → vidéo
// d'avatar parlant. Téléchargeable et publiable.

import { useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_MODELS, DEFAULT_AVATAR_MODEL, AVATAR_LANGS } from "@/lib/ai/avatar-models";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL_ID } from "@/lib/ai/model-catalog";

/** Convertit n'importe quelle erreur (string | objet plateforme | …) en texte lisible. */
function errText(e: unknown, fallback: string): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; error?: unknown };
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
    try { return JSON.stringify(e); } catch { /* ignore */ }
  }
  return fallback;
}

/** Première URL d'image d'une réponse /api/ai/generate-image. */
function firstImage(d: unknown): string | null {
  const imgs = (d as { images?: Array<string | { url?: string }> })?.images;
  if (!Array.isArray(imgs)) return null;
  for (const i of imgs) {
    const u = typeof i === "string" ? i : i?.url;
    if (u) return u;
  }
  return null;
}

export default function StudioAvatarPage() {
  const { company, access } = useCompany();
  const t = useT();
  const canEdit = access.canEdit;

  const [faceUrl, setFaceUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("fr");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [subtitles, setSubtitles] = useState(false);
  const [seconds, setSeconds] = useState(20);
  const [script, setScript] = useState("");
  const [environment, setEnvironment] = useState("");
  const [lipsyncModel, setLipsyncModel] = useState(DEFAULT_AVATAR_MODEL);
  const [personMode, setPersonMode] = useState<"upload" | "generate">("upload");
  const [personPrompt, setPersonPrompt] = useState("");
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL_ID);

  const [composing, setComposing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFace(files: FileList | null) {
    if (!files || files.length === 0) return;
    const sb = createClient();
    if (!sb) { setError(t("Stockage indisponible.", "Storage unavailable.")); return; }
    setUploading(true); setError(null);
    try {
      const file = files[0];
      const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${company.id}/avatar/${Date.now()}-${safe}`;
      const { error: upErr } = await sb.storage.from("sh-videos").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) { setError(t("Échec de l'envoi.", "Upload failed.")); return; }
      const { data } = sb.storage.from("sh-videos").getPublicUrl(path);
      if (data?.publicUrl) setFaceUrl(data.publicUrl);
    } catch {
      setError(t("Échec de l'envoi.", "Upload failed."));
    } finally { setUploading(false); }
  }

  // Génère une personne (portrait) depuis un prompt → devient l'avatar.
  async function genPerson() {
    if (!personPrompt.trim()) { setError(t("Décrivez la personne à générer.", "Describe the person to generate.")); return; }
    setComposing(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          model: imageModel,
          format: "portrait",
          prompt: `${personPrompt}. Portrait photoréaliste, regard caméra, cadrage buste, lumière studio, haute qualité, détails nets.`,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d.error, t("Échec.", "Failed.")));
      const url = firstImage(d);
      if (url) setFaceUrl(url);
      else setNote(d.simulated ? t("Génération d'images non configurée (REPLICATE_API_TOKEN).", "Image generation not configured (REPLICATE_API_TOKEN).") : t("Aucune image renvoyée.", "No image returned."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setComposing(false); }
  }

  // Applique un décor : remplace le fond du portrait courant (Flux Kontext).
  async function applyEnvironment() {
    if (!faceUrl.trim()) { setError(t("Ajoutez ou générez d'abord une personne.", "Add or generate a person first.")); return; }
    if (!environment.trim()) { setError(t("Décrivez l'environnement.", "Describe the environment.")); return; }
    setComposing(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          imageUrl: faceUrl,
          format: "portrait",
          prompt: `Garde EXACTEMENT la même personne et le même visage. Remplace uniquement l'arrière-plan par : ${environment}. Rendu photoréaliste, éclairage cohérent et professionnel, haute qualité.`,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d.error, t("Échec.", "Failed.")));
      const url = firstImage(d);
      if (url) { setFaceUrl(url); setNote(t("Décor appliqué ✓", "Environment applied ✓")); }
      else setNote(d.simulated ? t("Génération d'images non configurée.", "Image generation not configured.") : t("Aucune image renvoyée.", "No image returned."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setComposing(false); }
  }

  async function genScript() {
    if (!topic.trim()) { setError(t("Indiquez un sujet.", "Enter a topic.")); return; }
    setWriting(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/ai/avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, mode: "script", topic, language, seconds }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d.error, t("Échec.", "Failed.")));
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
        body: JSON.stringify({ companyId: company.id, mode: "video", script, faceUrl, language, gender, lipsyncModel }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d.error, t("Échec.", "Failed.")));
      let finalUrl: string | null = null;
      if (d.simulated) {
        setNote(t("Génération vidéo non configurée (REPLICATE_API_TOKEN).", "Video generation not configured (REPLICATE_API_TOKEN)."));
      } else if (d.videoUrl) {
        finalUrl = d.videoUrl;
      } else if (d.pending && d.predictionId) {
        // Lip-sync long → on interroge le statut jusqu'au résultat (≤ 8 min).
        finalUrl = await pollAvatar(d.predictionId);
        if (!finalUrl) setError(t("La génération a échoué ou dépassé le temps imparti.", "Generation failed or timed out."));
      } else {
        setError(t("Aucune vidéo renvoyée.", "No video returned."));
      }

      // Sous-titres (optionnels) : incrustation sur la vidéo obtenue.
      if (finalUrl && subtitles) {
        setVideoUrl(finalUrl); // affiche déjà la vidéo sans sous-titres
        setNote(t("Ajout des sous-titres… (1-3 min)", "Adding subtitles… (1-3 min)"));
        try {
          const sr = await fetch("/api/ai/avatar", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId: company.id, mode: "subtitle", videoUrl: finalUrl }),
          });
          const sd = await sr.json();
          if (sr.ok) {
            const subUrl = sd.videoUrl || (sd.pending && sd.predictionId ? await pollAvatar(sd.predictionId) : null);
            if (subUrl) { finalUrl = subUrl; setNote(t("Sous-titres ajoutés ✓", "Subtitles added ✓")); }
            else setNote(t("Vidéo prête (sous-titres indisponibles).", "Video ready (subtitles unavailable)."));
          }
        } catch { setNote(t("Vidéo prête (sous-titres indisponibles).", "Video ready (subtitles unavailable).")); }
      }
      if (finalUrl) setVideoUrl(finalUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setRendering(false); }
  }

  // Interroge GET /api/ai/avatar?id=… jusqu'à succès/échec (poll 5s, max ~8 min).
  async function pollAvatar(id: string): Promise<string | null> {
    const deadline = Date.now() + 8 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/ai/avatar?id=${encodeURIComponent(id)}`);
        const d = await res.json();
        if (d.status === "succeeded" && d.videoUrl) return d.videoUrl;
        if (d.status === "failed") return null;
      } catch { /* on retente */ }
    }
    return null;
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
              <p className="section-label">{t("1 · Scène — personne + décor", "1 · Scene — person + background")}</p>

              {/* Source de la personne : téléverser ou générer */}
              <div className="flex gap-1 rounded-lg border border-hair p-1">
                {([
                  { id: "upload", label: t("Téléverser / URL", "Upload / URL") },
                  { id: "generate", label: t("Générer la personne", "Generate person") },
                ] as const).map((m) => (
                  <button key={m.id} onClick={() => setPersonMode(m.id)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${personMode === m.id ? "bg-page text-white" : "text-muted hover:text-ink"}`}>
                    {m.label}
                  </button>
                ))}
              </div>

              {personMode === "upload" ? (
                <div className="flex gap-2">
                  <input value={faceUrl} onChange={(e) => setFaceUrl(e.target.value)} placeholder={t("URL d'un portrait (https://…)", "Portrait URL (https://…)")} className="input flex-1" />
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFace(e.target.files)} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary shrink-0 text-xs disabled:opacity-50">
                    {uploading ? t("Envoi…", "Uploading…") : t("⬆︎ Photo", "⬆︎ Photo")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input value={personPrompt} onChange={(e) => setPersonPrompt(e.target.value)} placeholder={t("Décrivez la personne (ex. « femme médecin, 40 ans, blouse blanche, souriante »)", "Describe the person (e.g. \"female doctor, 40s, white coat, smiling\")")} className="input" />
                  <div className="flex gap-2">
                    <select value={imageModel} onChange={(e) => setImageModel(e.target.value)} className="input flex-1">
                      {IMAGE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <button onClick={genPerson} disabled={composing} className="btn-secondary shrink-0 inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                      {composing && <Spinner size={14} className="text-current" />}
                      {t("✨ Générer", "✨ Generate")}
                    </button>
                  </div>
                </div>
              )}

              {/* Décor / environnement appliqué au portrait courant */}
              <div className="border-t border-hair pt-3">
                <label className="text-2xs text-muted">{t("Décor / environnement (optionnel)", "Background / environment (optional)")}</label>
                <div className="mt-1 flex gap-2">
                  <input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder={t("Ex. « bureau moderne », « clinique épurée », « studio dégradé violet »", "E.g. \"modern office\", \"clean clinic\", \"purple gradient studio\"")} className="input flex-1" />
                  <button onClick={applyEnvironment} disabled={composing} className="btn-secondary shrink-0 inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                    {composing && <Spinner size={14} className="text-current" />}
                    {t("Appliquer le décor", "Apply background")}
                  </button>
                </div>
                <p className="mt-1 text-2xs text-muted">{t("Remplace l'arrière-plan de la personne en gardant son visage (Flux Kontext).", "Replaces the person's background while keeping their face (Flux Kontext).")}</p>
              </div>

              {faceUrl.trim() && (
                <div className="pt-1">
                  <p className="mb-1 text-2xs text-muted">{t("Aperçu de la scène", "Scene preview")}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faceUrl} alt="" className="max-h-48 rounded-xl object-contain ring-1 ring-hair" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
              )}
            </section>

            <section className="card p-5 space-y-3">
              <p className="section-label">{t("2 · Script", "2 · Script")}</p>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("Sujet (ex. « Notre nouvelle offre minceur »)", "Topic (e.g. \"Our new weight-loss offer\")")} className="input" />
              <div className="flex flex-wrap items-center gap-2">
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input w-auto">
                  {AVATAR_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
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

            <section className="card p-5 space-y-3">
              <p className="section-label">{t("3 · Voix & rendu", "3 · Voice & render")}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-2xs text-muted">{t("Voix", "Voice")}</label>
                  <div className="mt-1 flex gap-1">
                    {([
                      { id: "female", fr: "Femme", en: "Woman" },
                      { id: "male", fr: "Homme", en: "Man" },
                    ] as const).map((g) => (
                      <button key={g.id} type="button" onClick={() => setGender(g.id)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${gender === g.id ? "border-page bg-page/15 text-ink" : "border-hair text-muted hover:text-ink"}`}>
                        {t(g.fr, g.en)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-2xs text-muted">{t("Avatar (modèle)", "Avatar (model)")}</label>
                  <select value={lipsyncModel} onChange={(e) => setLipsyncModel(e.target.value)} className="input mt-1">
                    {AVATAR_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} className="h-4 w-4 accent-page" />
                {t("Ajouter des sous-titres incrustés (transcription auto)", "Add burned-in subtitles (auto transcription)")}
              </label>
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
