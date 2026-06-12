"use client";

import { Suspense, useMemo, useState } from "react";
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
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { Toast } from "@/components/ui/Toast";
import { findDraft, findPost } from "@/lib/draft-store";
import { findTemplate } from "@/lib/template-store";
import { findHistoryItem } from "@/lib/history-store";

const PLACEHOLDER =
  "Rédigez le contenu de votre publication ici…";

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
  const [editing, setEditing] = useState(false);
  const [language, setLanguage] = useState("Français");
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL_ID);
  const [videoModel, setVideoModel] = useState(DEFAULT_VIDEO_MODEL_ID);
  const [brandHints, setBrandHints] = useState("");
  const [previewPlatform, setPreviewPlatform] = useState<PreviewPlatform>("facebook");
  const [submitting, setSubmitting] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
  const createPosts = async (mode: "now" | "schedule" | "draft"): Promise<boolean> => {
    const status = mode === "draft" ? "draft" : "scheduled";
    const now = new Date();
    const postDate = mode === "now" ? format(now, "yyyy-MM-dd") : format(date, "yyyy-MM-dd");
    const postTime = mode === "now" ? format(now, "HH:mm") : time;

    const results = await Promise.all(
      selectedPlatforms.map((platform) => {
        // Texte ADAPTÉ au réseau si l'agent/l'utilisateur en a produit un.
        const netBody = (bodies[platform as ComposeNet] ?? "").trim() || body;
        return fetch("/api/scheduled-posts", {
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
            // Instagram, et utilisé aussi pour Facebook/LinkedIn.
            media: upload ? { kind: upload.kind, url: upload.url } : undefined,
          }),
        });
      })
    );
    return results.every((res) => res.ok);
  };

  const handleSubmit = async () => {
    if (noneSelected || submitting) return;
    setSubmitting(true);
    try {
      const ok = await createPosts(when);
      if (ok) {
        router.push("/scheduled");
      } else {
        setToast(t("Échec de l'enregistrement. Réessayez.", "Save failed. Please retry."));
      }
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
      const ok = await createPosts("draft");
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
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 max-w-full break-words text-lg font-bold tracking-tight text-ink">{modeLabel}</h1>
            <span
              aria-hidden="true"
              className="hidden h-4 w-px shrink-0 rounded-full bg-hair sm:block"
            />
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hair bg-canvas px-2.5 py-0.5 text-2xs text-muted shadow-xs">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary-400" />
              <span className="font-semibold text-ink">{company.code}</span>
            </span>
          </div>
          <p className="mt-0.5 w-full text-2xs text-muted">{modeSub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleSaveDraft} disabled={noneSelected || submitting || !canEdit}>
            {t("Enregistrer comme brouillon", "Save as draft")}
          </Button>
          <Button variant="secondary" onClick={handleSaveToLibrary} disabled={savingLibrary || !canEdit}>
            {savingLibrary
              ? t("Enregistrement…", "Saving…")
              : t("Enregistrer dans la bibliothèque", "Save to library")}
          </Button>
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
              {/* TikTok : préparation + programmation (publication auto à venir) */}
              <button
                onClick={() => setTiktokOn((v) => !v)}
                aria-pressed={tiktokOn}
                title={t("TikTok — contenu préparé et programmé ici ; publication depuis l'app TikTok", "TikTok — content prepared & scheduled here; publish from the TikTok app")}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  tiktokOn
                    ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
                    : "border border-hair bg-card text-muted hover:bg-canvas hover:text-ink"
                }`}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PLATFORM_DOT.tiktok }} />
                <span className="font-semibold">TikTok</span>
              </button>
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
              {t("L'agent IA remplit automatiquement un texte adapté à chaque réseau ; vous pouvez tout retoucher.", "The AI agent fills a tailored text per network; you can edit everything.")}
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
            onMedia={(m) => setUpload({ url: m.url, name: m.kind === "video" ? "ai-video" : "ai-visual", size: 0, kind: m.kind })}
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

          {/* Media upload */}
          <MediaUpload media={upload} onChange={setUpload} companyId={company.id} />
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

          {/* When to publish */}
          <div>
            <div className="section-label mb-2.5">{t("Quand publier", "When to publish")}</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setWhen("now")}
                className={`rounded-lg py-2.5 text-sm font-medium transition-all ${
                  when === "now"
                    ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
                    : "border border-hair bg-card text-ink hover:bg-canvas"
                }`}
              >
                {t("Maintenant", "Now")}
              </button>
              <button
                onClick={() => setWhen("schedule")}
                className={`rounded-lg py-2.5 text-sm font-medium transition-all ${
                  when === "schedule"
                    ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
                    : "border border-hair bg-card text-ink hover:bg-canvas"
                }`}
              >
                {t("Planifier", "Schedule")}
              </button>
            </div>
            {when === "schedule" && (
              <>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <DatePicker value={date} onChange={setDate} />
                  <TimePicker value={time} onChange={setTime} />
                </div>
                {/* Lève l'ambiguïté du fuseau : on planifie en heure locale. */}
                <p className="mt-1.5 text-2xs text-muted">
                  {t("Heure locale", "Local time")} : {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex justify-end gap-2 border-t border-hair pt-4">
            <Button variant="secondary" onClick={() => router.push("/scheduled")}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={noneSelected || submitting || !canEdit}
              title={!canEdit ? t("Lecture seule", "View only") : noneSelected ? t("Sélectionnez au moins une plateforme", "Select at least one platform") : undefined}
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
    </div>
  );
}

function ContentBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input h-28 resize-none"
    />
  );
}
