"use client";

// ── Étape 1 — Mon identité ─────────────────────────────────────────────────
// Capture le site web + les 4 handles sociaux, déclenche l'analyse IA,
// puis affiche le profil de marque de façon riche et lisible.

import { useState } from "react";
import { useOnboardingCtx } from "@/components/onboarding/context";
import { OnboardingConnectors } from "@/components/onboarding/OnboardingConnectors";
import { BusyHint } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import type { SocialNetwork } from "@/lib/onboarding/types";

// ── Icônes SVG inline ───────────────────────────────────────────────────────

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M8 1.5c0 0-3 2-3 6.5s3 6.5 3 6.5 3-2 3-6.5-3-6.5-3-6.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path d="M1.5 8h13M2.5 5h11M2.5 11h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M7.5 1 8.5 5.5 13 6.5 8.5 7.5 7.5 12 6.5 7.5 2 6.5 6.5 5.5Z"
        fill="currentColor"
      />
      <path
        d="M12 11l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8L9.4 13.4l1.8-.6Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" fill="none" />
      <path
        d="M7.5 1.5A6 6 0 0 1 13.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.5l3 3 5-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <circle cx="11.5" cy="4.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M9 5.5H7.5C7.2 5.5 7 5.7 7 6v1.5h2l-.3 2H7V14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 2c.2 1.5 1 2.5 2.5 2.7v2c-.9 0-1.8-.3-2.5-.8v4.1A3.5 3.5 0 1 1 6.5 6.5V8.6a1.5 1.5 0 1 0 1.5 1.5V2H10Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M5 6.5v4.5M5 4.5v.5M8 11V8.5C8 7.7 8.4 7 9.5 7s1.5.8 1.5 1.5V11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Configuration des plateformes ──────────────────────────────────────────

interface PlatformConfig {
  key: SocialNetwork;
  labelFr: string;
  labelEn: string;
  colorClass: string;
  icon: React.ReactNode;
  placeholder: string;
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    key: "instagram",
    labelFr: "Instagram",
    labelEn: "Instagram",
    colorClass: "text-platform-instagram",
    icon: <InstagramIcon />,
    placeholder: "votremarque",
  },
  {
    key: "facebook",
    labelFr: "Facebook",
    labelEn: "Facebook",
    colorClass: "text-platform-facebook",
    icon: <FacebookIcon />,
    placeholder: "VotrePage",
  },
  {
    key: "tiktok",
    labelFr: "TikTok",
    labelEn: "TikTok",
    colorClass: "text-ink",
    icon: <TikTokIcon />,
    placeholder: "votremarque",
  },
  {
    key: "linkedin",
    labelFr: "LinkedIn",
    labelEn: "LinkedIn",
    colorClass: "text-platform-linkedin",
    icon: <LinkedInIcon />,
    placeholder: "votre-entreprise",
  },
];

// ── Composant principal ────────────────────────────────────────────────────

export default function Step1Identity() {
  const t = useT();
  const ctx = useOnboardingCtx();
  const { profile, hasProfile, analyzing, error } = ctx;

  // État local du formulaire, initialisé depuis le profil existant
  const [website, setWebsite] = useState<string>(profile.website ?? "");
  const [description, setDescription] = useState<string>(profile.description ?? "");
  const [handles, setHandles] = useState<Record<SocialNetwork, string>>({
    instagram: profile.handles.instagram ?? "",
    facebook: profile.handles.facebook ?? "",
    tiktok: profile.handles.tiktok ?? "",
    linkedin: profile.handles.linkedin ?? "",
  });

  // Mettre à jour un handle individuel
  function setHandle(network: SocialNetwork, value: string) {
    setHandles((prev) => ({ ...prev, [network]: value.replace(/^@/, "") }));
  }

  // Lancer l'analyse IA
  async function handleAnalyze() {
    const cleanHandles = {
      instagram: handles.instagram || undefined,
      facebook: handles.facebook || undefined,
      tiktok: handles.tiktok || undefined,
      linkedin: handles.linkedin || undefined,
    };
    await ctx.analyzeIdentity(website, cleanHandles, description);
  }

  return (
    <div className="space-y-5">
      {/* ── Explication de la valeur ajoutée ── */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {/* Icône IA décorative */}
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ai-textbg">
            <span className="text-ai-text">
              <SparkleIcon />
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              {t(
                "L'IA lit votre site et vos comptes pour comprendre qui vous êtes.",
                "The AI reads your site and accounts to understand who you are."
              )}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {t(
                "Tout ce qui suit — objectifs, contenus, ciblage — sera adapté à votre marque réelle. Plus vous renseignez, plus le résultat est précis.",
                "Everything that follows — objectives, content, targeting — will be tailored to your actual brand. The more you fill in, the sharper the result."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Formulaire : site web + handles ── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <p className="section-label">{t("Vos coordonnées en ligne", "Your online presence")}</p>

        {/* Site web */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted" htmlFor="step1-website">
            {t("Site web", "Website")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
              <GlobeIcon />
            </span>
            <input
              id="step1-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://votremarque.com"
              className="input pl-9"
              aria-label={t("URL de votre site web", "Your website URL")}
            />
          </div>
        </div>

        {/* Descriptif de la société */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted" htmlFor="step1-description">
            {t("Descriptif de la société", "Company description")}
          </label>
          <textarea
            id="step1-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={t(
              "Décrivez votre société : activité, produits/services, clients, ce qui vous différencie…",
              "Describe your company: business, products/services, customers, what sets you apart…"
            )}
            className="input min-h-[5.5rem] resize-y"
            aria-label={t("Descriptif de votre société", "Your company description")}
          />
          <p className="text-2xs text-muted">
            {t(
              "Votre vision est prioritaire pour l'IA — plus c'est précis, plus l'analyse est juste.",
              "Your own words take priority for the AI — the more precise, the sharper the analysis."
            )}
          </p>
        </div>

        {/* Handles sociaux */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PLATFORM_CONFIGS.map((p) => (
            <div key={p.key} className="space-y-1.5">
              <label
                className="flex items-center gap-1.5 text-xs font-semibold"
                htmlFor={`step1-handle-${p.key}`}
              >
                <span className={p.colorClass}>{p.icon}</span>
                <span className="text-muted">{t(p.labelFr, p.labelEn)}</span>
              </label>
              <div className="relative">
                {/* Préfixe « @ » */}
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted">
                  @
                </span>
                <input
                  id={`step1-handle-${p.key}`}
                  type="text"
                  value={handles[p.key]}
                  onChange={(e) => setHandle(p.key, e.target.value)}
                  placeholder={p.placeholder}
                  className="input pl-7"
                  aria-label={t(`Handle ${p.labelFr}`, `${p.labelEn} handle`)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Bouton d'analyse IA */}
        {(() => {
          const nothingFilled =
            !website && !description.trim() && Object.values(handles).every((h) => !h);
          return (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || nothingFilled}
                className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto disabled:opacity-50"
                aria-busy={analyzing}
              >
                {analyzing ? (
                  <>
                    <SpinnerIcon />
                    {t("Analyse en cours… (10-20 s)", "Analysis in progress… (10-20 s)")}
                  </>
                ) : (
                  <>
                    <SparkleIcon />
                    {t("Analyser mon identité avec l'IA", "Analyse my identity with AI")}
                  </>
                )}
              </button>

              {/* Aide quand le bouton est désactivé faute de saisie */}
              {!analyzing && nothingFilled && (
                <p className="text-2xs text-muted">
                  {t(
                    "Renseignez au moins un élément : site web, descriptif ou un compte social.",
                    "Fill in at least one item: website, description or a social account."
                  )}
                </p>
              )}

              {/* Feedback visible immédiat pendant l'analyse */}
              {analyzing && (
                <BusyHint
                  label={t("L'IA analyse votre marque…", "The AI is analysing your brand…")}
                  eta={t("~10–20 s", "~10–20 s")}
                />
              )}
            </div>
          );
        })()}

        {/* Alerte erreur */}
        {error && (
          <div
            className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-3"
            role="alert"
          >
            <svg
              className="mt-0.5 shrink-0 text-danger-600"
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <path
                d="M7.5 4.5v4M7.5 10.5v.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-sm text-danger-700">{error}</p>
          </div>
        )}
      </div>

      {/* ── Connecteurs : relier tous les réseaux dès le départ ── */}
      <div className="card p-4 sm:p-5">
        <OnboardingConnectors />
      </div>

      {/* ── Résultat : profil de marque ── */}
      {hasProfile ? (
        <ProfileResult onReanalyze={handleAnalyze} analyzing={analyzing} />
      ) : (
        /* Hint vide : CTA clair vers le bouton d'analyse */
        <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary-200 bg-white text-primary-600 shadow-sm">
            <SparkleIcon />
          </div>
          <p className="text-sm font-semibold text-ink">
            {t("Lancez l'analyse pour construire votre profil", "Run the analysis to build your profile")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t(
              "Renseignez votre site, un descriptif ou un compte ci-dessus, puis cliquez sur « Analyser mon identité avec l'IA ».",
              "Fill in your website, a description or an account above, then click “Analyse my identity with AI”."
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sous-composant : profil de marque ─────────────────────────────────────

function ProfileResult({
  onReanalyze,
  analyzing,
}: {
  onReanalyze: () => void;
  analyzing: boolean;
}) {
  const t = useT();
  const { profile, next } = useOnboardingCtx();

  return (
    <div className="space-y-4">
      {/* En-tête du profil */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {t("Profil de marque", "Brand profile")}
        </h2>
        <div className="flex items-center gap-2">
          {/* Badge IA ou ébauche */}
          {profile.aiGenerated ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ai-textbg px-2.5 py-0.5 text-2xs font-semibold text-ai-text">
              <SparkleIcon /> IA
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-hair bg-canvas px-2.5 py-0.5 text-2xs font-medium text-muted">
              {t("ébauche", "draft")}
            </span>
          )}
          {/* Bouton ré-analyser */}
          <button
            type="button"
            onClick={onReanalyze}
            disabled={analyzing}
            className="btn-ghost flex items-center gap-1.5 text-xs disabled:opacity-50"
          >
            {analyzing ? <SpinnerIcon /> : null}
            {t("Ré-analyser", "Re-analyse")}
          </button>
        </div>
      </div>

      {/* Bloc « Qui vous êtes » — mis en avant */}
      <div className="card p-4 sm:p-5 space-y-2">
        <p className="section-label text-primary-600">{t("Qui vous êtes", "Who you are")}</p>
        <p className="text-sm leading-relaxed text-ink">{profile.summary}</p>
      </div>

      {/* Grille 2-colonnes : Positionnement / Ton / Audience */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ProfileBlock
          labelFr="Positionnement"
          labelEn="Positioning"
          value={profile.positioning}
        />
        <ProfileBlock
          labelFr="Ton de voix"
          labelEn="Tone of voice"
          value={profile.tone}
        />
        <ProfileBlock
          labelFr="Audience"
          labelEn="Audience"
          value={profile.audience}
          className="sm:col-span-2 lg:col-span-1"
        />
      </div>

      {/* Thèmes — chips */}
      {profile.themes.length > 0 && (
        <div className="card p-4 sm:p-5 space-y-3">
          <p className="section-label">{t("Thèmes clés", "Key themes")}</p>
          <div className="flex flex-wrap gap-2">
            {profile.themes.map((theme) => (
              <span
                key={theme}
                className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Forces — checklist */}
      {profile.strengths.length > 0 && (
        <div className="card p-4 sm:p-5 space-y-3">
          <p className="section-label">{t("Points forts", "Strengths")}</p>
          <ul className="space-y-2">
            {profile.strengths.map((s) => (
              <li key={s} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-600">
                  <CheckIcon />
                </span>
                <span className="text-sm text-ink">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Réseaux recommandés — chips avec couleur plateforme */}
      {profile.recommendedNetworks.length > 0 && (
        <div className="card p-4 sm:p-5 space-y-3">
          <p className="section-label">{t("Réseaux recommandés", "Recommended networks")}</p>
          <div className="flex flex-wrap gap-2">
            {profile.recommendedNetworks.map((n) => (
              <NetworkChip key={n} network={n} />
            ))}
          </div>
        </div>
      )}

      {/* Teaser des objectifs suggérés */}
      {profile.suggestedObjectives.length > 0 && (
        <div className="card p-4 sm:p-5 space-y-3 border-primary-100 bg-primary-50/30">
          <div className="flex items-center justify-between gap-2">
            <p className="section-label text-primary-600">
              {t("Objectifs suggérés pour vous", "Suggested objectives for you")}
            </p>
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-2xs font-bold text-primary-700">
              {profile.suggestedObjectives.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {profile.suggestedObjectives.slice(0, 3).map((obj) => (
              <li key={obj.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" aria-hidden="true" />
                <span className="text-sm font-medium text-ink">{obj.label}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-primary-600 font-medium">
            → {t("On les choisit à l'étape suivante", "We'll pick them at the next step")}
          </p>
        </div>
      )}

      {/* Bouton principal — passer à l'étape 2 */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={next}
          className="btn-primary flex items-center gap-2"
        >
          {t("C'est tout à fait nous → Objectifs", "That's us → Objectives")}
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

// ── Micro-composants internes ─────────────────────────────────────────────

function ProfileBlock({
  labelFr,
  labelEn,
  value,
  className = "",
}: {
  labelFr: string;
  labelEn: string;
  value: string;
  className?: string;
}) {
  const t = useT();
  if (!value) return null;
  return (
    <div className={`card p-4 space-y-1.5 ${className}`}>
      <p className="section-label">{t(labelFr, labelEn)}</p>
      <p className="text-sm leading-relaxed text-ink">{value}</p>
    </div>
  );
}

function NetworkChip({ network }: { network: SocialNetwork }) {
  const t = useT();

  const MAP: Record<SocialNetwork, { labelFr: string; labelEn: string; color: string; icon: React.ReactNode }> = {
    instagram: {
      labelFr: "Instagram",
      labelEn: "Instagram",
      color: "text-platform-instagram border-pink-200 bg-pink-50",
      icon: <InstagramIcon />,
    },
    facebook: {
      labelFr: "Facebook",
      labelEn: "Facebook",
      color: "text-platform-facebook border-blue-200 bg-blue-50",
      icon: <FacebookIcon />,
    },
    tiktok: {
      labelFr: "TikTok",
      labelEn: "TikTok",
      color: "text-ink border-hair bg-canvas",
      icon: <TikTokIcon />,
    },
    linkedin: {
      labelFr: "LinkedIn",
      labelEn: "LinkedIn",
      color: "text-platform-linkedin border-sky-200 bg-sky-50",
      icon: <LinkedInIcon />,
    },
  };

  const cfg = MAP[network];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {t(cfg.labelFr, cfg.labelEn)}
    </span>
  );
}
