"use client";

// ── Étape 4 : Création des visuels ─────────────────────────────────────────
// L'utilisateur choisit comment ses visuels seront produits.
// Ce choix (creativeMode) sera utilisé par les agents IA à l'étape 5.
// Trois modes : autonome (IA génère), banque (médias fournis), studio produit.

import { useState } from "react";
import Link from "next/link";
import { useOnboardingCtx } from "@/components/onboarding/context";
import { useT } from "@/lib/i18n";
import type { CreativeMode } from "@/lib/onboarding/types";

// ── Icônes SVG inline ───────────────────────────────────────────────────────

/** Étincelles / baguette magique — mode autonome */
function WandIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 4l1.5 3.5L20 9l-3.5 1.5L15 14l-1.5-3.5L10 9l3.5-1.5Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"
      />
      <path
        d="M5 19l8-8"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
      <path
        d="M4 8l.7 1.5L6.2 10l-1.5.7L4 12l-.7-1.3L1.8 10l1.5-.7Z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"
      />
    </svg>
  );
}

/** Pile de photos — mode banque d'images */
function PhotoStackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="8" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="3" y="5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" strokeDasharray="3 2" fill="none" />
      <circle cx="9" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M5 19l3.5-4 2.5 2.5 2-2.5 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Cube / boîte — mode studio produit */
function BoxIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 9l9-5 9 5v8l-9 5-9-5V9Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"
      />
      <path d="M12 4v16M3 9l9 5 9-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Icône check — sélection active */
function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 9l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Spinner de chargement */
function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.25" fill="none" />
      <path d="M8 2A6 6 0 0 1 14 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Icône flèche externe */
function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7.5 1.5H11.5V5.5M11.5 1.5L5.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Configuration des trois modes créatifs ──────────────────────────────────

interface ModeConfig {
  id: CreativeMode;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  badgeFr: string;
  badgeEn: string;
  icon: React.ReactNode;
}

const MODES: ModeConfig[] = [
  {
    id: "autonomous",
    titleFr: "Génération autonome",
    titleEn: "Autonomous generation",
    descFr: "L'IA crée images et vidéos directement à partir de votre identité de marque, sans intervention manuelle.",
    descEn: "AI creates images and videos directly from your brand identity, with no manual input.",
    badgeFr: "Recommandé",
    badgeEn: "Recommended",
    icon: <WandIcon />,
  },
  {
    id: "bank",
    titleFr: "Ma banque d'images",
    titleEn: "My image bank",
    descFr: "Vous fournissez vos propres photos et vidéos — les agents les habillent, les calibrent réseau par réseau.",
    descEn: "You supply your own photos and videos — the agents dress and calibrate them network by network.",
    badgeFr: "Contrôle total",
    badgeEn: "Full control",
    icon: <PhotoStackIcon />,
  },
  {
    id: "product",
    titleFr: "Studio produit",
    titleEn: "Product studio",
    descFr: "On part de votre produit (photo ou vidéo) et on assemble montage, musique et textes automatiquement.",
    descEn: "We start from your product (photo or video) and auto-assemble montage, music and captions.",
    badgeFr: "E-commerce",
    badgeEn: "E-commerce",
    icon: <BoxIcon />,
  },
];

// ── Types locaux pour la réponse de /api/ai/generate-image ──────────────────

interface GenerateImageResult {
  url?: string;
  imageUrl?: string;
  images?: { url: string }[];
}

/** Extrait l'URL de l'image quelle que soit la forme de la réponse */
function extractImageUrl(data: GenerateImageResult): string | null {
  if (data.url) return data.url;
  if (data.imageUrl) return data.imageUrl;
  if (data.images && data.images.length > 0) return data.images[0].url;
  return null;
}

// ── Panneaux d'action contextuels ───────────────────────────────────────────

/** Panneau mode autonome : prompt + génération d'un visuel test */
function AutonomousPanel() {
  const t = useT();
  const { companyName, profile } = useOnboardingCtx();

  // Prompt pré-rempli à partir du profil de marque
  const defaultPrompt = [companyName, profile.positioning].filter(Boolean).join(" — ");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setImageUrl(null);
    setGenError(null);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      // Réponse défensive : on accepte toutes les formes connues
      const data = (await res.json()) as GenerateImageResult & { error?: string };
      if (!res.ok || data.error) {
        setGenError(data.error ?? t("La génération a échoué.", "Generation failed."));
        return;
      }
      const url = extractImageUrl(data);
      if (!url) {
        setGenError(t("Aucune image retournée par l'API.", "No image returned by the API."));
        return;
      }
      setImageUrl(url);
    } catch (err) {
      console.error("[Step4Creative] generate-image:", err);
      setGenError(t("Erreur réseau lors de la génération.", "Network error during generation."));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Zone de prompt */}
      <div className="space-y-1.5">
        <label
          className="block text-xs font-semibold text-muted"
          htmlFor="step4-prompt"
        >
          {t("Prompt de génération (modifiable)", "Generation prompt (editable)")}
        </label>
        <textarea
          id="step4-prompt"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="input w-full resize-none text-sm"
          placeholder={t(
            "Décrivez l'ambiance visuelle souhaitée…",
            "Describe the desired visual atmosphere…"
          )}
          aria-label={t("Prompt de génération d'image", "Image generation prompt")}
        />
        <p className="text-xs text-muted">
          {t(
            "L'IA utilisera ce prompt pour créer vos visuels automatiquement.",
            "The AI will use this prompt to create your visuals automatically."
          )}
        </p>
      </div>

      {/* Bouton générer */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        aria-busy={generating}
      >
        {generating ? (
          <>
            <Spinner />
            {t("Génération en cours…", "Generating…")}
          </>
        ) : (
          <>
            <WandIcon />
            {t("Générer un visuel test", "Generate a test visual")}
          </>
        )}
      </button>

      {/* Erreur de génération */}
      {genError && !generating && (
        <div
          className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3"
          role="alert"
        >
          <svg className="mt-0.5 shrink-0 text-danger-500" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-danger-700">{genError}</p>
            <p className="text-xs text-muted">
              {t("Pour créer des visuels plus avancés, rendez-vous dans", "For more advanced visuals, head to")}{" "}
              <Link href="/studio-video" className="font-medium text-primary-600 hover:underline inline-flex items-center gap-1">
                {t("le Studio Créatif", "the Creative Studio")}
                <ExternalLinkIcon />
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Image générée */}
      {imageUrl && !generating && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
            {t("Visuel test généré", "Generated test visual")}
          </p>
          {/* Cadre arrondi pour l'image */}
          <div className="overflow-hidden rounded-2xl border border-hair shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={t("Visuel test généré par l'IA", "AI-generated test visual")}
              className="w-full object-cover"
              style={{ maxHeight: "320px" }}
            />
          </div>
          <p className="text-xs text-muted">
            {t(
              "Ce visuel est une prévisualisation — les agents IA génèreront les déclinaisons par réseau à l'étape suivante.",
              "This visual is a preview — AI agents will generate network-specific variations in the next step."
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/** Panneau mode banque d'images */
function BankPanel() {
  const t = useT();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted leading-relaxed">
        {t(
          "Importez vos photos et vidéos dans la bibliothèque — les agents les habillent et les adaptent à chaque réseau (format, ratio, accroche).",
          "Upload your photos and videos to the library — agents dress and adapt them for each network (format, ratio, hook)."
        )}
      </p>
      <Link
        href="/library"
        className="btn-primary inline-flex items-center gap-2 text-sm"
      >
        {t("Ouvrir ma bibliothèque", "Open my library")}
        <ExternalLinkIcon />
      </Link>
      <p className="text-xs text-muted">
        {t(
          "Vous pouvez ajouter vos médias maintenant ou plus tard, avant de lancer les agents.",
          "You can add your media now or later, before launching the agents."
        )}
      </p>
    </div>
  );
}

/** Panneau mode studio produit */
function ProductPanel() {
  const t = useT();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted leading-relaxed">
        {t(
          "Importez une photo ou une vidéo de votre produit — le studio assemble automatiquement montage, musique et textes percutants, réseau par réseau.",
          "Upload a photo or video of your product — the studio auto-assembles montage, music and punchy copy, network by network."
        )}
      </p>
      <Link
        href="/studio-video"
        className="btn-primary inline-flex items-center gap-2 text-sm"
      >
        {t("Ouvrir le studio produit", "Open the product studio")}
        <ExternalLinkIcon />
      </Link>
      <p className="text-xs text-muted">
        {t(
          "Le studio vous permet de choisir le montage, la musique et les sous-titres pour chaque réseau social.",
          "The studio lets you pick the montage, music and subtitles for each social network."
        )}
      </p>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function Step4Creative() {
  const t = useT();
  const { state, patchState } = useOnboardingCtx();

  // Mode actif (null = aucun sélectionné encore)
  const activeMode = state.creativeMode;

  /** Sélectionne un mode et persiste via le contexte */
  function selectMode(mode: CreativeMode) {
    patchState({ creativeMode: mode });
  }

  return (
    <div className="space-y-5">

      {/* ── Introduction ── */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {/* Icône décorative IA */}
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ai-textbg text-ai-text">
            <WandIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              {t(
                "Choisissez comment vos visuels seront produits.",
                "Choose how your visuals will be produced."
              )}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {t(
                "Les agents IA de l'étape suivante utiliseront ce choix pour assembler vos publications — images, vidéos, accroches — sur chaque réseau.",
                "The AI agents in the next step will use this choice to assemble your posts — images, videos, hooks — on each network."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Grille des trois modes ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => selectMode(mode.id)}
              aria-pressed={isActive}
              className={[
                "group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200",
                "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                isActive
                  ? "border-primary-400 bg-primary-50 shadow-sm ring-2 ring-primary-200"
                  : "border-hair bg-card hover:border-primary-200 hover:bg-primary-50/30",
              ].join(" ")}
            >
              {/* Badge mode (ex. « Recommandé ») */}
              <span
                className={[
                  "absolute right-3 top-3 rounded-full px-2 py-0.5 text-2xs font-semibold",
                  isActive
                    ? "bg-primary-100 text-primary-700"
                    : "bg-canvas text-muted border border-hair",
                ].join(" ")}
              >
                {t(mode.badgeFr, mode.badgeEn)}
              </span>

              {/* Icône */}
              <span
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                  isActive
                    ? "bg-primary-100 text-primary-600"
                    : "bg-canvas text-muted group-hover:bg-primary-50 group-hover:text-primary-500",
                ].join(" ")}
                aria-hidden="true"
              >
                {mode.icon}
              </span>

              {/* Titre + indicateur check */}
              <div className="flex w-full items-start justify-between gap-2">
                <p
                  className={[
                    "text-sm font-semibold",
                    isActive ? "text-primary-700" : "text-ink",
                  ].join(" ")}
                >
                  {t(mode.titleFr, mode.titleEn)}
                </p>
                {isActive && (
                  <span className="shrink-0 text-primary-600">
                    <CheckCircleIcon />
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-muted">
                {t(mode.descFr, mode.descEn)}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Panneau d'action contextuel — affiché si un mode est choisi ── */}
      {activeMode && (
        <section
          className="card animate-fade-in space-y-4 p-5"
          aria-label={t("Options du mode sélectionné", "Selected mode options")}
        >
          {/* En-tête du panneau */}
          <div className="flex items-center gap-2 border-b border-hair pb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              {MODES.find((m) => m.id === activeMode)?.icon}
            </span>
            <p className="text-sm font-semibold text-ink">
              {t(
                MODES.find((m) => m.id === activeMode)?.titleFr ?? "",
                MODES.find((m) => m.id === activeMode)?.titleEn ?? ""
              )}
            </p>
          </div>

          {/* Panneau spécifique au mode */}
          {activeMode === "autonomous" && <AutonomousPanel />}
          {activeMode === "bank" && <BankPanel />}
          {activeMode === "product" && <ProductPanel />}
        </section>
      )}

      {/* ── Note rassurante ── (sans cadre gris, cf. retour #13) */}
      <div className="flex items-start gap-3 px-1 py-1">
        {/* Icône info */}
        <svg className="mt-0.5 shrink-0 text-muted" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <path d="M8 7v4M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-xs leading-relaxed text-muted">
          {t(
            "Vous pourrez toujours changer ou enrichir vos visuels plus tard — ce choix n'est pas définitif.",
            "You can always change or enrich your visuals later — this choice is not final."
          )}
          {" "}
          {t("Le studio complet est accessible dans", "The full studio is accessible in")}{" "}
          <Link
            href="/studio-video"
            className="font-medium text-primary-600 hover:underline inline-flex items-center gap-1"
          >
            {t("Studio Créatif", "Creative Studio")}
            <ExternalLinkIcon />
          </Link>.
        </p>
      </div>

    </div>
  );
}
