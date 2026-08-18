"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { AiTextPanel, AiVisualsPanel } from "@/components/ui/AiPanel";
import { CreativeInspiration } from "@/components/compose/CreativeInspiration";
import { ComposeAgent, type ComposeNet } from "@/components/compose/ComposeAgent";
import { MediaEditor } from "@/components/compose/MediaEditor";
import { PostPreview, type PreviewPlatform } from "@/components/compose/PostPreview";
import BrandKitPanel from "@/components/studio/BrandKitPanel";
import { AgentLauncher } from "@/components/agents/AgentLauncher";
import { IMAGE_MODELS, VIDEO_MODELS, DEFAULT_IMAGE_MODEL_ID, DEFAULT_VIDEO_MODEL_ID } from "@/lib/ai/model-catalog";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";
import { WhenToPublish } from "@/components/compose/WhenToPublish";
import { Toast } from "@/components/ui/Toast";
import { findDraft, findPost } from "@/lib/draft-store";
import { findTemplate } from "@/lib/template-store";
import { findHistoryItem } from "@/lib/history-store";
import type { ScheduledPost, TikTokPublishOptions } from "@/lib/types";

/**
 * Réponse de GET /api/connectors/tiktok/creator-info — exigée par les
 * guidelines TikTok (Required UX Implementation) pour construire le menu
 * déroulant de confidentialité et les cases Duet/Stitch/Commentaire SANS
 * valeur par défaut.
 */
interface TikTokCreatorInfoView {
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec?: number;
  creatorNickname?: string;
}

const TIKTOK_PRIVACY_LABEL: Record<string, [string, string]> = {
  PUBLIC_TO_EVERYONE: ["Tout le monde", "Everyone"],
  MUTUAL_FOLLOW_FRIENDS: ["Amis (abonnements mutuels)", "Friends (mutual follows)"],
  FOLLOWER_OF_CREATOR: ["Vos abonnés", "Your followers"],
  SELF_ONLY: ["Vous uniquement (privé)", "Only you (private)"],
};

/** Langues de diffusion proposées pour la rédaction du contenu par l'IA. */
const DIFFUSION_LANGUAGES = [
  "Français",
  "Kreol Morisien",
  "English",
  "Español",
  "Deutsch",
  "Italiano",
  "Português",
  "Nederlands",
  "العربية",
  "中文",
] as const;

const platformLabel = (p: string) =>
  p === "facebook" ? "Facebook" : p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : "LinkedIn";

/** Couleur de marque officielle par réseau (alignée sur les tokens Tailwind). */
const PLATFORM_DOT: Record<string, string> = {
  facebook: "#1877f2",
  instagram: "#e1306c",
  linkedin: "#0a66c2",
  tiktok: "#010101",
};

export default function ComposePage() {
  return (
    <Suspense fallback={null}>
      <ComposeContent />
    </Suspense>
  );
}

function ComposeContent() {
  const { company, data, access } = useCompany();
  const canEdit = access.canEdit;
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();

  const draftId = params.get("draft");
  const postId = params.get("post");
  const templateId = params.get("template");
  const duplicateId = params.get("duplicate");
  const draft = draftId ? findDraft(company.id, draftId) : undefined;
  const post = postId ? findPost(company.id, postId) : undefined;
  const template = templateId ? findTemplate(company.id, templateId) : undefined;
  const duplicate = duplicateId ? findHistoryItem(company.id, duplicateId) : undefined;
  // A draft being resumed, a scheduled post being edited, a template used,
  // or a published/failed history item being duplicated as a fresh post.
  const duplicateAsSource = duplicate
    ? { body: duplicate.fullBody ?? duplicate.body, platform: duplicate.platform }
    : undefined;
  const source = draft ?? post ?? template ?? duplicateAsSource;

  const [body, setBody] = useState(source?.body ?? "");
  // Textes ADAPTÉS par réseau (écrits par l'agent IA ou édités à la main).
  // `body` reste le texte commun (repli quand un réseau n'a pas de variante).
  const [bodies, setBodies] = useState<Partial<Record<ComposeNet, string>>>({});
  // TikTok : cible de préparation/programmation (publication auto à venir).
  const [tiktokOn, setTiktokOn] = useState(false);
  // TikTok — Required UX Implementation (guidelines Content Posting API) :
  // confidentialité SANS valeur par défaut, interactions décochées par défaut,
  // divulgation commerciale éteinte par défaut, consentement obligatoire.
  const [tiktokCreatorInfo, setTiktokCreatorInfo] = useState<TikTokCreatorInfoView | null>(null);
  const [tiktokCreatorInfoError, setTiktokCreatorInfoError] = useState<string | null>(null);
  const [tiktokCreatorInfoLoading, setTiktokCreatorInfoLoading] = useState(false);
  const [tiktokPrivacy, setTiktokPrivacy] = useState("");
  const [tiktokAllowDuet, setTiktokAllowDuet] = useState(false);
  const [tiktokAllowStitch, setTiktokAllowStitch] = useState(false);
  const [tiktokAllowComment, setTiktokAllowComment] = useState(false);
  const [tiktokDisclosureOn, setTiktokDisclosureOn] = useState(false);
  const [tiktokYourBrand, setTiktokYourBrand] = useState(false);
  const [tiktokBrandedContent, setTiktokBrandedContent] = useState(false);
  const [tiktokMusicConsent, setTiktokMusicConsent] = useState(false);
  // RAG opt-in pour l'agent : s'appuyer sur la mémoire stratégique de la marque.
  const [useMemory, setUseMemory] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => {
    if (source) {
      const acc = data.accounts.find((a) => a.platform === source.platform);
      return acc ? [acc.id] : data.accounts.filter((a) => a.platform !== "linkedin").map((a) => a.id);
    }
    return data.accounts.filter((a) => a.platform !== "linkedin").map((a) => a.id);
  });
  const scheduleSource = draft ?? post; // templates carry no schedule
  const [when, setWhen] = useState<"now" | "schedule">("schedule");
  const [date, setDate] = useState<Date>(
    new Date(`${scheduleSource?.date ?? "2026-05-27"}T00:00:00`)
  );
  const [time, setTime] = useState(scheduleSource?.time ?? "09:00");
  // Média pré-rempli depuis un studio (Avatar/Vidéo) ou la Médiathèque :
  //   /compose?media=<url>&kind=video   (ou ?video=<url> / ?image=<url>)
  const mediaParam = params.get("media") || params.get("video") || params.get("image");
  const mediaKind: "image" | "video" =
    params.get("video") ? "video"
    : params.get("image") ? "image"
    : params.get("kind") === "video" ? "video"
    : /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaParam ?? "") ? "video"
    : "image";
  const [upload, setUpload] = useState<UploadedMedia | null>(
    mediaParam && /^https?:\/\//i.test(mediaParam)
      ? { url: mediaParam, name: mediaKind === "video" ? "Vidéo" : "Image", size: 0, kind: mediaKind }
      : null
  );
  // Emplacement Meta du média : fil (défaut), Story éphémère 24 h ou Reel.
  const [postType, setPostType] = useState<"feed" | "story" | "reel">("feed");
  // Un Reel exige une vidéo : changer de média pour une image annule le choix.
  useEffect(() => {
    if (postType === "reel" && upload?.kind !== "video") setPostType("feed");
    if (postType !== "feed" && !upload) setPostType("feed");
  }, [upload, postType]);
  // Édition d'une publication programmée RÉELLE (« Edit in compose »).
  // `findPost` ne lit que le magasin local de démonstration : pour une
  // publication venue de la base, il renvoyait toujours undefined et le
  // formulaire s'ouvrait entièrement vide. On va donc la chercher côté API.
  const [prefilling, setPrefilling] = useState(Boolean(postId) && !post);
  useEffect(() => {
    if (!postId || post) return;
    let alive = true;
    setPrefilling(true);
    fetch(`/api/scheduled-posts?companyId=${encodeURIComponent(company.id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const rows: ScheduledPost[] = Array.isArray(d?.posts) ? d.posts : Array.isArray(d) ? d : [];
        const found = rows.find((p) => p.id === postId);
        if (!found) return;
        setBody(found.body ?? found.title ?? "");
        const acc = data.accounts.find((a) => a.platform === found.platform);
        if (acc) setSelected([acc.id]);
        if (found.date) {
          setDate(new Date(`${found.date}T00:00:00`));
          setWhen("schedule");
        }
        if (found.time) setTime(found.time);
        if (found.media?.url) {
          setUpload({
            url: found.media.url,
            name: found.media.kind === "video" ? "Vidéo" : "Image",
            size: 0,
            kind: found.media.kind ?? "image",
          });
          if (found.media.postType) setPostType(found.media.postType);
        }
      })
      .catch(() => {
        /* dégradation : formulaire vierge plutôt qu'un écran bloqué */
      })
      .finally(() => {
        if (alive) setPrefilling(false);
      });
    return () => {
      alive = false;
    };
    // `data.accounts` est stable pour une société donnée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, post, company.id]);

  const [editing, setEditing] = useState(false);
  const [language, setLanguage] = useState("Français");
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL_ID);
  const [videoModel, setVideoModel] = useState(DEFAULT_VIDEO_MODEL_ID);
  const [brandHints, setBrandHints] = useState("");
  const [previewPlatform, setPreviewPlatform] = useState<PreviewPlatform>("facebook");
  const [submitting, setSubmitting] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // #20 : ancre de la zone média — cible du défilement doux quand l'agent
  // vient de générer un visuel (attaché tout en bas de la page).
  const mediaRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const count = selected.length + (tiktokOn ? 1 : 0);
  const noneSelected = count === 0;

  const selectedPlatforms = useMemo(
    () => [
      ...data.accounts
        .filter((a) => selected.includes(a.id))
        .map((a) => a.platform),
      ...(tiktokOn ? (["tiktok"] as const) : []),
    ],
    [data.accounts, selected, tiktokOn]
  );

  // ── TikTok — Required UX Implementation ───────────────────────────────────
  const tiktokSelected = selectedPlatforms.includes("tiktok");

  // Charge les infos créateur (options de confidentialité + interactions
  // verrouillées) dès que TikTok est ciblé — une fois par session de compose.
  useEffect(() => {
    if (!tiktokSelected || tiktokCreatorInfo || tiktokCreatorInfoLoading) return;
    setTiktokCreatorInfoLoading(true);
    setTiktokCreatorInfoError(null);
    fetch(`/api/connectors/tiktok/creator-info?companyId=${encodeURIComponent(company.id)}`)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
        setTiktokCreatorInfo(d as TikTokCreatorInfoView);
      })
      .catch((e) => setTiktokCreatorInfoError(e instanceof Error ? e.message : t("Erreur inconnue", "Unknown error")))
      .finally(() => setTiktokCreatorInfoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiktokSelected, company.id]);

  const tiktokBrandedContentDisabled = tiktokPrivacy === "" || tiktokPrivacy === "SELF_ONLY";
  // Prête à publier : confidentialité choisie, consentement coché, et — si le
  // toggle de divulgation commerciale est allumé — au moins une case cochée
  // (sinon le bouton Publier doit rester désactivé, cf. guidelines TikTok).
  const tiktokReady =
    !tiktokSelected ||
    (tiktokPrivacy !== "" &&
      tiktokMusicConsent &&
      (!tiktokDisclosureOn || tiktokYourBrand || tiktokBrandedContent));
  const tiktokConsentText =
    tiktokDisclosureOn && tiktokBrandedContent
      ? t(
          "En publiant, vous acceptez la Branded Content Policy et la Music Usage Confirmation de TikTok.",
          "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
        )
      : t(
          "En publiant, vous acceptez la Music Usage Confirmation de TikTok.",
          "By posting, you agree to TikTok's Music Usage Confirmation."
        );
  const tiktokDisclosureLabel = tiktokBrandedContent
    ? t("Votre photo/vidéo sera étiquetée « Partenariat rémunéré ».", "Your photo/video will be labeled as 'Paid partnership'.")
    : tiktokYourBrand
    ? t("Votre photo/vidéo sera étiquetée « Contenu promotionnel ».", "Your photo/video will be labeled as 'Promotional content'.")
    : null;
  const tiktokOptions: TikTokPublishOptions = {
    privacyLevel: tiktokPrivacy,
    allowDuet: tiktokAllowDuet,
    allowStitch: tiktokAllowStitch,
    allowComment: tiktokAllowComment,
    disclosure: !tiktokDisclosureOn
      ? "none"
      : tiktokYourBrand && tiktokBrandedContent
      ? "both"
      : tiktokBrandedContent
      ? "branded_content"
      : "your_brand",
    musicConsent: tiktokMusicConsent,
  };

  // Keep the preview platform in sync with what's actually selected.
  const previewAccounts = data.accounts.filter((a) => selected.includes(a.id));
  const effectivePreview: PreviewPlatform =
    previewAccounts.some((a) => a.platform === previewPlatform)
      ? previewPlatform
      : previewAccounts[0]?.platform ?? "facebook";

  // Réseaux distincts réellement ciblés (onglets d'aperçu et bascule).
  // On ne propose en aperçu que ce qui est sélectionné, dans l'ordre canonique.
  const previewPlatforms = useMemo(() => {
    const order: PreviewPlatform[] = ["facebook", "instagram", "tiktok", "linkedin"];
    const present = new Set<string>(previewAccounts.map((a) => a.platform));
    if (tiktokOn) present.add("tiktok");
    const list = order.filter((p) => present.has(p));
    return list.length ? list : (["facebook"] as PreviewPlatform[]);
  }, [previewAccounts]);

  // Nom de la Page sélectionnée pour le réseau actuellement prévisualisé.
  // Si plusieurs Pages d'un même réseau sont cochées, on les liste toutes.
  const previewAccountNames = previewAccounts
    .filter((a) => a.platform === effectivePreview)
    .map((a) => a.accountName);
  const previewBrandName = previewAccountNames[0] ?? company.name;

  // Réseau actif transmis aux panneaux IA (texte ton + ratio image).
  const activePlatform: "facebook" | "instagram" | "linkedin" =
    selectedPlatforms.includes("instagram")
      ? "instagram"
      : selectedPlatforms.includes("linkedin")
      ? "linkedin"
      : "facebook";

  const title = body.slice(0, 48) + (body.length > 48 ? "…" : "");

  // Crée un post par plateforme sélectionnée via l'API.
  // `now` planifie à l'instant courant (la publication réelle n'est pas branchée),
  // `schedule` à la date/heure choisie, `draft` enregistre un brouillon.
  // Crée les publications et renvoie les identifiants créés (par réseau).
  // - draft  → enregistré (statut "draft", non publié).
  // - schedule → statut "scheduled" : publié AUTOMATIQUEMENT par le cron à l'heure.
  // - now    → statut "scheduled" daté maintenant, PUIS publié immédiatement
  //            (voir handleSubmit) au lieu d'attendre le prochain passage du cron.
  const createPosts = async (mode: "now" | "schedule" | "draft"): Promise<{ ok: boolean; ids: string[] }> => {
    const status = mode === "draft" ? "draft" : "scheduled";
    const now = new Date();
    const postDate = mode === "now" ? format(now, "yyyy-MM-dd") : format(date, "yyyy-MM-dd");
    const postTime = mode === "now" ? format(now, "HH:mm") : time;

    const created = await Promise.all(
      selectedPlatforms.map(async (platform) => {
        // Texte ADAPTÉ au réseau si l'agent/l'utilisateur en a produit un.
        const netBody = (bodies[platform as ComposeNet] ?? "").trim() || body;
        const res = await fetch("/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: company.id,
            platform,
            title: (netBody.slice(0, 48) + (netBody.length > 48 ? "…" : "")) || t("(Sans titre)", "(Untitled)"),
            body: netBody,
            date: postDate,
            time: postTime,
            status,
            source: "manual",
            // Média attaché (URL incluse) → indispensable pour publier sur
            // Instagram, et utilisé aussi pour Facebook/LinkedIn. Pour TikTok,
            // porte aussi les réglages de confidentialité/interactions/
            // divulgation choisis dans le panneau ci-dessous (Required UX
            // Implementation des guidelines TikTok).
            media: upload
              ? {
                  kind: upload.kind,
                  url: upload.url,
                  // Emplacement Meta (fil / Story / Reel) — ignoré ailleurs.
                  ...(platform === "facebook" || platform === "instagram" ? { postType } : {}),
                  ...(platform === "tiktok" ? { tiktok: tiktokOptions } : {}),
                }
              : undefined,
          }),
        });
        if (!res.ok) return null;
        const d = (await res.json().catch(() => ({}))) as { id?: string };
        return d.id ?? null;
      })
    );
    const ids = created.filter((id): id is string => Boolean(id));
    return { ok: created.every(Boolean), ids };
  };

  const handleSubmit = async () => {
    if (noneSelected || submitting || !tiktokReady) return;
    setSubmitting(true);
    try {
      const { ok, ids } = await createPosts(when);
      if (!ok) {
        setToast(t("Échec de l'enregistrement. Réessayez.", "Save failed. Please retry."));
        return;
      }
      // « Publier maintenant » : déclenche la publication réelle tout de suite
      // (sinon le post attendrait le prochain passage du cron, jusqu'à 10 min).
      if (when === "now") {
        const pubs = await Promise.all(
          ids.map((id) =>
            fetch(`/api/scheduled-posts/${id}/publish`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ companyId: company.id }),
            })
              .then((r) => r.json().catch(() => ({ ok: false })))
              .catch(() => ({ ok: false as const }))
          )
        );
        const failed = pubs.filter((p) => p && (p as { error?: string }).error).length;
        if (failed > 0) {
          setToast(t(
            `${failed} publication(s) ont échoué — voir Programmés pour le détail.`,
            `${failed} post(s) failed to publish — see Scheduled for details.`
          ));
        }
      }
      router.push("/scheduled");
    } catch {
      setToast(t("Échec de l'enregistrement. Réessayez.", "Save failed. Please retry."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (noneSelected || submitting) return;
    setSubmitting(true);
    try {
      const { ok } = await createPosts("draft");
      if (ok) {
        router.push("/scheduled?tab=drafts");
      } else {
        setToast(t("Échec de l'enregistrement du brouillon.", "Failed to save draft."));
      }
    } catch {
      setToast(t("Échec de l'enregistrement du brouillon.", "Failed to save draft."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (savingLibrary) return;
    if (!body.trim()) {
      setToast(t("Ajoutez du contenu avant d'enregistrer.", "Add content before saving."));
      return;
    }
    setSavingLibrary(true);
    try {
      const platform = selectedPlatforms[0] ?? "instagram";
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          platform,
          body,
          tags: ["studio"],
        }),
      });
      setToast(
        res.ok
          ? t("Enregistré dans la bibliothèque.", "Saved to library.")
          : t("Échec de l'enregistrement.", "Save failed.")
      );
    } catch {
      setToast(t("Échec de l'enregistrement.", "Save failed."));
    } finally {
      setSavingLibrary(false);
    }
  };

  // Libellé honnête : la publication réelle n'est pas branchée, donc « Maintenant »
  // met en file plutôt que de prétendre publier immédiatement.
  const verb = when === "now" ? t("Mettre en file", "Queue") : t("Planifier", "Schedule");
  const noun = count === 1 ? t("publication", "post") : t("publications", "posts");

  const modeLabel = draft
    ? t("Modifier le brouillon", "Edit draft")
    : post
    ? t("Modifier la publication", "Edit post")
    : template
    ? t("Nouvelle publication depuis un modèle", "New post from template")
    : duplicate
    ? t("Nouvelle publication (dupliquée)", "New post (duplicated)")
    : t("Nouvelle publication", "New post");

  const modeSub = draft
    ? t("Reprise d'un brouillon sauvegardé", "Resuming a saved draft")
    : post
    ? t("Modification d'une publication planifiée", "Editing a scheduled post")
    : template
    ? t("Utilisation d'un modèle de bibliothèque", "Using a library template")
    : duplicate
    ? t("Dupliquée depuis l'historique", "Duplicated from history")
    : t("Composez et planifiez une nouvelle publication", "Compose and schedule a new post");

  return (
    <div className="animate-fade-in">
      {/* Récupération de la publication en cours d'édition : évite de croire à
          un formulaire vide pendant le chargement. */}
      {prefilling && (
        <p className="mb-4 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
          {t("Chargement de la publication programmée…", "Loading the scheduled post…")}
        </p>
      )}
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 max-w-full break-words text-lg font-bold tracking-tight text-ink">{modeLabel}</h1>
            <span
              aria-hidden="true"
              className="hidden h-4 w-px shrink-0 rounded-full bg-hair sm:block"
            />
            {/* #15 : initiales de la société active — infobulle explicative au survol. */}
            <span
              title={t(`Société active : ${company.name}`, `Active company: ${company.name}`)}
              className="inline-flex shrink-0 cursor-help items-center gap-1.5 rounded-full border border-hair bg-canvas px-2.5 py-0.5 text-2xs text-muted shadow-xs"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary-400" />
              <span className="font-semibold text-ink">{company.code}</span>
            </span>
          </div>
          <p className="mt-0.5 w-full text-2xs text-muted">{modeSub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* #16 : le brouillon est enregistré PAR réseau (contrairement à la
              bibliothèque, indépendante des réseaux) — d'où sa condition
              supplémentaire. Le span porte l'infobulle car un bouton désactivé
              (pointer-events-none) n'affiche pas son title. */}
          <span
            title={
              !canEdit
                ? t("Lecture seule", "View only")
                : noneSelected
                ? t(
                    "Sélectionnez au moins un réseau : le brouillon est enregistré pour chaque réseau choisi.",
                    "Select at least one network: the draft is saved for each selected network."
                  )
                : undefined
            }
          >
            <Button variant="secondary" onClick={handleSaveDraft} disabled={noneSelected || submitting || !canEdit}>
              {t("Enregistrer comme brouillon", "Save as draft")}
            </Button>
          </span>
          <span title={!canEdit ? t("Lecture seule", "View only") : undefined}>
            <Button variant="secondary" onClick={handleSaveToLibrary} disabled={savingLibrary || !canEdit}>
              {savingLibrary
                ? t("Enregistrement…", "Saving…")
                : t("Enregistrer dans la bibliothèque", "Save to library")}
            </Button>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Editor card */}
        <div className="card space-y-7 p-6">
          {/* Platform selector — cible de publication explicite */}
          <div>
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <div className="section-label">{t("Où publier ?", "Where to publish?")}</div>
              <span className="text-2xs text-muted">
                {noneSelected
                  ? t("Aucun compte sélectionné", "No account selected")
                  : count === 1
                  ? t("1 compte sélectionné", "1 account selected")
                  : t(`${count} comptes sélectionnés`, `${count} accounts selected`)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.accounts.filter((a) => a.platform !== "linkedin").map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    aria-pressed={on}
                    title={a.accountName}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      on
                        ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
                        : "border border-hair bg-card text-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PLATFORM_DOT[a.platform] ?? "currentColor" }}
                    />
                    <span className="font-semibold">{platformLabel(a.platform)}</span>
                    <span className="max-w-[10rem] truncate text-2xs opacity-80">{a.accountName}</span>
                  </button>
                );
              })}
              {/* TikTok non encore connecté : place-holder pour préparer le
                  contenu avant de connecter le compte (cf. /accounts). Une
                  fois TikTok connecté, le vrai compte apparaît déjà dans la
                  boucle ci-dessus (data.accounts) — cacher ce doublon évite
                  deux chips "TikTok" et le risque de publier deux fois. */}
              {!data.accounts.some((a) => a.platform === "tiktok") && (
                <button
                  onClick={() => setTiktokOn((v) => !v)}
                  aria-pressed={tiktokOn}
                  title={t(
                    "TikTok n'est pas encore connecté — préparez le contenu ici, connectez le compte dans Comptes & connexions pour publier.",
                    "TikTok isn't connected yet — prepare content here, connect the account in Accounts & connections to publish."
                  )}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    tiktokOn
                      ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
                      : "border border-hair bg-card text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PLATFORM_DOT.tiktok }} />
                  <span className="font-semibold">TikTok</span>
                </button>
              )}
            </div>
            <p className="mt-2 text-2xs text-muted">
              {t("LinkedIn a son espace dédié →", "LinkedIn has its dedicated space →")}{" "}
              <a href="/linkedin" className="font-medium text-page hover:underline">{t("Espace LinkedIn", "LinkedIn space")}</a>
            </p>
            {noneSelected && !tiktokOn && (
              <p className="mt-2 text-2xs text-danger-600">
                {t("Sélectionnez au moins un réseau pour publier.", "Select at least one network to publish.")}
              </p>
            )}
          </div>

          {/* Post content */}
          <div>
            <div className="section-label mb-2.5">{t("Contenu de la publication", "Post content")}</div>
            <Tabs
              tabs={[
                { id: "all", label: t("✦ Commun", "✦ Common"), content: <ContentBox value={body} onChange={setBody} /> },
                ...(["facebook", "instagram", "tiktok"] as ComposeNet[])
                  .filter((n) => selectedPlatforms.includes(n))
                  .map((n) => ({
                    id: n,
                    label: `${platformLabel(n)}${(bodies[n] ?? "").trim() ? " ●" : ""}`,
                    content: (
                      <ContentBox
                        value={bodies[n] ?? ""}
                        onChange={(v: string) => setBodies((prev) => ({ ...prev, [n]: v }))}
                        placeholder={t(`Texte spécifique ${platformLabel(n)} (sinon le texte commun est utilisé)…`, `Network-specific text for ${platformLabel(n)} (falls back to the common text)…`)}
                      />
                    ),
                  })),
              ]}
            />
            <p className="mt-1.5 text-2xs text-muted">
              {t("✦ L'agent IA ci-dessous remplit automatiquement un texte adapté à chaque réseau ; vous pouvez tout retoucher.", "✦ The AI agent below automatically fills a tailored text per network; you can edit everything.")}
            </p>
          </div>

          {/* Langue de diffusion — langue dans laquelle l'IA rédige le contenu */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-hair bg-canvas/60 px-3 py-2">
            <label htmlFor="diffusion-lang" className="text-xs font-medium text-ink">
              🌐 {t("Langue de diffusion", "Publishing language")}
            </label>
            <select
              id="diffusion-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input text-sm"
            >
              {DIFFUSION_LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Modèles de génération IA (collections Replicate) */}
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-hair bg-canvas/60 px-3 py-2 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-ink">🖼️ {t("Modèle image", "Image model")}</span>
              <select value={imageModel} onChange={(e) => setImageModel(e.target.value)} className="input text-2xs" title={t("Modèle de génération d'image", "Image generation model")}>
                {IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-ink">🎬 {t("Modèle vidéo", "Video model")}</span>
              <select value={videoModel} onChange={(e) => setVideoModel(e.target.value)} className="input text-2xs" title={t("Modèle de génération vidéo", "Video generation model")}>
                {VIDEO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>
                ))}
              </select>
            </label>
          </div>

          {/* ── L'AGENT DE PUBLICATION — le cœur de Compose ── */}
          <ComposeAgent
            networks={(["facebook", "instagram", "tiktok"] as ComposeNet[]).filter((n) => selectedPlatforms.includes(n))}
            useMemory={useMemory}
            hasMedia={Boolean(upload)}
            currentTexts={bodies}
            onTexts={(texts) => {
              setBodies((prev) => ({ ...prev, ...texts }));
              // Le texte commun reprend la 1re variante (utile pour l'aperçu).
              const first = texts.facebook ?? texts.instagram ?? texts.tiktok;
              if (first) setBody(first);
            }}
            onMedia={(m) => {
              setUpload({ url: m.url, name: m.kind === "video" ? "ai-video" : "ai-visual", size: 0, kind: m.kind });
              // #20 : le visuel s'affiche plus bas — on y défile en douceur.
              setTimeout(() => mediaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
            }}
          />
          <label className="-mt-3 flex items-center gap-2 px-1 text-2xs text-muted">
            <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} className="h-3.5 w-3.5 accent-page" />
            {t("S'appuyer sur la mémoire de marque (RAG) — veille, ADN, analyses", "Use brand memory (RAG) — watch, DNA, analyses")}
          </label>

          {/* Brand kit persistant — logo / charte / palette réutilisés partout */}
          <BrandKitPanel companyId={company.id} brandName={company.name} onPromptHints={setBrandHints} />

          {/* Inspiration depuis une créa existante (vos pubs / concurrents / veille) */}
          <CreativeInspiration
            companyId={company.id}
            brandVoice={company.code}
            platform={activePlatform}
            language={language}
            imageModel={imageModel}
            videoModel={videoModel}
            onApplyText={setBody}
            onApplyMedia={setUpload}
          />

          {/* Agent IA — rédige/planifie depuis la page Compose */}
          <AgentLauncher context={t("page Compose", "Compose page")} defaultObjective={t("Rédiger une série de posts pour les réseaux", "Draft a series of posts for the networks")} />
          {/* AI panels — réseau dérivé du 1er compte sélectionné (respecte le réseau). */}
          <AiTextPanel brandVoiceLabel={company.code} platform={activePlatform} language={language} />
          <AiVisualsPanel
            used={data.library.aiBudgetUsed}
            cap={data.library.aiBudgetCap}
            platform={activePlatform}
            imageModel={imageModel}
            videoModel={videoModel}
            brandHints={brandHints}
            companyId={company.id}
            onUse={(m) => setUpload({ url: m.url, name: m.kind === "video" ? "ai-video" : "ai-visual", size: 0, kind: m.kind })}
          />

          {/* Media upload — ancre du défilement doux après génération (#20) */}
          <div ref={mediaRef}>
            <MediaUpload media={upload} onChange={setUpload} companyId={company.id} />
          </div>
          {upload && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary -mt-1 text-xs"
            >
              🎬 {t("Éditer (texte / musique)", "Edit (text / music)")}
            </button>
          )}
          {editing && upload && (
            <MediaEditor media={upload} onExport={setUpload} onClose={() => setEditing(false)} />
          )}

          {/* Emplacement Meta — fil, Story 24 h ou Reel. Trois endpoints Graph
              distincts : sans ce choix, tout partait forcément dans le fil. */}
          {upload && (selectedPlatforms.includes("facebook") || selectedPlatforms.includes("instagram")) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-muted">{t("Emplacement (Facebook / Instagram) :", "Placement (Facebook / Instagram):")}</span>
              {([
                { id: "feed", fr: "Publication", en: "Post" },
                { id: "story", fr: "Story (24 h)", en: "Story (24h)" },
                ...(upload.kind === "video" ? [{ id: "reel", fr: "Reel", en: "Reel" }] : []),
              ] as { id: "feed" | "story" | "reel"; fr: string; en: string }[]).map((p) => (
                <button key={p.id} type="button" onClick={() => setPostType(p.id)}
                  className={`rounded-full px-2.5 py-1 text-2xs font-medium transition-colors ${postType === p.id ? "bg-ink text-white" : "bg-card text-muted ring-1 ring-hair hover:text-ink"}`}>
                  {t(p.fr, p.en)}
                </button>
              ))}
            </div>
          )}

          {/* When to publish */}
          <WhenToPublish
            when={when}
            onWhenChange={setWhen}
            date={date}
            onDateChange={setDate}
            time={time}
            onTimeChange={setTime}
          />

          {/* Réglages TikTok — Required UX Implementation (guidelines Content
              Posting API) : confidentialité, interactions, divulgation
              commerciale, consentement. Visible UNIQUEMENT quand TikTok est
              ciblé — n'affecte aucun autre réseau. */}
          {tiktokSelected && (
            <div className="space-y-3 rounded-xl border border-hair bg-canvas/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="section-label">{t("Réglages TikTok", "TikTok settings")}</div>
                {tiktokCreatorInfo?.creatorNickname && (
                  <span className="text-2xs text-muted">@{tiktokCreatorInfo.creatorNickname}</span>
                )}
              </div>

              {tiktokCreatorInfoLoading && (
                <p className="text-2xs text-muted">{t("Chargement des réglages du compte…", "Loading account settings…")}</p>
              )}
              {tiktokCreatorInfoError && (
                <p className="text-2xs text-danger-600">
                  {t("Impossible de charger les réglages TikTok :", "Unable to load TikTok settings:")} {tiktokCreatorInfoError}
                </p>
              )}

              {tiktokCreatorInfo && (
                <>
                  {/* Confidentialité — obligatoire, AUCUNE valeur par défaut */}
                  <label className="block text-xs font-medium text-ink">
                    {t("Confidentialité", "Privacy")}
                    <select
                      value={tiktokPrivacy}
                      onChange={(e) => setTiktokPrivacy(e.target.value)}
                      className="input mt-1 text-sm"
                    >
                      <option value="" disabled>
                        {t("Choisissez qui peut voir cette publication", "Select who can view this post")}
                      </option>
                      {tiktokCreatorInfo.privacyLevelOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {t(...(TIKTOK_PRIVACY_LABEL[opt] ?? [opt, opt]))}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Interactions — décochées par défaut, grisées si verrouillées par le créateur.
                      Duo/Stitch ne s'appliquent pas aux photos (guidelines TikTok) — masqués
                      pour un média image, seul « Commentaires » reste affiché. */}
                  <div>
                    <div className="mb-1 text-xs font-medium text-ink">{t("Interactions autorisées", "Allowed interactions")}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {upload?.kind !== "image" && (
                        <>
                          <label
                            className={`flex items-center gap-1.5 text-xs ${tiktokCreatorInfo.duetDisabled ? "text-muted" : "text-ink"}`}
                            title={tiktokCreatorInfo.duetDisabled ? t("Désactivé dans les réglages TikTok de ce compte.", "Disabled in this account's TikTok settings.") : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={tiktokAllowDuet && !tiktokCreatorInfo.duetDisabled}
                              disabled={tiktokCreatorInfo.duetDisabled}
                              onChange={(e) => setTiktokAllowDuet(e.target.checked)}
                              className="h-3.5 w-3.5 accent-page"
                            />
                            {t("Duos", "Duet")}
                          </label>
                          <label
                            className={`flex items-center gap-1.5 text-xs ${tiktokCreatorInfo.stitchDisabled ? "text-muted" : "text-ink"}`}
                            title={tiktokCreatorInfo.stitchDisabled ? t("Désactivé dans les réglages TikTok de ce compte.", "Disabled in this account's TikTok settings.") : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={tiktokAllowStitch && !tiktokCreatorInfo.stitchDisabled}
                              disabled={tiktokCreatorInfo.stitchDisabled}
                              onChange={(e) => setTiktokAllowStitch(e.target.checked)}
                              className="h-3.5 w-3.5 accent-page"
                            />
                            {t("Stitch", "Stitch")}
                          </label>
                        </>
                      )}
                      <label
                        className={`flex items-center gap-1.5 text-xs ${tiktokCreatorInfo.commentDisabled ? "text-muted" : "text-ink"}`}
                        title={tiktokCreatorInfo.commentDisabled ? t("Désactivé dans les réglages TikTok de ce compte.", "Disabled in this account's TikTok settings.") : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={tiktokAllowComment && !tiktokCreatorInfo.commentDisabled}
                          disabled={tiktokCreatorInfo.commentDisabled}
                          onChange={(e) => setTiktokAllowComment(e.target.checked)}
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
                        checked={tiktokDisclosureOn}
                        onChange={(e) => {
                          setTiktokDisclosureOn(e.target.checked);
                          if (!e.target.checked) {
                            setTiktokYourBrand(false);
                            setTiktokBrandedContent(false);
                          }
                        }}
                        className="h-3.5 w-3.5 accent-page"
                      />
                      {t("Ce contenu fait la promotion de vous-même, d'une marque ou d'un service", "This content promotes yourself, a brand or a service")}
                    </label>
                    {tiktokDisclosureOn && (
                      <div className="mt-1.5 ml-5 space-y-1">
                        <label className="flex items-center gap-1.5 text-xs text-ink">
                          <input
                            type="checkbox"
                            checked={tiktokYourBrand}
                            onChange={(e) => setTiktokYourBrand(e.target.checked)}
                            className="h-3.5 w-3.5 accent-page"
                          />
                          {t("Votre marque", "Your Brand")}
                        </label>
                        <label
                          className={`flex items-center gap-1.5 text-xs ${tiktokBrandedContentDisabled ? "text-muted" : "text-ink"}`}
                          title={
                            tiktokBrandedContentDisabled
                              ? t("Branded content visibility cannot be set to private.", "Branded content visibility cannot be set to private.")
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            checked={tiktokBrandedContent && !tiktokBrandedContentDisabled}
                            disabled={tiktokBrandedContentDisabled}
                            onChange={(e) => setTiktokBrandedContent(e.target.checked)}
                            className="h-3.5 w-3.5 accent-page"
                          />
                          {t("Contenu de marque", "Branded Content")}
                        </label>
                        {tiktokDisclosureLabel && <p className="text-2xs text-muted">{tiktokDisclosureLabel}</p>}
                        {tiktokDisclosureOn && !tiktokYourBrand && !tiktokBrandedContent && (
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
                      checked={tiktokMusicConsent}
                      onChange={(e) => setTiktokMusicConsent(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-page"
                    />
                    <span>{tiktokConsentText}</span>
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
          )}

          {/* Footer actions — pas de conteneur bordé : le contour dessinait un
              rectangle vide au-dessus/autour des boutons (#24). */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => router.push("/scheduled")}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={noneSelected || submitting || !canEdit || !tiktokReady}
              title={
                !canEdit
                  ? t("Lecture seule", "View only")
                  : noneSelected
                  ? t("Sélectionnez au moins une plateforme", "Select at least one platform")
                  : !tiktokReady
                  ? t(
                      "Complétez les réglages TikTok (confidentialité, consentement) avant de publier.",
                      "Complete the TikTok settings (privacy, consent) before publishing."
                    )
                  : undefined
              }
            >
              {submitting && (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
              )}
              {submitting
                ? t("Enregistrement…", "Saving…")
                : `${verb} ${count} ${noun}`}
            </Button>
          </div>
        </div>

        {/* Preview panel — aperçu fidèle par réseau, en temps réel */}
        <div className="panel p-4 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="section-label">{t("Aperçu", "Preview")}</div>
            <span className="text-2xs text-muted">{platformLabel(effectivePreview)}</span>
          </div>
          <div className="mb-3 inline-flex w-full gap-1 rounded-lg bg-canvas p-1">
            {previewPlatforms.map((p) => (
              <button
                key={p}
                onClick={() => setPreviewPlatform(p)}
                aria-pressed={effectivePreview === p}
                className={`flex-1 rounded-md px-2.5 py-1.5 text-2xs font-medium transition-all ${
                  effectivePreview === p
                    ? "bg-card text-ink shadow-xs ring-1 ring-hair"
                    : "text-muted hover:text-ink"
                }`}
              >
                {platformLabel(p)}
              </button>
            ))}
          </div>

          {/* Cible affichée : nom de la/les Page(s) du réseau prévisualisé. */}
          {previewAccountNames.length > 0 && (
            <p className="mb-2.5 truncate text-2xs text-muted">
              {t("Publie sur", "Publishing to")}{" "}
              <span className="font-semibold text-ink">{previewAccountNames.join(", ")}</span>
            </p>
          )}

          <PostPreview
            platform={effectivePreview}
            brandName={previewBrandName}
            brandAccent={company.accent}
            text={body}
            imageUrl={upload?.url}
            imageKind={upload?.kind === "video" ? "video" : "image"}
          />
        </div>
      </div>

      {/* Retours d'enregistrement — toast flottant, affiché UNIQUEMENT quand il
          y a un message (jamais de conteneur vide dans la page) (#24). */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function ContentBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const t = useT();
  // #18 : tant que la zone est vide, on explique que l'IA la remplira
  // (placeholder explicite) et on lui donne un habillage « univers IA »
  // (tuile primaire pleine + étiquette ✦ IA — pas de variante d'opacité,
  // pour rester lisible dans les deux thèmes).
  const empty = value.trim() === "";
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          placeholder ??
          t(
            "✦ L'IA remplira ce texte automatiquement quand vous lancerez l'agent ci-dessous — vous pourrez tout retoucher.",
            "✦ The AI will fill this text automatically when you run the agent below — you can edit everything."
          )
        }
        className={`input h-28 resize-none ${empty ? "border-primary-200 bg-primary-50" : ""}`}
      />
      {empty && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-2 rounded-full bg-primary-100 px-2 py-0.5 text-2xs font-semibold text-primary-600"
        >
          ✦ IA
        </span>
      )}
    </div>
  );
}
