"use client";

// ── Studio Avatar ────────────────────────────────────────────────────────────
// Visage + sujet → script (Claude) → voix (TTS) → lip-sync (Replicate) → vidéo
// d'avatar parlant. Téléchargeable et publiable.

import { useEffect, useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { StudioHero, StudioStep, Segmented } from "@/components/studio/StudioUI";
import { StudioCopilot, type CopilotSuggestion } from "@/components/studio/StudioCopilot";
import { ImageEditor } from "@/components/studio/ImageEditor";
import { StudioDistribution } from "@/components/studio/StudioDistribution";
import { MediaLibraryButton } from "@/components/studio/MediaLibrary";
import { Tilt3D } from "@/components/visual/Tilt3D";
import { IconMask, IconClapper } from "@/components/visual/Icons";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_MODELS, DEFAULT_AVATAR_MODEL, AVATAR_LANGS, VOICES, DEFAULT_VOICE_ID } from "@/lib/ai/avatar-models";
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
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [previewing, setPreviewing] = useState(false);
  const [clonedVoices, setClonedVoices] = useState<{ id: string; label: string; speakerUrl: string }[]>([]);
  const [cloning, setCloning] = useState(false);
  const [consent, setConsent] = useState(false);
  const cloneRef = useRef<HTMLInputElement>(null);
  // Enregistrement micro in-browser (alternative au téléversement de fichier).
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false); // #16 — évite d'écraser le stockage au montage

  // #18 — Enregistre l'avatar courant dans la bibliothèque (réutilisable ensuite
  // via « Mes avatars enregistrés »).
  async function saveAvatar() {
    if (!faceUrl.trim() || savingAvatar) return;
    setSavingAvatar(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, url: faceUrl, type: "image", source: "avatar-face" }),
      });
      setNote(r.ok ? t("Avatar enregistré ✓ — retrouvez-le via « Mes avatars enregistrés ».", "Avatar saved ✓ — find it via “My saved avatars”.") : t("Échec de l'enregistrement.", "Save failed."));
    } catch {
      setError(t("Erreur réseau.", "Network error."));
    } finally { setSavingAvatar(false); }
  }

  // Nettoyage au démontage : stoppe le minuteur d'enregistrement et le micro
  // s'ils tournent encore (évite une fuite + des setState post-démontage).
  useEffect(() => () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    try { if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop(); } catch { /* ignore */ }
  }, []);

  // #16 — Persistance par société : la création d'avatar survit au rechargement.
  useEffect(() => {
    hydrated.current = false;
    try {
      const raw = localStorage.getItem(`avatar_studio_${company.id}`);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (typeof s.faceUrl === "string") setFaceUrl(s.faceUrl);
        if (typeof s.topic === "string") setTopic(s.topic);
        if (typeof s.language === "string") setLanguage(s.language);
        if (typeof s.voiceId === "string") setVoiceId(s.voiceId);
        if (typeof s.seconds === "number") setSeconds(s.seconds);
        if (typeof s.script === "string") setScript(s.script);
        if (typeof s.environment === "string") setEnvironment(s.environment);
        if (typeof s.lipsyncModel === "string") setLipsyncModel(s.lipsyncModel);
        if (typeof s.personPrompt === "string") setPersonPrompt(s.personPrompt);
        if (typeof s.imageModel === "string") setImageModel(s.imageModel);
        if (typeof s.videoUrl === "string") { setVideoUrl(s.videoUrl); setSavedToLibrary(Boolean(s.savedToLibrary)); }
        if (Array.isArray(s.clonedVoices)) setClonedVoices(s.clonedVoices); // #19 — voix clonées conservées
      }
    } catch { /* stockage indisponible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  // Sauvegarde (ignore le 1er passage pour ne pas écraser avec l'état initial).
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    try {
      localStorage.setItem(`avatar_studio_${company.id}`, JSON.stringify({
        faceUrl, topic, language, voiceId, seconds, script, environment, lipsyncModel, personPrompt, imageModel, videoUrl, savedToLibrary, clonedVoices,
      }));
    } catch { /* quota / mode privé */ }
  }, [company.id, faceUrl, topic, language, voiceId, seconds, script, environment, lipsyncModel, personPrompt, imageModel, videoUrl, savedToLibrary, clonedVoices]);

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
  // `o` permet au copilote de générer immédiatement avec SES valeurs.
  async function genPerson(o?: { prompt?: string; model?: string }) {
    const effPrompt = o?.prompt ?? personPrompt;
    if (!effPrompt.trim()) { setError(t("Décrivez la personne à générer.", "Describe the person to generate.")); return; }
    setComposing(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          model: o?.model ?? imageModel,
          format: "portrait",
          prompt: `${effPrompt}. Portrait photoréaliste, regard caméra, cadrage buste, lumière studio, haute qualité, détails nets.`,
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

  // Écoute un extrait de la voix sélectionnée (avec le texte du message si présent).
  async function previewVoice() {
    setPreviewing(true); setError(null);
    try {
      const speakerUrl = clonedVoices.find((v) => v.id === voiceId)?.speakerUrl;
      const r = await fetch("/api/ai/avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, mode: "voice-preview", voiceId, language, text: script, speakerUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d.error, t("Aperçu indisponible.", "Preview unavailable.")));
      if (d.simulated) { setNote(t("Voix non configurée (REPLICATE_API_TOKEN).", "Voice not configured.")); return; }
      if (d.audioUrl) { const a = new Audio(d.audioUrl); a.play().catch(() => {}); }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Aperçu indisponible.", "Preview unavailable."));
    } finally { setPreviewing(false); }
  }

  // Clone une voix à partir d'un échantillon audio téléversé.
  async function cloneVoiceFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    await cloneVoiceBlob(files[0], files[0].name);
  }

  // Cœur du clonage : upload de l'échantillon (fichier OU enregistrement micro)
  // puis appel du clonage. Réutilisé par le téléversement et l'enregistrement.
  async function cloneVoiceBlob(blob: Blob, name: string) {
    if (!consent) { setError(t("Cochez la case de consentement pour cloner une voix.", "Tick the consent box to clone a voice.")); return; }
    if (!blob || blob.size === 0) { setError(t("Échantillon audio vide.", "Empty audio sample.")); return; }
    const sb = createClient();
    if (!sb) { setError(t("Stockage indisponible.", "Storage unavailable.")); return; }
    setCloning(true); setError(null); setNote(null);
    try {
      const safe = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${company.id}/voice/${Date.now()}-${safe}`;
      const { error: upErr } = await sb.storage.from("sh-videos").upload(path, blob, { upsert: true, contentType: blob.type || "audio/webm" });
      if (upErr) { setError(t("Échec de l'envoi de l'audio.", "Audio upload failed.")); return; }
      const { data } = sb.storage.from("sh-videos").getPublicUrl(path);
      const audioUrl = data?.publicUrl;
      if (!audioUrl) { setError(t("URL audio indisponible.", "Audio URL unavailable.")); return; }
      setNote(t("Clonage en cours… (~1 min)", "Cloning… (~1 min)"));
      const r = await fetch("/api/ai/avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, mode: "clone-voice", audioUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d.error, t("Échec du clonage.", "Cloning failed.")));
      if (d.simulated) { setNote(t("Clonage non configuré (REPLICATE_API_TOKEN).", "Cloning not configured.")); return; }
      if (d.voiceId) {
        const label = t("Ma voix clonée", "My cloned voice");
        setClonedVoices((prev) => [...prev, { id: d.voiceId, label, speakerUrl: audioUrl }]);
        setVoiceId(d.voiceId);
        setNote(t("Voix clonée ✓ — sélectionnée. Cliquez « Écouter » pour la tester.", "Voice cloned ✓ — selected. Click 'Listen' to test it."));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec du clonage.", "Cloning failed."));
    } finally { setCloning(false); }
  }

  // Choisit le meilleur format d'enregistrement supporté par le navigateur.
  function pickRecMime(): string {
    const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
      return cands.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    }
    return "";
  }

  function stopRecording() {
    const mr = mediaRecRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }

  // Démarre l'enregistrement micro ; à l'arrêt, l'échantillon est cloné directement.
  async function startRecording() {
    setError(null); setNote(null);
    if (!consent) { setError(t("Cochez la case de consentement pour cloner une voix.", "Tick the consent box to clone a voice.")); return; }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(t("L'enregistrement n'est pas supporté par ce navigateur.", "Recording is not supported by this browser.")); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
        setRecording(false);
        const type = mr.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        void cloneVoiceBlob(blob, `enregistrement-${Date.now()}.${ext}`);
      };
      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
      setRecordSecs(0);
      recTimerRef.current = setInterval(() => {
        setRecordSecs((s) => {
          const n = s + 1;
          if (n >= 300) stopRecording(); // plafond 5 min
          return n;
        });
      }, 1000);
    } catch {
      setError(t("Micro inaccessible. Autorisez l'accès au microphone.", "Microphone unavailable. Allow microphone access."));
    }
  }

  async function genVideo() {
    if (!faceUrl.trim()) { setError(t("Ajoutez l'URL d'une image de visage.", "Add a face image URL.")); return; }
    if (!script.trim()) { setError(t("Générez ou écrivez un script.", "Generate or write a script.")); return; }
    setRendering(true); setError(null); setNote(null); setVideoUrl(null); setSavedToLibrary(false);
    try {
      const speakerUrl = clonedVoices.find((v) => v.id === voiceId)?.speakerUrl;
      const r = await fetch("/api/ai/avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, mode: "video", script, faceUrl, language, voiceId, speakerUrl, lipsyncModel }),
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
        if (!finalUrl) setError(t("Le rendu est long : il continue côté serveur et apparaîtra dans la Médiathèque dès qu'il est prêt. Réessayez ou changez de modèle d'avatar si besoin.", "The render is taking long: it continues server-side and will appear in the Media library once ready. Retry or switch avatar model if needed."));
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
      if (finalUrl) {
        setVideoUrl(finalUrl);
        // Persiste la vidéo (URL Replicate éphémère) sur le stockage durable.
        const permanent = await persistVideo(finalUrl);
        const keep = permanent || finalUrl;
        setVideoUrl(keep);
        await saveToLibrary(keep);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setRendering(false); }
  }

  // Télécharge la vidéo Replicate (URL éphémère) et la stocke durablement.
  async function persistVideo(url: string): Promise<string | null> {
    try {
      const r = await fetch("/api/ai/avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, mode: "persist", videoUrl: url }),
      });
      const d = await r.json();
      return r.ok && d.url ? d.url : null;
    } catch { return null; }
  }

  // Enregistre la vidéo avatar dans la Médiathèque (réutilisable dans Composer).
  async function saveToLibrary(url: string) {
    if (!company.id) return;
    try {
      const r = await fetch("/api/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, url, type: "video", format: "9:16", source: "studio-avatar" }),
      });
      if (r.ok) setSavedToLibrary(true);
    } catch { /* non bloquant */ }
  }

  // Interroge GET /api/ai/avatar?id=… jusqu'à succès/échec (poll 5s, max ~8 min).
  async function pollAvatar(id: string): Promise<string | null> {
    const deadline = Date.now() + 12 * 60_000;
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
    <div className="mx-auto max-w-6xl space-y-5">
      <StudioHero
        icon={<IconMask size={24} />}
        title={t("Studio Avatar", "Avatar Studio")}
        subtitle={t(
          "Un visage + un sujet → l'IA écrit le script, génère la voix et anime un avatar qui parle. Idéal pour des vidéos courtes social media.",
          "A face + a topic → the AI writes the script, generates the voice and animates a talking avatar. Great for short social videos."
        )}
      />

      {!canEdit ? (
        <div className="card p-8 text-center text-sm text-muted">
          {t("Accès en lecture seule : la génération d'avatars est réservée aux accès en édition.", "View-only access: avatar generation requires edit access.")}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Colonne réglages */}
          <div className="stagger-in space-y-4">
            {/* Copilote : écrit le script et/ou prépare le portrait à générer */}
            <StudioCopilot
              studio="avatar"
              currentPrompt={topic}
              onApply={(s: CopilotSuggestion) => {
                if (s.script) setScript(s.script);
                if (s.prompt && s.category === "image") {
                  const validModel = s.modelId && IMAGE_MODELS.some((m) => m.id === s.modelId) ? s.modelId : undefined;
                  setPersonMode("generate");
                  setPersonPrompt(s.prompt);
                  if (validModel) setImageModel(validModel);
                  // Le copilote DÉCLENCHE la génération du portrait.
                  if (canEdit) void genPerson({ prompt: s.prompt, model: validModel });
                }
              }}
            />
            <StudioStep n={1} title={t("Scène — personne + décor", "Scene — person + background")}>

              {/* Source de la personne : téléverser ou générer */}
              <Segmented
                value={personMode}
                onChange={setPersonMode}
                options={[
                  { id: "upload", label: t("Téléverser / URL", "Upload / URL") },
                  { id: "generate", label: t("Générer la personne", "Generate person") },
                ]}
              />

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
                  <textarea value={personPrompt} onChange={(e) => setPersonPrompt(e.target.value)} rows={4} placeholder={t("Décrivez la personne (ex. « femme médecin, 40 ans, blouse blanche, souriante »)", "Describe the person (e.g. \"female doctor, 40s, white coat, smiling\")")} className="input resize-y min-h-[6rem]" />
                  <div className="flex gap-2">
                    <select value={imageModel} onChange={(e) => setImageModel(e.target.value)} className="input flex-1">
                      {IMAGE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <button onClick={() => genPerson()} disabled={composing} className="btn-secondary shrink-0 inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
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

              {/* #18 — enregistrer / réutiliser un avatar */}
              <div className="flex flex-wrap items-center gap-2 border-t border-hair pt-2">
                <MediaLibraryButton
                  companyId={company.id}
                  accept="image"
                  label={t("📚 Mes avatars enregistrés", "📚 My saved avatars")}
                  className="btn-secondary text-xs"
                  onPick={(a) => setFaceUrl(a.url)}
                />
                {faceUrl.trim() && (
                  <button onClick={saveAvatar} disabled={savingAvatar} className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                    {savingAvatar && <Spinner size={12} className="text-current" />}
                    {savingAvatar ? t("Enregistrement…", "Saving…") : t("💾 Enregistrer cet avatar", "💾 Save this avatar")}
                  </button>
                )}
              </div>
            </StudioStep>

            {/* Retouche IA du portrait (tenue, décor, lumière… versions conservées) */}
            {faceUrl.trim() && canEdit && (
              <ImageEditor imageUrl={faceUrl} aspect="4:5" onResult={(u) => setFaceUrl(u)} />
            )}

            <StudioStep n={2} title={t("Script", "Script")} hint={t("1) Le texte que l'avatar va dire — généré par l'IA ou écrit à la main.", "1) The text the avatar will say — AI-generated or written by hand.")}>
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
            </StudioStep>

            <StudioStep n={3} title={t("Voix & rendu", "Voice & render")} hint={t("2) La voix choisie lit le script · 3) cochez les sous-titres pour les incruster automatiquement.", "2) The chosen voice reads the script · 3) tick subtitles to burn them in automatically.")}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-2xs text-muted">{t("Voix", "Voice")}</label>
                  <div className="mt-1 flex gap-1.5">
                    <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="input flex-1">
                      {VOICES.map((v) => <option key={v.id} value={v.id}>{t(v.fr, v.en)}</option>)}
                      {clonedVoices.length > 0 && (
                        <optgroup label={t("Voix clonées", "Cloned voices")}>
                          {clonedVoices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <button type="button" onClick={previewVoice} disabled={previewing}
                      title={t("Écouter cette voix avec votre message", "Listen to this voice with your message")}
                      className="btn-secondary shrink-0 inline-flex items-center gap-1 text-xs disabled:opacity-50">
                      {previewing ? <Spinner size={13} className="text-current" /> : "▶"} {t("Écouter", "Listen")}
                    </button>
                  </div>
                  {/* Clonage de voix */}
                  <details className="mt-2 rounded-lg border border-hair bg-white/[0.02] px-3 py-2">
                    <summary className="cursor-pointer text-2xs font-medium text-muted">{t("🎙️ Cloner une voix", "🎙️ Clone a voice")}</summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-2xs text-muted">{t("Enregistrez-vous au micro (10s–5min) ou téléversez un échantillon clair. La voix clonée s'ajoutera à la liste.", "Record yourself with the mic (10s–5min) or upload a clear sample. The cloned voice is added to the list.")}</p>
                      <label className="flex items-start gap-2 text-2xs text-muted">
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-page" />
                        {t("Je certifie avoir le droit d'utiliser et de cloner cette voix.", "I certify I have the right to use and clone this voice.")}
                      </label>
                      <input ref={cloneRef} type="file" accept="audio/*" className="hidden" onChange={(e) => cloneVoiceFile(e.target.files)} />
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Enregistrement micro in-browser */}
                        {!recording ? (
                          <button type="button" onClick={startRecording} disabled={cloning || !consent}
                            className="btn-secondary inline-flex items-center gap-1.5 text-2xs disabled:opacity-50">
                            🎙️ {t("Enregistrer", "Record")}
                          </button>
                        ) : (
                          <button type="button" onClick={stopRecording}
                            className="inline-flex items-center gap-1.5 rounded-md bg-danger-500 px-2.5 py-1 text-2xs font-medium text-white">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                            {t("Arrêter", "Stop")} · {String(Math.floor(recordSecs / 60)).padStart(2, "0")}:{String(recordSecs % 60).padStart(2, "0")}
                          </button>
                        )}
                        {/* Téléversement de fichier */}
                        <button type="button" onClick={() => cloneRef.current?.click()} disabled={cloning || !consent || recording}
                          className="btn-secondary inline-flex items-center gap-1.5 text-2xs disabled:opacity-50">
                          {cloning && <Spinner size={12} className="text-current" />}
                          {cloning ? t("Clonage…", "Cloning…") : t("⬆︎ Téléverser un échantillon", "⬆︎ Upload a sample")}
                        </button>
                      </div>
                    </div>
                  </details>
                  {!AVATAR_LANGS.find((l) => l.code === language)?.native && !clonedVoices.some((v) => v.id === voiceId) && (
                    <p className="mt-1.5 text-2xs text-warning-700">
                      {t("Pour cette langue, clonez d'abord une voix (échantillon) : elle servira de référence à la prononciation.", "For this language, first clone a voice (sample): it's used as the pronunciation reference.")}
                    </p>
                  )}
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
            </StudioStep>

            <button onClick={genVideo} disabled={rendering} className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-50">
              {rendering ? <span className="inline-flex items-center gap-2"><Spinner size={16} className="text-white" />{t("Génération de l'avatar…", "Generating avatar…")}</span> : t("🎬 Générer la vidéo avatar", "🎬 Generate avatar video")}
            </button>
            {rendering && <BusyHint label={t("Voix + lip-sync en cours… cela peut prendre 1–3 min.", "Voice + lip-sync in progress… this can take 1–3 min.")} eta="~1–3 min" />}
            {note && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{note}</p>}
            {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
          </div>

          {/* Colonne résultat — collante pour garder l'aperçu en vue */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <p className="section-label">{t("Résultat", "Result")}</p>
            <Tilt3D max={5} className="rounded-xl">
              <div className="studio-preview mx-auto flex aspect-[9/16] max-h-[72vh] w-full items-center justify-center overflow-hidden rounded-xl bg-black/40">
                {videoUrl ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={videoUrl} controls autoPlay className="h-full w-full object-contain bg-black" />
                ) : (
                  <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <span className="animate-float flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-muted ring-1 ring-hair"><IconClapper size={26} /></span>
                    <p className="text-sm text-muted">{t("La vidéo de votre avatar s'affichera ici.", "Your avatar video will appear here.")}</p>
                  </div>
                )}
              </div>
            </Tilt3D>
            {videoUrl && (
              <div className="space-y-2">
                {savedToLibrary && (
                  <p className="rounded-lg bg-success-50 px-3 py-1.5 text-2xs font-medium text-success-700">
                    {t("✓ Enregistrée dans la Médiathèque", "✓ Saved to the Media library")}
                  </p>
                )}
                <a href={videoUrl} target="_blank" rel="noopener noreferrer" download className="btn-secondary inline-flex w-full justify-center text-sm">
                  {t("⬇︎ Télécharger la vidéo", "⬇︎ Download video")}
                </a>
                <div className="flex gap-2">
                  <a href="/media" className="btn-ghost flex-1 justify-center text-xs">{t("📚 Médiathèque", "📚 Media library")}</a>
                  <a href={`/compose?media=${encodeURIComponent(videoUrl)}&kind=video`} className="btn-secondary flex-1 justify-center text-xs">{t("Ouvrir dans Composer", "Open in Composer")}</a>
                </div>
                {!savedToLibrary && (
                  <button onClick={() => videoUrl && saveToLibrary(videoUrl)} className="btn-ghost w-full justify-center text-2xs text-muted">
                    {t("Réessayer l'enregistrement en médiathèque", "Retry saving to library")}
                  </button>
                )}
              </div>
            )}

            {/* Diffusion (organique / pub) — toujours disponible : la vidéo
                générée est sélectionnée d'office, sinon on pioche dans la
                bibliothèque (plus besoin d'attendre un rendu réussi). */}
            <StudioDistribution
              companyId={company.id}
              producedUrl={videoUrl}
              producedKind="video"
              defaultText={script.split("\n")[0]?.slice(0, 180) ?? ""}
            />
          </div>
        </div>
      )}
    </div>
  );
}
