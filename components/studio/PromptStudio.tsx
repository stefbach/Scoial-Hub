"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { useCompany } from "@/lib/company-context";
import { SOCIAL_FORMATS, type SocialPlatform } from "@/lib/social-formats";
import { generateVideoPolling } from "@/lib/ai/generate-video-client";
import type { MediaAsset } from "@/lib/video/types";

// ── Studio par prompt : génère une image OU une vidéo depuis un prompt IA ─────────

type Kind = "image" | "video";

interface FormatOption {
  /** Clé unique pour le <select>. */
  value: string;
  /** Libellé lisible (avec réseau si applicable). */
  label: string;
  /** Ratio envoyé au générateur ("1:1","4:5","9:16","16:9","1.91:1"). */
  aspect: string;
  /** Réseau cible à transmettre (ou undefined pour un ratio générique). */
  platform?: SocialPlatform;
  /** Placement à transmettre (feed/story/reel/cover). */
  placement?: string;
}

/** Libellés réseau pour préfixer les options. */
const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/** Ratios génériques pour ne rien limiter. */
const GENERIC_RATIOS: { aspect: string; fr: string; en: string }[] = [
  { aspect: "1:1", fr: "Carré 1:1", en: "Square 1:1" },
  { aspect: "4:5", fr: "Portrait 4:5", en: "Portrait 4:5" },
  { aspect: "9:16", fr: "Vertical 9:16", en: "Vertical 9:16" },
  { aspect: "16:9", fr: "Paysage 16:9", en: "Landscape 16:9" },
  { aspect: "1.91:1", fr: "Paysage 1.91:1", en: "Landscape 1.91:1" },
];

/** Construit la liste exhaustive d'options pour un type de média donné. */
function buildFormatOptions(kind: Kind, t: (fr: string, en: string) => string): FormatOption[] {
  const out: FormatOption[] = [];

  // 1) Tous les formats sociaux du type choisi, étiquetés par réseau.
  (Object.keys(SOCIAL_FORMATS) as SocialPlatform[]).forEach((platform) => {
    SOCIAL_FORMATS[platform]
      .filter((f) => f.kind === kind)
      .forEach((f) => {
        out.push({
          value: `${platform}:${f.id}`,
          label: `${PLATFORM_LABEL[platform]} · ${f.label}`,
          aspect: f.aspect,
          platform,
          placement: f.placement,
        });
      });
  });

  // 2) Ratios génériques (rien n'est limité).
  GENERIC_RATIOS.forEach((r) => {
    out.push({
      value: `generic:${r.aspect}`,
      label: `${t("Ratio", "Ratio")} ${t(r.fr, r.en)}`,
      aspect: r.aspect,
    });
  });

  return out;
}

interface ResultState {
  kind: Kind;
  url: string;
  simulated?: boolean;
}

export default function PromptStudio({
  onGenerated,
}: {
  onGenerated: (asset: MediaAsset) => void;
}) {
  const t = useT();
  const { company } = useCompany();

  const [kind, setKind] = useState<Kind>("image");
  const [formatValue, setFormatValue] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [improving, setImproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [savedLib, setSavedLib] = useState<"idle" | "saving" | "done">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setSavedLib("idle");
    setSaveError(null);
  }, [result?.url]);

  async function saveToLibrary() {
    if (!result) return;
    setSavedLib("saving");
    setSaveError(null);
    // Plateforme déduite du format choisi (au lieu d'être figée sur "instagram").
    // Les ratios génériques retombent sur "instagram" comme défaut neutre.
    const platform: SocialPlatform = selected?.platform ?? "instagram";
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          platform,
          body: prompt.slice(0, 200),
          mediaUrl: result.url,
          mediaKind: result.kind,
          tags: ["studio", result.kind],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSavedLib("idle");
        setSaveError(
          t(
            `Échec de l'ajout à la bibliothèque : ${data.error ?? res.status}`,
            `Failed to add to library: ${data.error ?? res.status}`
          )
        );
        return;
      }
      setSavedLib("done");
    } catch {
      setSavedLib("idle");
      setSaveError(
        t(
          "Erreur réseau lors de l'ajout à la bibliothèque.",
          "Network error while adding to library."
        )
      );
    }
  }

  // Options recalculées quand le type change.
  const options = useMemo(() => buildFormatOptions(kind, t), [kind, t]);

  // Format courant (défaut : 1ʳᵉ option).
  const selected = useMemo<FormatOption | undefined>(
    () => options.find((o) => o.value === formatValue) ?? options[0],
    [options, formatValue]
  );

  function switchKind(next: Kind) {
    if (next === kind) return;
    setKind(next);
    setFormatValue(""); // réinitialise vers le 1ᵉʳ format du nouveau type
    setResult(null);
    setNotice(null);
  }

  async function improvePrompt() {
    const idea = prompt.trim();
    if (!idea || improving) return;
    setImproving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/ai/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: idea, kind, brandVoice: company.brandVoice }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.prompt === "string" && data.prompt.trim()) {
        setPrompt(data.prompt.trim());
        if (data.prompt.trim() === idea) {
          setNotice(
            t(
              "Prompt inchangé — IA texte non configurée (ANTHROPIC_API_KEY).",
              "Prompt unchanged — text AI not configured (ANTHROPIC_API_KEY)."
            )
          );
        }
      } else {
        setNotice(t("Impossible d'améliorer le prompt.", "Could not improve the prompt."));
      }
    } catch {
      setNotice(t("Erreur réseau lors de l'amélioration.", "Network error while improving."));
    } finally {
      setImproving(false);
    }
  }

  /** Normalise la réponse image (images peut être string[] ou {url}[]). */
  function firstImageUrl(images: unknown): string | undefined {
    if (!Array.isArray(images) || images.length === 0) return undefined;
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && typeof (first as { url?: unknown }).url === "string") {
      return (first as { url: string }).url;
    }
    return undefined;
  }

  async function generate() {
    const idea = prompt.trim();
    if (!idea || generating) return;
    if (!selected) return;
    setGenerating(true);
    setNotice(null);
    setResult(null);

    try {
      if (kind === "image") {
        const res = await fetch("/api/ai/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: idea,
            format: selected.aspect,
            platform: selected.platform,
            placement: selected.placement,
            n: 1,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNotice(t(`Erreur : ${data.error ?? res.status}`, `Error: ${data.error ?? res.status}`));
          return;
        }
        const url = firstImageUrl(data.images);
        if (data.simulated || !url) {
          setNotice(
            t(
              "Génération IA non configurée (REPLICATE_API_TOKEN).",
              "AI generation not configured (REPLICATE_API_TOKEN)."
            )
          );
          return;
        }
        setResult({ kind: "image", url });
        onGenerated({
          url,
          kind: "image",
          name: t("Image générée par IA", "AI-generated image"),
        });
      } else {
        // Génération asynchrone avec polling (MiniMax peut prendre plusieurs min).
        const r = await generateVideoPolling({
          prompt: idea,
          aspect: selected.aspect,
          platform: selected.platform,
        });
        if (r.simulated) {
          setNotice(
            t(
              "Génération IA non configurée (REPLICATE_API_TOKEN).",
              "AI generation not configured (REPLICATE_API_TOKEN)."
            )
          );
          return;
        }
        if (!r.url) {
          setNotice(
            r.error === "timeout"
              ? t(
                  "La vidéo prend trop de temps. Réessayez dans un instant.",
                  "Video is taking too long. Try again shortly."
                )
              : t(
                  `Erreur lors de la génération vidéo : ${r.error ?? ""}`,
                  `Video generation error: ${r.error ?? ""}`
                )
          );
          return;
        }
        setResult({ kind: "video", url: r.url });
        onGenerated({
          url: r.url,
          kind: "video",
          name: t("Vidéo générée par IA", "AI-generated video"),
        });
      }
    } catch {
      setNotice(
        t(
          "Erreur réseau ou délai dépassé. Réessayez (la vidéo peut être lente).",
          "Network error or timeout. Try again (video can be slow)."
        )
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai-textbg text-ai-text" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="m6.5 6.5 2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <div className="section-label">{t("Générer par prompt (IA)", "Generate from a prompt (AI)")}</div>
      </div>

      {/* Type : image / vidéo */}
      <div className="mb-3 inline-flex rounded-lg border border-hair bg-canvas p-0.5">
        {(["image", "video"] as Kind[]).map((k) => {
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => switchKind(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                on ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-muted hover:text-ink"
              }`}
            >
              {k === "image" ? t("Image", "Image") : t("Vidéo", "Video")}
            </button>
          );
        })}
      </div>

      {/* Format (exhaustif : tous réseaux + ratios génériques) */}
      <div className="mb-3">
        <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">
          {t("Format de sortie", "Output format")}
        </label>
        <select
          className="input w-full text-sm"
          value={selected?.value ?? ""}
          onChange={(e) => setFormatValue(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} ({o.aspect})
            </option>
          ))}
        </select>
      </div>

      {/* Prompt */}
      <div className="mb-2">
        <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">
          {t("Votre idée / prompt", "Your idea / prompt")}
        </label>
        <textarea
          className="input min-h-[120px] w-full text-sm"
          placeholder={
            kind === "image"
              ? t(
                  "Ex : un café latte sur une table en bois, lumière du matin…",
                  "E.g. a latte on a wooden table, morning light…"
                )
              : t(
                  "Ex : drone survolant une plage au coucher du soleil…",
                  "E.g. drone flying over a beach at sunset…"
                )
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-ghost text-xs text-ai-text"
          onClick={improvePrompt}
          disabled={improving || generating || !prompt.trim()}
        >
          {improving ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-ai-text" />
              {t("Amélioration…", "Improving…")}
            </span>
          ) : (
            <>✨ {t("Améliorer avec l'IA", "Improve with AI")}</>
          )}
        </button>

        <button
          type="button"
          className="btn-primary text-sm"
          onClick={generate}
          disabled={generating || improving || !prompt.trim()}
        >
          {generating ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
              {t(
                "Génération… (image ~10s / clip vidéo ~6s)",
                "Generating… (image ~10s / video clip ~6s)"
              )}
            </span>
          ) : (
            <>{t("Générer", "Generate")}</>
          )}
        </button>
      </div>

      {/* Notice */}
      {notice && (
        <div className="mt-3 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-2xs text-warning-700">
          {notice}
        </div>
      )}

      {/* Aperçu du média généré */}
      {result && (
        <div className="mt-4 border-t border-hair pt-4">
          <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
            {t("Résultat", "Result")} — {t("ajouté à vos médias", "added to your media")}
          </div>
          {result.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.url}
              alt={t("Image générée", "Generated image")}
              className="max-h-72 w-auto rounded-lg border border-hair"
            />
          ) : (
            <video src={result.url} controls className="max-h-72 w-auto rounded-lg border border-hair" />
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="btn-secondary text-2xs"
            >
              ⬇ {t("Télécharger", "Download")}
            </a>
            <button
              type="button"
              onClick={saveToLibrary}
              disabled={savedLib !== "idle"}
              className="btn-primary text-2xs disabled:opacity-60"
            >
              {savedLib === "saving"
                ? t("Ajout…", "Adding…")
                : savedLib === "done"
                ? t("✓ Dans la bibliothèque", "✓ In library")
                : t("＋ Ajouter à la bibliothèque", "＋ Add to library")}
            </button>
          </div>
          {saveError && (
            <p className="mt-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-2xs text-danger">
              {saveError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
