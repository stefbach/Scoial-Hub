"use client";

// ── AudioStudio — génération de musique & voix off (Replicate) ────────────────
// Musique (description → musique) et voix (texte → parole) via tout le
// catalogue audio. Lecteur intégré + téléchargement + callback (ajout au projet).

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { MUSIC_MODELS, VOICE_MODELS, VOICE_PRESETS } from "@/lib/ai/model-catalog";

export function AudioStudio({ onGenerated }: { onGenerated?: (url: string, kind: "music" | "voice") => void }) {
  const { company } = useCompany();
  const t = useT();
  const [kind, setKind] = useState<"music" | "voice">("music");
  const [model, setModel] = useState(MUSIC_MODELS[0].id);
  const [voice, setVoice] = useState<string>("");
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(15);
  const [busy, setBusy] = useState(false);
  // Une piste CONSERVÉE par type : musique et voix off coexistent. Auparavant
  // un seul `url` était gardé et il était effacé au changement d'onglet — la
  // musique générée disparaissait dès qu'on passait à la voix off, alors que
  // les deux sont faites pour être écoutées ensemble (recette R24 #9).
  const [tracks, setTracks] = useState<{ music?: string; voice?: string }>({});
  const [note, setNote] = useState<string | null>(null);

  const models = kind === "music" ? MUSIC_MODELS : VOICE_MODELS;

  function switchKind(k: "music" | "voice") {
    setKind(k);
    const first = (k === "music" ? MUSIC_MODELS : VOICE_MODELS)[0].id;
    setModel(first);
    setVoice(VOICE_PRESETS[first]?.[0]?.id ?? "");
    setNote(null);
  }
  function switchModel(id: string) {
    setModel(id);
    setVoice(VOICE_PRESETS[id]?.[0]?.id ?? "");
  }

  async function generate() {
    if (!text.trim() || busy) return;
    setBusy(true); setNote(null);
    try {
      const r = await fetch("/api/ai/generate-audio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, kind, model, prompt: text.trim(), seconds, voice: voice || undefined }),
      });
      const d = await r.json();
      if (d.simulated) { setNote(t("Génération audio non configurée (REPLICATE_API_TOKEN).", "Audio generation not configured (REPLICATE_API_TOKEN).")); return; }
      if (!r.ok || !d.url) { setNote((d.error as string) || t("Aucun audio renvoyé.", "No audio returned.")); return; }
      setTracks((prev) => ({ ...prev, [kind]: d.url as string }));
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

      <select value={model} onChange={(e) => switchModel(e.target.value)} className="input text-xs" title={t("Modèle audio", "Audio model")}>
        {models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>)}
      </select>

      {/* TOUTES les voix du modèle choisi (catalogue Replicate complet) */}
      {kind === "voice" && (VOICE_PRESETS[model]?.length ?? 0) > 0 && (
        <select value={voice} onChange={(e) => setVoice(e.target.value)} className="input text-xs" title={t("Voix", "Voice")}>
          {VOICE_PRESETS[model]!.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      )}

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

      {/* Les deux pistes restent affichées quel que soit l'onglet actif : on
          peut lancer la musique et la voix off ensemble pour les entendre
          telles qu'elles seront mixées. */}
      {(tracks.music || tracks.voice) && (
        <div className="space-y-2.5 rounded-lg border border-hair bg-canvas/60 p-3">
          {([
            { key: "music" as const, label: t("🎵 Musique générée", "🎵 Generated music") },
            { key: "voice" as const, label: t("🎙️ Voix off générée", "🎙️ Generated voiceover") },
          ]).map(({ key, label }) =>
            tracks[key] ? (
              <div key={key} className="space-y-1.5">
                <p className="text-2xs font-semibold text-ink">{label}</p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={tracks[key]} controls className="w-full" />
                <a href={tracks[key]} download className="text-2xs text-page hover:underline">
                  ⬇ {t("Télécharger", "Download")}
                </a>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
