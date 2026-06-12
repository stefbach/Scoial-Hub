"use client";

// ── AudioStudio — génération de musique & voix off (Replicate) ────────────────
// Musique (description → musique) et voix (texte → parole) via tout le
// catalogue audio. Lecteur intégré + téléchargement + callback (ajout au projet).

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { MUSIC_MODELS, VOICE_MODELS } from "@/lib/ai/model-catalog";

export function AudioStudio({ onGenerated }: { onGenerated?: (url: string, kind: "music" | "voice") => void }) {
  const { company } = useCompany();
  const t = useT();
  const [kind, setKind] = useState<"music" | "voice">("music");
  const [model, setModel] = useState(MUSIC_MODELS[0].id);
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(15);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const models = kind === "music" ? MUSIC_MODELS : VOICE_MODELS;

  function switchKind(k: "music" | "voice") {
    setKind(k);
    setModel((k === "music" ? MUSIC_MODELS : VOICE_MODELS)[0].id);
    setUrl(null);
  }

  async function generate() {
    if (!text.trim() || busy) return;
    setBusy(true); setNote(null); setUrl(null);
    try {
      const r = await fetch("/api/ai/generate-audio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, kind, model, prompt: text.trim(), seconds }),
      });
      const d = await r.json();
      if (d.simulated) { setNote(t("Génération audio non configurée (REPLICATE_API_TOKEN).", "Audio generation not configured (REPLICATE_API_TOKEN).")); return; }
      if (!r.ok || !d.url) { setNote((d.error as string) || t("Aucun audio renvoyé.", "No audio returned.")); return; }
      setUrl(d.url);
      onGenerated?.(d.url, kind);
    } catch {
      setNote(t("Erreur réseau.", "Network error."));
    } finally { setBusy(false); }
  }

  return (
    <div className="studio-card p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="studio-badge">♪</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">{t("Musique & voix off", "Music & voiceover")}</h2>
          <p className="text-2xs text-muted">{t("Générez une bande-son ou une voix off pour vos vidéos.", "Generate a soundtrack or voiceover for your videos.")}</p>
        </div>
      </div>

      <div className="studio-seg">
        <button type="button" data-active={kind === "music"} onClick={() => switchKind("music")} className="studio-seg-btn">{t("Musique", "Music")}</button>
        <button type="button" data-active={kind === "voice"} onClick={() => switchKind("voice")} className="studio-seg-btn">{t("Voix off", "Voiceover")}</button>
      </div>

      <select value={model} onChange={(e) => setModel(e.target.value)} className="input text-xs" title={t("Modèle audio", "Audio model")}>
        {models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>)}
      </select>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={kind === "music"
          ? t("Décrivez la musique : « lo-fi chill, piano doux, tempo lent, ambiance calme »", "Describe the music: “lo-fi chill, soft piano, slow tempo, calm mood”")
          : t("Le texte à dire par la voix off…", "The text the voiceover should say…")}
        className="input resize-none"
      />

      {kind === "music" && (
        <label className="flex items-center gap-2 text-2xs text-muted">
          {t("Durée", "Duration")}
          <input type="range" min={5} max={30} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="flex-1 accent-page" />
          <span className="w-8 text-right text-ink">{seconds}s</span>
        </label>
      )}

      <button onClick={generate} disabled={busy || !text.trim()} className="btn-primary w-full justify-center text-sm disabled:opacity-50">
        {busy ? t("Génération…", "Generating…") : kind === "music" ? t("🎵 Générer la musique", "🎵 Generate music") : t("🎙️ Générer la voix", "🎙️ Generate voice")}
      </button>

      {note && <p className="rounded-lg bg-canvas px-3 py-2 text-2xs text-muted">{note}</p>}
      {url && (
        <div className="space-y-1.5">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="w-full" />
          <a href={url} download className="text-2xs text-page hover:underline">⬇ {t("Télécharger l'audio", "Download audio")}</a>
        </div>
      )}
    </div>
  );
}
