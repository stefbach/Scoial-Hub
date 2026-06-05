"use client";

import { useState } from "react";
import { Pills } from "./Tabs";
import { Toggle } from "./Toggle";
import { useT } from "@/lib/i18n";
import { useCompany } from "@/lib/company-context";
import { generateVideoPolling } from "@/lib/ai/generate-video-client";

// ─── Types ─────────────────────────────────────────────────────────────────

type Action = "generate" | "rewrite" | "shorten" | "hashtags";
type Platform = "facebook" | "instagram" | "linkedin";

// ─── Shared helpers ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="h-3 w-3 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── AiTextPanel ────────────────────────────────────────────────────────────
// Blue = AI text

export function AiTextPanel({
  brandVoiceLabel,
  platform = "facebook",
  language,
}: {
  brandVoiceLabel: string;
  /** Réseau cible : respecte le réseau choisi au lieu de forcer Facebook. */
  platform?: Platform;
  /** Langue de diffusion dans laquelle l'IA doit rédiger (ex : "Français"). */
  language?: string;
}) {
  const t = useT();
  const { company } = useCompany();
  const [useBrandVoice, setUseBrandVoice] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMock, setIsMock] = useState(false);

  const ACTION_LABEL: Record<Action, string> = {
    generate: t("Generate", "Generate"),
    rewrite: t("Rewrite tone", "Rewrite tone"),
    shorten: t("Make shorter", "Make shorter"),
    hashtags: t("Add hashtags", "Add hashtags"),
  };

  const handleAction = async (action: Action) => {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setIsMock(false);
    try {
      const res = await fetch("/api/ai/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          platform,
          brandVoice: useBrandVoice ? brandVoiceLabel : "neutral, professional",
          action,
          companyId: company?.id,
          language,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { text: string; mock?: boolean };
      setResult(data.text);
      setIsMock(Boolean(data.mock));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="rounded-lg border-hair border-ai-text/20 bg-ai-textbg p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ai-text">{t("AI assist · Text", "AI assist · Text")}</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-ai-text">
          {t(`Use ${brandVoiceLabel} brand voice`, `Use ${brandVoiceLabel} brand voice`)}
          <Toggle defaultOn onChange={setUseBrandVoice} />
        </label>
      </div>

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t(
          "Décrivez ce que vous souhaitez publier — angle, ton, appel à l'action…",
          "Describe what to post — angle, tone, call-to-action…"
        )}
        className="h-16 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-xs text-ink placeholder:text-muted focus:outline-none"
      />

      {/* Action buttons */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(Object.keys(ACTION_LABEL) as Action[]).map((action) => (
          <button
            key={action}
            disabled={loading || !prompt.trim()}
            onClick={() => handleAction(action)}
            className="flex items-center gap-1 rounded-md border-hair border-ai-text/30 bg-card px-2.5 py-1 text-2xs font-medium text-ai-text hover:bg-ai-textbg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && action === "generate" ? <Spinner /> : null}
            {ACTION_LABEL[action]}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-2xs text-red-600">{error}</p>
      )}

      {/* Result area */}
      {result && (
        <div className="mt-3">
          {isMock && (
            <p className="mb-1.5 rounded-md bg-warning-50 px-2 py-1 text-2xs text-warning-700 ring-1 ring-warning-200">
              {t(
                "Démo — IA texte non configurée (ANTHROPIC_API_KEY). Texte d'exemple.",
                "Demo — text AI not configured (ANTHROPIC_API_KEY). Sample text."
              )}
            </p>
          )}
          <div className="mb-1 flex items-center justify-between">
            <span className="text-2xs font-medium text-ai-text">{t("Texte généré", "Generated text")}</span>
            <div className="flex gap-1.5">
              <button
                onClick={handleCopy}
                className="rounded-md border-hair border-ai-text/30 bg-card px-2 py-0.5 text-2xs font-medium text-ai-text hover:bg-ai-textbg"
              >
                {copied ? t("Copié !", "Copied!") : t("Copier", "Copy")}
              </button>
              <button
                onClick={() => {
                  setPrompt(result);
                  setResult("");
                }}
                className="rounded-md bg-ai-text px-2 py-0.5 text-2xs font-medium text-white hover:opacity-90"
              >
                {t("Utiliser", "Use")}
              </button>
            </div>
          </div>
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-md border-hair border-ai-text/20 bg-card p-2 text-xs text-ink focus:outline-none"
          />
        </div>
      )}

      {/* Loading overlay hint */}
      {loading && !result && (
        <div className="mt-2 flex items-center gap-1.5 text-2xs text-ai-text">
          <Spinner />
          <span>{t("Génération…", "Generating…")}</span>
        </div>
      )}
    </div>
  );
}

// ─── AiVisualsPanel ─────────────────────────────────────────────────────────
// Purple = AI visuals

/** Extrait les URLs d'images, en gérant string[] ET {url}[]. */
function extractImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((it) => {
      if (typeof it === "string") return it;
      if (it && typeof it === "object" && typeof (it as { url?: unknown }).url === "string") {
        return (it as { url: string }).url;
      }
      return null;
    })
    .filter((u): u is string => Boolean(u));
}

export function AiVisualsPanel({
  used,
  cap,
  platform = "facebook",
  imageModel,
  videoModel,
}: {
  used: number;
  cap: number;
  /** Réseau cible : détermine le ratio image envoyé au générateur. */
  platform?: Platform;
  /** Modèle de génération d'image (catalogue Replicate). */
  imageModel?: string;
  /** Modèle de génération vidéo (catalogue Replicate). */
  videoModel?: string;
}) {
  const t = useT();
  const [mode, setMode] = useState<"image" | "video">("image");
  const [style, setStyle] = useState("photo");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [mockMessage, setMockMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const isVideo = mode === "video";

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setMockMessage(null);
    setResults([]);
    try {
      if (isVideo) {
        // Génération vidéo asynchrone (Veo 3 / Kling / Seedance… selon le modèle).
        const r = await generateVideoPolling({ prompt: text, platform, model: videoModel, seconds: 10 });
        if (r.simulated || !r.url) {
          setMockMessage(
            r.error === "timeout"
              ? t("La vidéo prend trop de temps. Réessayez.", "Video is taking too long. Try again.")
              : t(
                  "Démo — génération vidéo non configurée (REPLICATE_API_TOKEN).",
                  "Demo — video generation not configured (REPLICATE_API_TOKEN)."
                )
          );
          return;
        }
        setResults([r.url]);
        return;
      }
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          // Envoie le réseau cible : la route en déduit un vrai ratio
          // (resolveImageAspect) au lieu d'un "format" invalide ("image").
          platform,
          style,
          n: 4,
          model: imageModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      // La route renvoie { images: {url}[] | string[], simulated?, format, platform }.
      const data = await res.json() as { images?: unknown; simulated?: boolean; message?: string };
      const urls = extractImageUrls(data.images);
      if (data.simulated || urls.length === 0) {
        setMockMessage(
          data.message ??
            t(
              "Démo — génération d'image non configurée (REPLICATE_API_TOKEN).",
              "Demo — image generation not configured (REPLICATE_API_TOKEN)."
            )
        );
        return;
      }
      setResults(urls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border-hair border-ai-visual/20 bg-ai-visualbg p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ai-visual">{t("AI assist · Visuels", "AI assist · Visuals")}</span>
        <span className="text-2xs text-ai-visual">
          {t(`EUR ${used.toFixed(2)} / ${cap} utilisés ce mois`, `EUR ${used.toFixed(2)} / ${cap} used this month`)}
        </span>
      </div>

      {/* Mode toggle */}
      <div className="mb-2 flex gap-3 text-2xs">
        <button
          onClick={() => setMode("image")}
          className={mode === "image" ? "font-medium text-ai-visual underline" : "text-muted"}
        >
          {t("Image", "Image")}
        </button>
        <button
          onClick={() => setMode("video")}
          className={mode === "video" ? "font-medium text-ai-visual underline" : "text-muted"}
        >
          {t("Vidéo", "Video")}
        </button>
      </div>

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          isVideo
            ? "A slow pan over a glass of water with lemon and mint, soft morning light, calming wellness mood"
            : "A glass of water with lemon and cucumber, soft morning light, professional wellness photography"
        }
        className="h-12 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-xs text-ink placeholder:text-muted focus:outline-none"
      />

      {/* Style pills + cost */}
      <div className="mt-2 flex items-center justify-between">
        <Pills
          key={mode}
          options={
            isVideo
              ? [
                  { id: "photo", label: t("Réaliste", "Realistic") },
                  { id: "cinematic", label: t("Cinématique", "Cinematic") },
                  { id: "animated", label: t("Animé", "Animated") },
                ]
              : [
                  { id: "photo", label: t("Photo", "Photo") },
                  { id: "illustration", label: t("Illustration", "Illustration") },
                  { id: "poster", label: t("Poster avec texte", "Poster with text") },
                ]
          }
          tone="ai"
          onChange={setStyle}
        />
        <span className="text-2xs text-muted">
          {isVideo ? "~EUR 0.50 / 5s clip" : "~EUR 0.06/img"}
        </span>
      </div>

      {/* Generate button + variations */}
      <div className="mt-2 flex gap-1.5">
        <button
          disabled={loading || !prompt.trim()}
          onClick={handleGenerate}
          className="flex items-center gap-1 rounded-md bg-ai-visual px-2.5 py-1 text-2xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Spinner />}
          {isVideo ? t("Générer la vidéo", "Generate video") : t("Générer 4 options", "Generate 4 options")}
        </button>
        <button
          disabled
          title={t("Sélectionnez une image pour générer des variations", "Select an image first to generate variations")}
          className="cursor-not-allowed rounded-md border-hair border-ai-visual/20 bg-card px-2.5 py-1 text-2xs font-medium text-ai-visual/40"
        >
          {t("Variations", "Variations")}
        </button>
      </div>

      {/* Mock / not configured message */}
      {mockMessage && (
        <p className="mt-2 rounded-md bg-ai-visualbg px-2 py-1 text-2xs text-ai-visual ring-1 ring-ai-visual/20">
          {mockMessage}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-2xs text-red-600">{error}</p>
      )}

      {/* Résultats générés OU placeholders */}
      {results.length > 0 ? (
        isVideo ? (
          <div className="mt-2">
            <video src={results[0]} controls className="w-full rounded-md border-hair border-ai-visual/40" />
            <a href={results[0]} download className="mt-1 inline-block text-2xs text-ai-visual hover:underline">
              ⬇ {t("Télécharger la vidéo", "Download video")}
            </a>
          </div>
        ) : (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {results.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="group relative block overflow-hidden rounded-md border-hair border-ai-visual/40 aspect-square"
              title={t("Ouvrir / télécharger", "Open / download")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={t(`Visuel généré ${i + 1}`, `Generated visual ${i + 1}`)}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-1 right-1 rounded bg-ink/70 px-1.5 py-0.5 text-2xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                ⬇
              </span>
            </a>
          ))}
        </div>
        )
      ) : (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`rounded-md border-hair ${isVideo ? "aspect-video" : "aspect-square"} ${
                i === 0 ? "border-ai-visual bg-ai-visualbg" : "border-hair bg-card"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
