"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { AiTextPanel, AiVisualsPanel } from "@/components/ui/AiPanel";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { Toast } from "@/components/ui/Toast";
import { findDraft, findPost } from "@/lib/draft-store";
import { findTemplate } from "@/lib/template-store";
import { findHistoryItem } from "@/lib/history-store";

const PLACEHOLDER =
  "Rédigez le contenu de votre publication ici…";

const platformLabel = (p: string) =>
  p === "facebook" ? "Facebook" : p === "instagram" ? "Instagram" : "LinkedIn";

export default function ComposePage() {
  return (
    <Suspense fallback={null}>
      <ComposeContent />
    </Suspense>
  );
}

function ComposeContent() {
  const { company, data } = useCompany();
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
  const [selected, setSelected] = useState<string[]>(() => {
    if (source) {
      const acc = data.accounts.find((a) => a.platform === source.platform);
      return acc ? [acc.id] : data.accounts.map((a) => a.id);
    }
    return data.accounts.map((a) => a.id);
  });
  const scheduleSource = draft ?? post; // templates carry no schedule
  const [when, setWhen] = useState<"now" | "schedule">("schedule");
  const [date, setDate] = useState<Date>(
    new Date(`${scheduleSource?.date ?? "2026-05-27"}T00:00:00`)
  );
  const [time, setTime] = useState(scheduleSource?.time ?? "09:00");
  const [upload, setUpload] = useState<UploadedMedia | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<"facebook" | "instagram">("facebook");
  const [submitting, setSubmitting] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const count = selected.length;
  const noneSelected = count === 0;

  const selectedPlatforms = useMemo(
    () =>
      data.accounts
        .filter((a) => selected.includes(a.id))
        .map((a) => a.platform),
    [data.accounts, selected]
  );

  // Keep the preview platform in sync with what's actually selected.
  const previewAccounts = data.accounts.filter((a) => selected.includes(a.id));
  const effectivePreview =
    previewAccounts.some((a) => a.platform === previewPlatform)
      ? previewPlatform
      : previewAccounts[0]?.platform ?? "facebook";

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
      selectedPlatforms.map((platform) =>
        fetch("/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: company.id,
            platform,
            title: title || t("(Sans titre)", "(Untitled)"),
            body,
            date: postDate,
            time: postTime,
            status,
            source: "manual",
          }),
        })
      )
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
          <Button variant="secondary" onClick={handleSaveDraft} disabled={noneSelected || submitting}>
            {t("Enregistrer comme brouillon", "Save as draft")}
          </Button>
          <Button variant="secondary" onClick={handleSaveToLibrary} disabled={savingLibrary}>
            {savingLibrary
              ? t("Enregistrement…", "Saving…")
              : t("Enregistrer dans la bibliothèque", "Save to library")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Editor card */}
        <div className="card space-y-5 p-5">
          {/* Platform selector */}
          <div>
            <div className="section-label mb-2.5">{t("Publier sur", "Post to")}</div>
            <div className="flex flex-wrap gap-2">
              {data.accounts.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      on
                        ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
                        : "border border-hair bg-card text-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    {company.code} {platformLabel(a.platform)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Post content */}
          <div>
            <div className="section-label mb-2.5">{t("Contenu de la publication", "Post content")}</div>
            <Tabs
              tabs={[
                { id: "all", label: t("Toutes les plateformes", "All platforms"), content: <ContentBox value={body} onChange={setBody} /> },
                { id: "fb", label: "Facebook", content: <ContentBox value={body} onChange={setBody} /> },
                { id: "ig", label: "Instagram", content: <ContentBox value={body} onChange={setBody} /> },
              ]}
            />
          </div>

          {/* AI panels — réseau dérivé du 1er compte sélectionné (respecte le réseau). */}
          <AiTextPanel brandVoiceLabel={company.code} platform={activePlatform} />
          <AiVisualsPanel used={data.library.aiBudgetUsed} cap={data.library.aiBudgetCap} platform={activePlatform} />

          {/* Media upload */}
          <MediaUpload media={upload} onChange={setUpload} />

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
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <DatePicker value={date} onChange={setDate} />
                <TimePicker value={time} onChange={setTime} />
              </div>
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
              disabled={noneSelected || submitting}
              title={noneSelected ? t("Sélectionnez au moins une plateforme", "Select at least one platform") : undefined}
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

        {/* Preview panel */}
        <div className="panel p-4">
          <div className="section-label mb-3">{t("Aperçu", "Preview")}</div>
          <div className="mb-3 flex gap-1.5">
            {(["facebook", "instagram"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreviewPlatform(p)}
                className={`rounded-lg px-3 py-1.5 text-2xs font-medium transition-all ${
                  effectivePreview === p
                    ? "bg-card text-ink shadow-xs ring-1 ring-hair"
                    : "text-muted hover:text-ink"
                }`}
              >
                {platformLabel(p)}
              </button>
            ))}
          </div>

          {effectivePreview === "facebook" ? (
            <FacebookPreview company={company} body={body} upload={upload} />
          ) : (
            <InstagramPreview company={company} body={body} upload={upload} />
          )}
        </div>
      </div>
    </div>
  );
}

function MediaSlot({
  upload,
  aspect,
}: {
  upload: UploadedMedia | null;
  aspect: string;
}) {
  if (upload) {
    return (
      <div className={`mt-2 overflow-hidden rounded-lg border border-hair bg-canvas ${aspect}`}>
        {upload.kind === "video" ? (
          <video src={upload.url} className="h-full w-full object-cover" muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={upload.url} alt={upload.name} className="h-full w-full object-cover" />
        )}
      </div>
    );
  }
  return (
    <div className={`mt-2 flex items-center justify-center rounded-lg border border-dashed border-hair bg-canvas ${aspect}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ai-visual text-2xs font-bold text-white shadow-sm">
        AI
      </span>
    </div>
  );
}

function FacebookPreview({
  company,
  body,
  upload,
}: {
  company: { name: string; accent: string; code: string };
  body: string;
  upload: UploadedMedia | null;
}) {
  const t = useT();
  return (
    <div className="card overflow-hidden p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xs font-bold text-white shadow-sm"
          style={{ backgroundColor: company.accent }}
        >
          {company.code}
        </span>
        <div>
          <div className="text-xs font-semibold text-ink">{company.name}</div>
          <div className="text-2xs text-muted">{t("Planifié · Mer à 09:00", "Scheduled · Wed at 09:00")}</div>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink">{body}</p>
      <MediaSlot upload={upload} aspect="aspect-video" />
    </div>
  );
}

function InstagramPreview({
  company,
  body,
  upload,
}: {
  company: { name: string; accent: string; code: string };
  body: string;
  upload: UploadedMedia | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hair bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xs font-bold text-white ring-2 ring-platform-instagram/40 shadow-sm"
          style={{ backgroundColor: company.accent }}
        >
          {company.code}
        </span>
        <div className="text-xs font-semibold text-ink">{company.name}</div>
      </div>
      <MediaSlot upload={upload} aspect="aspect-square" />
      <p className="px-3 py-2.5 text-xs leading-relaxed text-ink">{body}</p>
    </div>
  );
}

function ContentBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input h-28 resize-none"
    />
  );
}
