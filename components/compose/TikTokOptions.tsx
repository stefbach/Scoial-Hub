"use client";

/**
 * components/compose/TikTokOptions.tsx
 *
 * Réglages de publication TikTok — « Required UX Implementation » des
 * guidelines Content Posting API : confidentialité choisie explicitement,
 * permissions d'interaction, divulgation de contenu commercial, consentement.
 *
 * Partagé par /compose et /series. Cette UI conditionne la conformité de
 * l'application : en avoir DEUX implémentations, c'est se garantir qu'elles
 * divergeront, et qu'un écran finira par publier sans respecter les règles
 * sur lesquelles l'accès Direct Post a été accordé.
 */

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { TikTokPublishOptions } from "@/lib/types";

/** Réponse de GET /api/connectors/tiktok/creator-info. */
export interface TikTokCreatorInfoView {
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec?: number;
  creatorNickname?: string;
}

const PRIVACY_LABEL: Record<string, [string, string]> = {
  PUBLIC_TO_EVERYONE: ["Tout le monde", "Everyone"],
  MUTUAL_FOLLOW_FRIENDS: ["Amis (abonnements mutuels)", "Friends (mutual follows)"],
  FOLLOWER_OF_CREATOR: ["Vos abonnés", "Your followers"],
  SELF_ONLY: ["Vous uniquement (privé)", "Only you (private)"],
};

export interface TikTokOptionsState {
  creatorInfo: TikTokCreatorInfoView | null;
  loading: boolean;
  error: string | null;
  /** Options prêtes à transmettre au connecteur, ou null si le choix est incomplet. */
  options: TikTokPublishOptions | null;
  /** Vrai quand la publication peut partir (choix fait + consentement donné). */
  ready: boolean;
  privacy: string;
  setPrivacy: (v: string) => void;
  allowDuet: boolean;
  setAllowDuet: (v: boolean) => void;
  allowStitch: boolean;
  setAllowStitch: (v: boolean) => void;
  allowComment: boolean;
  setAllowComment: (v: boolean) => void;
  disclosureOn: boolean;
  setDisclosureOn: (v: boolean) => void;
  yourBrand: boolean;
  setYourBrand: (v: boolean) => void;
  brandedContent: boolean;
  setBrandedContent: (v: boolean) => void;
  musicConsent: boolean;
  setMusicConsent: (v: boolean) => void;
}

/**
 * Charge les infos créateur et tient l'état des réglages.
 *
 * `active` = TikTok est effectivement ciblé : tant qu'il est faux, aucun appel
 * réseau n'est fait et `ready` vaut true (rien à valider pour les autres
 * réseaux — l'appelant peut donc l'utiliser directement dans sa condition de
 * publication sans traiter le cas TikTok à part).
 */
export function useTikTokOptions({
  companyId,
  active,
}: {
  companyId: string;
  active: boolean;
}): TikTokOptionsState {
  const t = useT();
  const [creatorInfo, setCreatorInfo] = useState<TikTokCreatorInfoView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Confidentialité SANS valeur par défaut : le créateur DOIT choisir.
  const [privacy, setPrivacy] = useState("");
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [allowComment, setAllowComment] = useState(false);
  const [disclosureOn, setDisclosureOn] = useState(false);
  const [yourBrand, setYourBrand] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);
  const [musicConsent, setMusicConsent] = useState(false);

  useEffect(() => {
    if (!active || creatorInfo || loading) return;
    setLoading(true);
    setError(null);
    fetch(`/api/connectors/tiktok/creator-info?companyId=${encodeURIComponent(companyId)}`)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
        setCreatorInfo(d as TikTokCreatorInfoView);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("Erreur inconnue", "Unknown error")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, companyId]);

  const disclosure: TikTokPublishOptions["disclosure"] = !disclosureOn
    ? "none"
    : yourBrand && brandedContent
    ? "both"
    : brandedContent
    ? "branded_content"
    : yourBrand
    ? "your_brand"
    : "none";

  // Prêt à publier : confidentialité choisie, consentement coché, et — si le
  // toggle de divulgation commerciale est allumé — au moins une case cochée.
  const ready =
    !active ||
    (privacy !== "" && musicConsent && (!disclosureOn || yourBrand || brandedContent));

  const options: TikTokPublishOptions | null =
    active && privacy !== ""
      ? { privacyLevel: privacy, allowDuet, allowStitch, allowComment, disclosure, musicConsent }
      : null;

  return {
    creatorInfo, loading, error, options, ready,
    privacy, setPrivacy,
    allowDuet, setAllowDuet,
    allowStitch, setAllowStitch,
    allowComment, setAllowComment,
    disclosureOn, setDisclosureOn,
    yourBrand, setYourBrand,
    brandedContent, setBrandedContent,
    musicConsent, setMusicConsent,
  };
}

/** Panneau de réglages. `isImage` masque Duo/Stitch (non applicables aux photos). */
export function TikTokOptionsPanel({
  state,
  isImage = false,
}: {
  state: TikTokOptionsState;
  isImage?: boolean;
}) {
  const t = useT();
  const {
    creatorInfo, loading, error,
    privacy, setPrivacy,
    allowDuet, setAllowDuet,
    allowStitch, setAllowStitch,
    allowComment, setAllowComment,
    disclosureOn, setDisclosureOn,
    yourBrand, setYourBrand,
    brandedContent, setBrandedContent,
    musicConsent, setMusicConsent,
  } = state;

  // TikTok interdit le contenu de marque sur une publication privée.
  const brandedContentDisabled = privacy === "" || privacy === "SELF_ONLY";

  const disclosureLabel = brandedContent
    ? t("Votre photo/vidéo sera étiquetée « Partenariat rémunéré ».", "Your photo/video will be labeled as 'Paid partnership'.")
    : yourBrand
    ? t("Votre photo/vidéo sera étiquetée « Contenu promotionnel ».", "Your photo/video will be labeled as 'Promotional content'.")
    : null;

  const consentText =
    disclosureOn && brandedContent
      ? t(
          "En publiant, vous acceptez la Branded Content Policy et la Music Usage Confirmation de TikTok.",
          "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
        )
      : t(
          "En publiant, vous acceptez la Music Usage Confirmation de TikTok.",
          "By posting, you agree to TikTok's Music Usage Confirmation."
        );

  return (
    <div className="space-y-3 rounded-xl border border-hair bg-canvas/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="section-label">{t("Réglages TikTok", "TikTok settings")}</div>
        {creatorInfo?.creatorNickname && (
          <span className="text-2xs text-muted">@{creatorInfo.creatorNickname}</span>
        )}
      </div>

      {loading && (
        <p className="text-2xs text-muted">{t("Chargement des réglages du compte…", "Loading account settings…")}</p>
      )}
      {error && (
        <p className="text-2xs text-danger-600">
          {t("Impossible de charger les réglages TikTok :", "Unable to load TikTok settings:")} {error}
        </p>
      )}

      {creatorInfo && (
        <>
          {/* Confidentialité — obligatoire, AUCUNE valeur par défaut */}
          <label className="block text-xs font-medium text-ink">
            {t("Confidentialité", "Privacy")}
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
              className="input mt-1 text-sm"
            >
              <option value="" disabled>
                {t("Choisissez qui peut voir cette publication", "Select who can view this post")}
              </option>
              {creatorInfo.privacyLevelOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {t(...(PRIVACY_LABEL[opt] ?? [opt, opt]))}
                </option>
              ))}
            </select>
          </label>

          {/* Interactions — décochées par défaut, grisées si verrouillées par le créateur. */}
          <div>
            <div className="mb-1 text-xs font-medium text-ink">{t("Interactions autorisées", "Allowed interactions")}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {!isImage && (
                <>
                  <label
                    className={`flex items-center gap-1.5 text-xs ${creatorInfo.duetDisabled ? "text-muted" : "text-ink"}`}
                    title={creatorInfo.duetDisabled ? t("Désactivé dans les réglages TikTok de ce compte.", "Disabled in this account's TikTok settings.") : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={allowDuet && !creatorInfo.duetDisabled}
                      disabled={creatorInfo.duetDisabled}
                      onChange={(e) => setAllowDuet(e.target.checked)}
                      className="h-3.5 w-3.5 accent-page"
                    />
                    {t("Duos", "Duet")}
                  </label>
                  <label
                    className={`flex items-center gap-1.5 text-xs ${creatorInfo.stitchDisabled ? "text-muted" : "text-ink"}`}
                    title={creatorInfo.stitchDisabled ? t("Désactivé dans les réglages TikTok de ce compte.", "Disabled in this account's TikTok settings.") : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={allowStitch && !creatorInfo.stitchDisabled}
                      disabled={creatorInfo.stitchDisabled}
                      onChange={(e) => setAllowStitch(e.target.checked)}
                      className="h-3.5 w-3.5 accent-page"
                    />
                    {t("Stitch", "Stitch")}
                  </label>
                </>
              )}
              <label
                className={`flex items-center gap-1.5 text-xs ${creatorInfo.commentDisabled ? "text-muted" : "text-ink"}`}
                title={creatorInfo.commentDisabled ? t("Désactivé dans les réglages TikTok de ce compte.", "Disabled in this account's TikTok settings.") : undefined}
              >
                <input
                  type="checkbox"
                  checked={allowComment && !creatorInfo.commentDisabled}
                  disabled={creatorInfo.commentDisabled}
                  onChange={(e) => setAllowComment(e.target.checked)}
                  className="h-3.5 w-3.5 accent-page"
                />
                {t("Commentaires", "Comments")}
              </label>
            </div>
          </div>

          {/* Divulgation de contenu commercial — éteinte par défaut */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink">
              <input
                type="checkbox"
                checked={disclosureOn}
                onChange={(e) => {
                  setDisclosureOn(e.target.checked);
                  if (!e.target.checked) {
                    setYourBrand(false);
                    setBrandedContent(false);
                  }
                }}
                className="h-3.5 w-3.5 accent-page"
              />
              {t("Ce contenu fait la promotion de vous-même, d'une marque ou d'un service", "This content promotes yourself, a brand or a service")}
            </label>
            {disclosureOn && (
              <div className="mt-1.5 ml-5 space-y-1">
                <label className="flex items-center gap-1.5 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={yourBrand}
                    onChange={(e) => setYourBrand(e.target.checked)}
                    className="h-3.5 w-3.5 accent-page"
                  />
                  {t("Votre marque", "Your Brand")}
                </label>
                <label
                  className={`flex items-center gap-1.5 text-xs ${brandedContentDisabled ? "text-muted" : "text-ink"}`}
                  title={
                    brandedContentDisabled
                      ? t("Branded content visibility cannot be set to private.", "Branded content visibility cannot be set to private.")
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={brandedContent && !brandedContentDisabled}
                    disabled={brandedContentDisabled}
                    onChange={(e) => setBrandedContent(e.target.checked)}
                    className="h-3.5 w-3.5 accent-page"
                  />
                  {t("Contenu de marque", "Branded Content")}
                </label>
                {disclosureLabel && <p className="text-2xs text-muted">{disclosureLabel}</p>}
                {!yourBrand && !brandedContent && (
                  <p className="text-2xs text-danger-600">
                    {t("Sélectionnez au moins une option pour publier.", "Select at least one option to publish.")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Consentement — obligatoire avant publication */}
          <label className="flex items-start gap-1.5 text-xs text-ink">
            <input
              type="checkbox"
              checked={musicConsent}
              onChange={(e) => setMusicConsent(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-page"
            />
            <span>{consentText}</span>
          </label>

          <p className="text-2xs text-muted">
            {t(
              "Après publication, le contenu peut prendre quelques minutes à être traité et visible sur le profil TikTok.",
              "After publishing, the content may take a few minutes to process and appear on the TikTok profile."
            )}
          </p>
        </>
      )}
    </div>
  );
}
