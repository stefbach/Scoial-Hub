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

// Formats attendus par les réseaux (Meta, TikTok, LinkedIn) — photo & vidéo.
const IMG_FMTS: { id: string; fr: string; en: string }[] = [
  { id: "1:1", fr: "Carré 1:1 (fil)", en: "Square 1:1 (feed)" },
  { id: "4:5", fr: "Portrait 4:5 (fil IG/FB)", en: "Portrait 4:5 (IG/FB feed)" },
  { id: "9:16", fr: "Story/Reel 9:16", en: "Story/Reel 9:16" },
  { id: "1.91:1", fr: "Paysage 1.91:1 (LinkedIn/FB)", en: "Landscape 1.91:1 (LinkedIn/FB)" },
];
const VID_FMTS: { id: string; fr: string; en: string }[] = [
  { id: "9:16", fr: "Vertical 9:16 (TikTok/Reels/Stories)", en: "Vertical 9:16 (TikTok/Reels/Stories)" },
  { id: "1:1", fr: "Carré 1:1 (fil)", en: "Square 1:1 (feed)" },
  { id: "4:5", fr: "Portrait 4:5", en: "Portrait 4:5" },
  { id: "16:9", fr: "Paysage 16:9 (LinkedIn/FB)", en: "Landscape 16:9 (LinkedIn/FB)" },
];

export function AiVisualsPanel({
  used,
  cap,
  platform = "facebook",
  imageModel,
  videoModel,
  brandHints,
  companyId,
  onUse,
}: {
  used: number;
  cap: number;
  /** Réseau cible : détermine le ratio image envoyé au générateur. */
  platform?: Platform;
  /** Modèle de génération d'image (catalogue Replicate). */
  imageModel?: string;
  /** Modèle de génération vidéo (catalogue Replicate). */
  videoModel?: string;
  /** Indications de style issues du brand kit (injectées dans le prompt). */
  brandHints?: string;
  /** Société — enregistre les visuels générés dans la bibliothèque média. */
  companyId?: string;
  /** Attache un visuel généré à la publication (aperçu + publication). */
  onUse?: (media: { url: string; kind: "image" | "video" }) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<"image" | "video">("image");
  const [style, setStyle] = useState("photo");
  // Format/ratio choisi (par défaut selon le mode). Couvre tous les réseaux.
  const [fmt, setFmt] = useState("1:1");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [mockMessage, setMockMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  // Nombre d'images à générer (1, 2 ou 4) — l'utilisateur n'est plus forcé à 4.
  const [count, setCount] = useState<1 | 2 | 4>(1);
  // Visuel actuellement attaché à la publication (pour le marquer comme choisi).
  const [usedUrl, setUsedUrl] = useState<string | null>(null);
  const isVideo = mode === "video";

  const handleUse = (url: string, kind: "image" | "video") => {
    setUsedUrl(url);
    onUse?.({ url, kind });
  };

  const handleGenerate = async () => {
    const base = prompt.trim();
    if (!base) return;
    // Enrichit le prompt avec le style de marque (brand kit) pour rester cohérent.
    const text = [base, brandHints?.trim()].filter(Boolean).join(". ");
    setLoading(true);
    setError(null);
    setMockMessage(null);
    setResults([]);
    try {
      if (isVideo) {
        // Génération vidéo asynchrone (Veo 3 / Kling / Seedance… selon le modèle).
        const r = await generateVideoPolling({ prompt: text, platform, aspect: fmt, model: videoModel, seconds: 10 });
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
        if (companyId) fetch("/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, url: r.url, type: "video", format: fmt, source: "compose" }) }).catch(() => {});
        return;
      }
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          // Format explicite choisi (ratio attendu par le réseau) ; companyId →
          // enregistrement automatique dans la bibliothèque média.
          format: fmt,
          platform,
          style,
          n: count,
          model: imageModel,
          companyId,
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
          onClick={() => { setMode("image"); setFmt("1:1"); }}
          className={mode === "image" ? "font-medium text-ai-visual underline" : "text-muted"}
        >
          {t("Image", "Image")}
        </button>
        <button
          onClick={() => { setMode("video"); setFmt("9:16"); }}
          className={mode === "video" ? "font-medium text-ai-visual underline" : "text-muted"}
        >
          {t("Vidéo", "Video")}
        </button>
      </div>

      {/* Format / ratio — couvre Meta (fil/story/reel), TikTok, LinkedIn */}
      <div className="mb-2 flex flex-wrap gap-1">
        {(isVideo ? VID_FMTS : IMG_FMTS).map((f) => (
          <button
            key={f.id}
            onClick={() => setFmt(f.id)}
            title={t(f.fr, f.en)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${fmt === f.id ? "bg-ai-visual text-white" : "bg-card text-muted ring-1 ring-hair hover:text-ink"}`}
          >
            {f.id}
          </button>
        ))}
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

      {/* Nombre d'images (image uniquement) — 1 par défaut, jusqu'à 4 */}
      {!isVideo && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-2xs text-muted">{t("Nombre", "Count")}</span>
          {([1, 2, 4] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCount(c)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${count === c ? "bg-ai-visual text-white" : "bg-card text-muted ring-1 ring-hair hover:text-ink"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Generate button + variations */}
      <div className="mt-2 flex gap-1.5">
        <button
          disabled={loading || !prompt.trim()}
          onClick={handleGenerate}
          className="flex items-center gap-1 rounded-md bg-ai-visual px-2.5 py-1 text-2xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Spinner />}
          {isVideo
            ? t("Générer la vidéo", "Generate video")
            : count === 1
            ? t("Générer 1 image", "Generate 1 image")
            : t(`Générer ${count} options`, `Generate ${count} options`)}
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
            <div className="mt-1 flex items-center gap-3">
              {onUse && (
                <button
                  onClick={() => handleUse(results[0], "video")}
                  className={`rounded-md px-2 py-0.5 text-2xs font-medium ${usedUrl === results[0] ? "bg-success-500 text-white" : "bg-ai-visual text-white hover:opacity-90"}`}
                >
                  {usedUrl === results[0] ? `✓ ${t("Ajoutée", "Added")}` : t("Utiliser cette vidéo", "Use this video")}
                </button>
              )}
              <a href={results[0]} download className="text-2xs text-ai-visual hover:underline">
                ⬇ {t("Télécharger", "Download")}
              </a>
            </div>
          </div>
        ) : (
        <div className={`mt-2 grid gap-2 ${results.length === 1 ? "grid-cols-1" : results.length === 2 ? "grid-cols-2" : "grid-cols-4"}`}>
          {results.map((url, i) => (
            <div
              key={i}
              className={`group relative overflow-hidden rounded-md border ${usedUrl === url ? "border-success-500 ring-1 ring-success-500" : "border-ai-visual/40"} aspect-square`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={t(`Visuel généré ${i + 1}`, `Generated visual ${i + 1}`)}
                className="h-full w-full object-cover"
              />
              {/* Actions : choisir ce visuel (→ aperçu + publication) ou télécharger */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {onUse ? (
                  <button
                    onClick={() => handleUse(url, "image")}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${usedUrl === url ? "bg-success-500 text-white" : "bg-white/90 text-ink hover:bg-white"}`}
                  >
                    {usedUrl === url ? `✓ ${t("Ajoutée", "Added")}` : t("Utiliser", "Use")}
                  </button>
                ) : <span />}
                <a href={url} target="_blank" rel="noopener noreferrer" download className="rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-white" title={t("Ouvrir / télécharger", "Open / download")}>
                  ⬇
                </a>
              </div>
              {usedUrl === url && (
                <span className="absolute left-1 top-1 rounded bg-success-500 px-1.5 py-0.5 text-[10px] font-medium text-white">✓</span>
              )}
            </div>
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
