"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import {
  CustomFields,
  LookalikeFields,
  ReachEstimator,
  SavedFields,
  customToAudience,
  customValid,
  estimateLookalikeReach,
  estimateSavedReach,
  lookalikeToAudience,
  lookalikeValid,
  makeCustomConfig,
  makeLookalikeConfig,
  makeSavedConfig,
  savedToAudience,
  savedValid,
  type CustomConfig,
  type LookalikeConfig,
  type SavedConfig,
} from "./audience-form";
import type { Audience, AudienceType } from "@/lib/types";

const TYPE_BADGE_STYLE: Record<AudienceType, { bg: string; text: string }> = {
  saved: { bg: "bg-ai-textbg", text: "text-ai-text" },
  custom: { bg: "bg-ai-visualbg", text: "text-ai-visual" },
  lookalike: { bg: "bg-amber-50", text: "text-amber-700" },
};

export function NewAudienceModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: (audience: Audience) => void;
}) {
  const { company, data } = useCompany();
  const t = useT();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<AudienceType>("saved");
  const [savedConfig, setSavedConfig] = useState<SavedConfig>(makeSavedConfig());
  const [customConfig, setCustomConfig] = useState<CustomConfig>(makeCustomConfig());
  const [lookConfig, setLookConfig] = useState<LookalikeConfig>(makeLookalikeConfig());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const TYPE_LABEL: Record<AudienceType, string> = {
    saved: t("Enregistrée", "Saved"),
    custom: t("Personnalisée", "Custom"),
    lookalike: t("Sosie", "Lookalike"),
  };

  const SUBSTEP_LABEL: Record<AudienceType, string> = {
    saved: t("Étape 2 sur 2 — Définir le ciblage", "Step 2 of 2 — Define targeting"),
    custom: t("Étape 2 sur 2 — Télécharger votre liste", "Step 2 of 2 — Upload your list"),
    lookalike: t("Étape 2 sur 2 — Configurer votre sosie", "Step 2 of 2 — Configure your lookalike"),
  };

  const hasCustom = data.audiences.list.some((a) => a.type === "custom");

  const lookalikeSourceOptions = useMemo(
    () => data.audiences.list.filter((a) => a.type === "custom" || a.type === "saved"),
    [data.audiences.list]
  );

  const choose = (audienceType: AudienceType) => {
    setType(audienceType);
    setStep(2);
  };

  const canSubmit =
    type === "saved"
      ? savedValid(savedConfig)
      : type === "custom"
      ? customValid(customConfig)
      : lookalikeValid(lookConfig);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    // id provisoire — l'API renvoie l'identifiant persisté définitif.
    const tmpId = `aud-${Date.now()}`;
    let audience: Audience;
    if (type === "saved") audience = savedToAudience(savedConfig, tmpId);
    else if (type === "custom") audience = customToAudience(customConfig, tmpId);
    else {
      const src = data.audiences.list.find((a) => a.id === lookConfig.sourceAudienceId);
      audience = lookalikeToAudience(lookConfig, tmpId, src?.name ?? "Source audience");
    }
    try {
      const res = await fetch("/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          type: audience.type,
          name: audience.name,
          description: audience.description,
          detail: audience.detail,
          reach: audience.reach,
          inUse: audience.inUse,
          config: audience.config,
          metaAudienceId: audience.metaAudienceId,
          createdBy: audience.createdBy,
          lastSyncedAt: audience.lastSyncedAt,
        }),
      });
      if (!res.ok) {
        setError(t("Échec de la création de l'audience. Réessayez.", "Failed to create audience. Please retry."));
        return;
      }
      const created = (await res.json()) as Audience;
      onCreated(created);
      onClose();
    } catch {
      setError(t("Échec de la création de l'audience. Réessayez.", "Failed to create audience. Please retry."));
    } finally {
      setSubmitting(false);
    }
  };

  const stepHeader =
    step === 1 ? (
      <div className="border-b-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">{t("Nouvelle audience", "New audience")}</div>
        <div className="text-2xs text-muted">{t("Étape 1 sur 2 — Choisir le type d'audience", "Step 1 of 2 — Choose audience type")}</div>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-2 border-b-hair px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            aria-label={t("Retour", "Back")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              {t("Nouvelle audience", "New audience")}
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-medium ${TYPE_BADGE_STYLE[type].bg} ${TYPE_BADGE_STYLE[type].text}`}
              >
                {TYPE_LABEL[type]}
              </span>
            </div>
            <div className="text-2xs text-muted">{SUBSTEP_LABEL[type]}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t("Fermer", "Close")}
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
        >
          ✕
        </button>
      </div>
    );

  return (
    <Modal open onClose={onClose} width={step === 1 ? "max-w-xl" : "max-w-3xl"}>
      {stepHeader}

      {step === 1 ? (
        <div className="px-4 py-3">
          <p className="mb-3 text-sm text-muted">
            {t(
              "Les audiences définissent qui voit vos publicités. Choisissez le type qui correspond à votre façon de cibler.",
              "Audiences define who sees your ads. Pick the type that matches how you want to target."
            )}
          </p>
          <div className="space-y-2">
            <TypeCard
              type="saved"
              title={t("Audience enregistrée", "Saved audience")}
              badge={t("Le plus courant", "Most common")}
              description={t(
                "Ciblez par données démographiques et centres d'intérêt — genre, âge, lieu, loisirs. Commencez ici si vous n'avez pas encore de liste de clients.",
                "Target by demographics and interests — gender, age, location, hobbies. Start here if you don't have a customer list yet."
              )}
              example={t(
                "Exemple : Femmes 35-55 à l'Île Maurice intéressées par le bien-être",
                "Example: Women 35-55 in Mauritius interested in wellness"
              )}
              icon={<TargetIcon />}
              onClick={() => choose("saved")}
            />
            <TypeCard
              type="custom"
              title={t("Audience personnalisée", "Custom audience")}
              description={t(
                "Téléchargez une liste de vos clients existants (e-mails ou numéros de téléphone). Meta les associera à leurs comptes.",
                "Upload a list of your existing customers (emails or phone numbers). Meta will match them to their accounts."
              )}
              example={t(
                `Exemple : Tous les anciens clients de ${company.name} — campagne de réengagement`,
                `Example: All past ${company.name} customers — re-engagement campaign`
              )}
              icon={<UsersIcon />}
              onClick={() => choose("custom")}
            />
            <TypeCard
              type="lookalike"
              title={t("Audience sosie", "Lookalike audience")}
              description={t(
                "Trouvez de nouvelles personnes similaires à vos clients existants. Nécessite une audience personnalisée.",
                "Find new people similar to your existing customers. Requires a Custom audience first."
              )}
              example={t(
                "Exemple : Personnes comme nos meilleurs clients — élargir la portée",
                "Example: People like our top customers — broaden reach"
              )}
              icon={<AffiliateIcon />}
              disabled={!hasCustom}
              disabledTooltip={t("Créez d'abord une audience personnalisée pour créer un sosie.", "Create a Custom audience first to build a Lookalike.")}
              onClick={() => choose("lookalike")}
            />
          </div>
          {/* Footer sans filet — la fine ligne (border-t-hair) traversait la modale. */}
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
          </div>
        </div>
      ) : (
        <Step2
          type={type}
          savedConfig={savedConfig}
          setSavedConfig={setSavedConfig}
          customConfig={customConfig}
          setCustomConfig={setCustomConfig}
          lookConfig={lookConfig}
          setLookConfig={setLookConfig}
          lookalikeSourceOptions={lookalikeSourceOptions}
          onBack={() => setStep(1)}
          onCancel={onClose}
          onSubmit={submit}
          canSubmit={canSubmit}
          submitting={submitting}
          error={error}
        />
      )}
    </Modal>
  );
}

function TypeCard({
  type,
  title,
  description,
  example,
  badge,
  icon,
  disabled,
  disabledTooltip,
  onClick,
}: {
  type: AudienceType;
  title: string;
  description: string;
  example: string;
  badge?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
  onClick: () => void;
}) {
  const style = TYPE_BADGE_STYLE[type];
  const t = useT();
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledTooltip : undefined}
      className={`flex w-full items-start gap-3 rounded-md border-hair border-hair bg-card p-3 text-left transition-colors ${
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-canvas"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${style.bg} ${style.text}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{title}</span>
          {badge && (
            <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${style.bg} ${style.text}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="text-2xs text-muted">{description}</div>
        <div className="mt-1.5 text-2xs text-muted">
          <span className="font-medium text-ink/80">{t("Exemple :", "Example:")}</span> {example.replace(/^(Example|Exemple)\s*:\s*/i, "")}
        </div>
      </div>
      <span className="mt-1 shrink-0 text-muted">›</span>
    </button>
  );
}

function Step2({
  type,
  savedConfig,
  setSavedConfig,
  customConfig,
  setCustomConfig,
  lookConfig,
  setLookConfig,
  lookalikeSourceOptions,
  onBack,
  onCancel,
  onSubmit,
  canSubmit,
  submitting,
  error,
}: {
  type: AudienceType;
  savedConfig: SavedConfig;
  setSavedConfig: (c: SavedConfig) => void;
  customConfig: CustomConfig;
  setCustomConfig: (c: CustomConfig) => void;
  lookConfig: LookalikeConfig;
  setLookConfig: (c: LookalikeConfig) => void;
  lookalikeSourceOptions: Audience[];
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
}) {
  const t = useT();
  const requiredHint =
    type === "saved"
      ? t("Remplissez les champs requis pour continuer.", "Fill required fields to continue.")
      : type === "custom"
      ? t("Ajoutez un nom et téléchargez un CSV pour continuer.", "Add a name and upload a CSV to continue.")
      : t("Ajoutez un nom, une audience source et au moins un pays pour continuer.", "Add a name, source audience, and at least one country to continue.");

  return (
    <>
      {/*
        Layout flex colonne sur mobile, grille 2 colonnes sur écrans ≥ lg
        pour éviter que le contenu soit tronqué. Le Modal gère déjà
        max-h-[90vh] + overflow-y-auto sur le panel.
      */}
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_280px]">
        <div className="p-4">
          {type === "saved" && (
            <SavedFields config={savedConfig} onChange={setSavedConfig} />
          )}
          {type === "custom" && (
            <CustomFields config={customConfig} onChange={setCustomConfig} />
          )}
          {type === "lookalike" && (
            <LookalikeFields
              config={lookConfig}
              onChange={setLookConfig}
              sourceOptions={lookalikeSourceOptions}
            />
          )}
        </div>

        {/* Right column — info / estimator */}
        <div className="border-t p-4 lg:border-l lg:border-t-0 bg-canvas/40">
          {type === "saved" && (
            <ReachEstimator
              reach={estimateSavedReach(savedConfig)}
              label={t("personnes dans cette audience", "people in this audience")}
              trailing={t(
                "La portée est estimée par Meta et se met à jour à mesure que vous modifiez le ciblage.",
                "Reach is estimated by Meta and updates as you change targeting."
              )}
            />
          )}
          {type === "custom" && (
            <CustomInfoPanel
              hasFile={!!customConfig.fileName}
              fileName={customConfig.fileName}
              fileSize={customConfig.fileSize}
            />
          )}
          {type === "lookalike" && (
            <ReachEstimator
              reach={estimateLookalikeReach(lookConfig)}
              label={t("personnes similaires sur Meta", "similar people on Meta")}
              trailing={t(
                "Les sosies élargissent la portée au-delà de vos clients existants.",
                "Lookalikes broaden reach beyond your existing customers."
              )}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>← {t("Retour", "Back")}</Button>
        <div className="flex items-center gap-2">
          {error && <span className="text-2xs text-red-600">{error}</span>}
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>{t("Annuler", "Cancel")}</Button>
          <Button
            variant="primary"
            disabled={!canSubmit || submitting}
            title={canSubmit ? undefined : requiredHint}
            onClick={onSubmit}
          >
            {submitting && (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            {submitting ? t("Création…", "Creating…") : t("Créer l'audience", "Create audience")}
          </Button>
        </div>
      </div>
    </>
  );
}

function CustomInfoPanel({
  hasFile,
  fileName,
  fileSize,
}: {
  hasFile: boolean;
  fileName?: string;
  fileSize?: number;
}) {
  const t = useT();
  if (!hasFile) {
    return (
      <div className="space-y-3">
        <div className="section-label">{t("Taille de l'audience", "Audience size")}</div>
        <div className="text-sm text-muted">{t("Téléchargez un fichier pour voir la taille.", "Upload a file to see size.")}</div>
        <div className="text-2xs text-muted">
          {t(
            "Votre CSV est haché localement avant d'être envoyé à Meta — nous ne voyons ni ne stockons jamais les e-mails ou numéros de téléphone bruts.",
            "Your CSV is hashed locally before being sent to Meta — we never see or store raw emails or phone numbers."
          )}
        </div>
      </div>
    );
  }
  // Mock detection — assume ~50 rows per KB.
  const detected = Math.max(50, Math.round(((fileSize ?? 25_000) / 1024) * 50));
  const matched = Math.round(detected * 0.83);
  return (
    <div className="space-y-4">
      <div>
        <div className="section-label">{t("Taille de l'audience", "Audience size")}</div>
        <div className="mt-1 text-xl font-semibold text-ink">
          ~{detected.toLocaleString()} {t("lignes détectées", "rows detected")}
        </div>
        <div className="text-2xs text-muted">{t("dans", "in")} {fileName}</div>
      </div>
      <div>
        <div className="section-label">{t("Correspondance Meta estimée", "Estimated Meta match")}</div>
        <div className="mt-1 text-sm text-ink">
          ~{matched.toLocaleString()} {t("sur", "of")} {detected.toLocaleString()} {t("correspondront · 83%", "will match · 83%")}
        </div>
      </div>
      <div className="text-2xs text-muted">
        {t(
          "Meta hache votre fichier de votre côté avant la mise en correspondance. Les valeurs brutes ne quittent jamais votre navigateur.",
          "Meta hashes your file on your side before matching. Raw values never leave your browser."
        )}
      </div>
    </div>
  );
}

function TargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3 19c1.5-3 4-4 6-4s4.5 1 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 19c1-2 2.5-3 4-3s3 1 3 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function AffiliateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8 8l3 8M16 8l-3 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
