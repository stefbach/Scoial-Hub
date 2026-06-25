"use client";

// ── VideoDirector — « Réalisateur IA » agentique ─────────────────────────────
// À partir d'un brief, l'IA planifie un STORYBOARD multi-scènes, puis génère
// automatiquement chaque clip vidéo (Kling / Seedance / Veo…). Les clips sont
// ajoutés à la timeline du studio (onClip), prêts pour l'assemblage & le rendu.

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { VIDEO_MODELS, DEFAULT_VIDEO_MODEL_ID } from "@/lib/ai/model-catalog";
import { generateVideoPolling } from "@/lib/ai/generate-video-client";
import type { MediaAsset } from "@/lib/video/types";

interface Scene { index: number; prompt: string; seconds: number; onScreenText: string; voiceover?: string }
interface Storyboard { title: string; summary: string; aspect: string; musicMood: string; caption: string; hashtags: string[]; scenes: Scene[]; aiGenerated: boolean }
type SceneStatus = "idle" | "running" | "done" | "failed";

const NETWORKS = [
  { id: "tiktok", label: "TikTok · 9:16" },
  { id: "instagram_reels", label: "Instagram Reels · 9:16" },
  { id: "youtube", label: "YouTube · 16:9" },
  { id: "linkedin", label: "LinkedIn · 16:9" },
  { id: "square", label: "Carré · 1:1" },
];

export function VideoDirector({
  onClip,
  defaultObjective = "",
  brandHints = "",
}: {
  /** Appelé pour chaque clip généré → l'ajoute à la timeline du studio. */
  onClip: (asset: MediaAsset) => void;
  defaultObjective?: string;
  brandHints?: string;
}) {
  const { company } = useCompany();
  const t = useT();
  const { lang } = useLang();

  const [brief, setBrief] = useState(defaultObjective);
  const [network, setNetwork] = useState("tiktok");
  const [durationSec, setDurationSec] = useState(20);
  const [sceneCount, setSceneCount] = useState(4);
  const [model, setModel] = useState(DEFAULT_VIDEO_MODEL_ID);

  const [planning, setPlanning] = useState(false);
  const [board, setBoard] = useState<Storyboard | null>(null);
  const [status, setStatus] = useState<Record<number, SceneStatus>>({});
  const [progress, setProgress] = useState<string>("");
  const [filming, setFilming] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function plan() {
    if (!brief.trim() || planning) return;
    setPlanning(true); setNote(null); setBoard(null); setStatus({});
    try {
      const r = await fetch("/api/video/director", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id, brief: [brief, brandHints].filter(Boolean).join(". "),
          network, durationSec, sceneCount, language: lang, brandVoice: company.brandVoice ?? "", brandName: company.name,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setNote(d.error || t("Échec de la planification.", "Planning failed.")); return; }
      setBoard(d as Storyboard);
      if (d.aiGenerated === false) setNote(t("Storyboard de démo (IA texte non configurée).", "Demo storyboard (text AI not configured)."));
    } catch {
      setNote(t("Erreur réseau.", "Network error."));
    } finally { setPlanning(false); }
  }

  function setScene(i: number, patch: Partial<Scene>) {
    setBoard((b) => b ? { ...b, scenes: b.scenes.map((s) => (s.index === i ? { ...s, ...patch } : s)) } : b);
  }

  async function film() {
    if (!board || filming) return;
    setFilming(true); setNote(null);
    let ok = 0;
    try {
      for (const s of board.scenes) {
        setStatus((st) => ({ ...st, [s.index]: "running" }));
        setProgress(t(`Génération du clip ${s.index}/${board.scenes.length}…`, `Generating clip ${s.index}/${board.scenes.length}…`));
        const res = await generateVideoPolling(
          { prompt: s.prompt, aspect: board.aspect, seconds: s.seconds, model, companyId: company.id },
          { timeoutMs: 6 * 60_000 }
        );
        if (res.url) {
          onClip({ url: res.url, kind: "video", name: `${t("Scène", "Scene")} ${s.index}` });
          setStatus((st) => ({ ...st, [s.index]: "done" }));
          ok += 1;
        } else {
          setStatus((st) => ({ ...st, [s.index]: "failed" }));
          if (res.simulated) { setNote(t("Génération vidéo non configurée (REPLICATE_API_TOKEN).", "Video generation not configured (REPLICATE_API_TOKEN).")); break; }
        }
      }
      setProgress("");
      setNote(ok > 0
        ? t(`✓ ${ok} clip(s) ajouté(s) à la timeline ci-dessous — assemblez & montez le film.`, `✓ ${ok} clip(s) added to the timeline below — assemble & render the film.`)
        : t("Aucun clip généré. Réessayez ou changez de modèle.", "No clip generated. Retry or change the model."));
    } catch {
      setNote(t("Échec du tournage.", "Filming failed."));
    } finally { setFilming(false); setProgress(""); }
  }

  const dot = (s?: SceneStatus) =>
    s === "done" ? "bg-success-500" : s === "running" ? "bg-primary-500 animate-pulse" : s === "failed" ? "bg-danger-500" : "bg-hair";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">{t("🎬 Réalisateur IA", "🎬 AI Director")}</p>
        <p className="text-2xs text-muted">{t("Décrivez le film — l'IA écrit le storyboard puis génère chaque plan, prêt à monter.", "Describe the film — the AI writes the storyboard then generates each shot, ready to edit.")}</p>
      </div>

      <textarea
        value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
        placeholder={t("Ex : « Pub 20s pour notre nouvelle offre minceur, ton dynamique, ambiance bien-être »", "E.g. \"20s ad for our new weight-loss offer, dynamic tone, wellness vibe\"")}
        className="input resize-none"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={network} onChange={(e) => setNetwork(e.target.value)} className="input text-xs" title={t("Réseau / format", "Network / format")}>
          {NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="input text-xs" title={t("Modèle vidéo", "Video model")}>
          {VIDEO_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-2xs text-muted">{t("Durée", "Duration")}
          <input type="number" min={10} max={60} value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value) || 20)} className="input w-16 text-xs" />s
        </label>
        <label className="flex items-center gap-1.5 text-2xs text-muted">{t("Scènes", "Scenes")}
          <input type="number" min={3} max={6} value={sceneCount} onChange={(e) => setSceneCount(Number(e.target.value) || 4)} className="input w-14 text-xs" />
        </label>
      </div>

      <button onClick={plan} disabled={planning || !brief.trim()} className="btn-secondary w-full justify-center text-sm disabled:opacity-50">
        {planning ? t("Écriture du storyboard…", "Writing the storyboard…") : t("✦ Écrire le storyboard", "✦ Write the storyboard")}
      </button>

      {board && (
        <div className="space-y-2 rounded-xl border border-hair bg-canvas/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{board.title}</p>
              <p className="text-2xs text-muted">{board.summary} · 🎵 {board.musicMood} · {board.aspect}</p>
            </div>
            <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-2xs text-muted ring-1 ring-hair">{board.scenes.length} {t("scènes", "scenes")}</span>
          </div>

          <div className="space-y-1.5">
            {board.scenes.map((s) => (
              <div key={s.index} className="rounded-lg border border-hair bg-card p-2">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot(status[s.index])}`} />
                  <span className="text-2xs font-bold text-primary">{t("Scène", "Scene")} {s.index}</span>
                  <span className="text-2xs text-muted">~{s.seconds}s</span>
                </div>
                <textarea value={s.prompt} onChange={(e) => setScene(s.index, { prompt: e.target.value })} rows={2}
                  className="input resize-none text-2xs" title={t("Prompt visuel (anglais)", "Visual prompt (English)")} />
                {(s.onScreenText || s.voiceover) && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-muted">
                    {s.onScreenText && <span>📝 {s.onScreenText}</span>}
                    {s.voiceover && <span>🎙️ {s.voiceover}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button onClick={film} disabled={filming} className="btn-primary w-full justify-center text-sm disabled:opacity-50">
            {filming ? (progress || t("Tournage…", "Filming…")) : t("🎬 Générer tous les clips", "🎬 Generate all clips")}
          </button>
          {filming && <p className="text-2xs text-muted">{t("La génération vidéo peut prendre 1–3 min par plan. Les clips apparaissent dans la timeline au fur et à mesure.", "Video generation can take 1–3 min per shot. Clips appear in the timeline as they finish.")}</p>}
        </div>
      )}

      {note && <p className="rounded-lg bg-canvas px-3 py-2 text-2xs text-muted">{note}</p>}
    </div>
  );
}
