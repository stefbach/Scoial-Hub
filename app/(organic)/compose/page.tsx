"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { AiTextPanel, AiVisualsPanel } from "@/components/ui/AiPanel";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { saveDraft, findDraft, findPost } from "@/lib/draft-store";
import { findTemplate } from "@/lib/template-store";

const SAMPLE =
  "Staying hydrated isn't just about quenching thirst — it supports metabolism, focus, and recovery. Aim for 2L a day.";

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

  const draftId = params.get("draft");
  const postId = params.get("post");
  const templateId = params.get("template");
  const draft = draftId ? findDraft(company.id, draftId) : undefined;
  const post = postId ? findPost(company.id, postId) : undefined;
  const template = templateId ? findTemplate(company.id, templateId) : undefined;
  // A draft being resumed, a scheduled post being edited, or a template used.
  const source = draft ?? post ?? template;

  const [body, setBody] = useState(source?.body ?? SAMPLE);
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

  const handleSaveDraft = () => {
    const platform = selectedPlatforms[0] ?? "facebook";
    const id = draftId ?? `draft-${Date.now()}`;
    saveDraft(company.id, {
      id,
      platform,
      title: body.slice(0, 48) + (body.length > 48 ? "…" : ""),
      date: format(date, "yyyy-MM-dd"),
      time,
      source: "manual",
      status: "draft",
      body,
    });
    router.push("/scheduled?tab=drafts");
  };

  const verb = when === "now" ? "Publish" : "Schedule";
  const noun = count === 1 ? "post" : "posts";

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      {/* Editor */}
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-ink">{draft ? "Edit draft" : post ? "Edit post" : template ? "New post from template" : "New post"}</span>
            <span className="text-hair">|</span>
            <span className="text-sm text-muted">
              Company: <span className="font-semibold text-ink">{company.code}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSaveDraft}>Save as draft</Button>
            <Button variant="secondary">Save to library</Button>
          </div>
        </div>

        <div className="mb-1 text-xs font-medium text-ink">Where should this post?</div>
        <div className="mb-4 flex flex-wrap gap-2">
          {data.accounts.map((a) => {
            const on = selected.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  on
                    ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                    : "border-hair border-hair bg-card text-muted"
                }`}
              >
                {company.code} {platformLabel(a.platform)}
              </button>
            );
          })}
        </div>

        <div className="mb-1 text-xs font-medium text-ink">Post content</div>
        <Tabs
          className="mb-4"
          tabs={[
            { id: "all", label: "All platforms", content: <ContentBox value={body} onChange={setBody} /> },
            { id: "fb", label: "Facebook", content: <ContentBox value={body} onChange={setBody} /> },
            { id: "ig", label: "Instagram", content: <ContentBox value={body} onChange={setBody} /> },
          ]}
        />

        <div className="mb-4">
          <AiTextPanel brandVoiceLabel={company.code} />
        </div>
        <div className="mb-4">
          <AiVisualsPanel used={data.library.aiBudgetUsed} cap={data.library.aiBudgetCap} />
        </div>

        <div className="mb-4">
          <MediaUpload media={upload} onChange={setUpload} />
        </div>

        <div className="mb-1 text-xs font-medium text-ink">When to publish</div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setWhen("now")}
            className={`rounded-md py-2 text-sm font-medium ${
              when === "now"
                ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                : "border-hair border-hair bg-card text-ink"
            }`}
          >
            Now
          </button>
          <button
            onClick={() => setWhen("schedule")}
            className={`rounded-md py-2 text-sm font-medium ${
              when === "schedule"
                ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                : "border-hair border-hair bg-card text-ink"
            }`}
          >
            Schedule
          </button>
        </div>
        {when === "schedule" && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <DatePicker value={date} onChange={setDate} />
            <TimePicker value={time} onChange={setTime} />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t-hair border-hair pt-3">
          <Button variant="secondary" onClick={() => router.push("/scheduled")}>Cancel</Button>
          <Button
            variant="primary"
            disabled={noneSelected}
            title={noneSelected ? "Select at least one platform" : undefined}
          >
            {`${verb} ${count} ${noun}`}
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="panel p-3">
        <div className="mb-2 text-sm font-medium text-ink">Preview</div>
        <div className="mb-3 flex gap-2 text-2xs">
          {(["facebook", "instagram"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreviewPlatform(p)}
              className={`rounded px-2 py-0.5 ${
                effectivePreview === p
                  ? "border-hair border-hair bg-card text-ink"
                  : "text-muted"
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
      <div className={`mt-2 overflow-hidden rounded-md border-hair border-hair bg-canvas ${aspect}`}>
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
    <div className={`mt-2 flex items-center justify-center rounded-md border-hair border-hair bg-canvas ${aspect}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ai-visual text-2xs font-bold text-white">
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
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-2xs font-bold text-white"
          style={{ backgroundColor: company.accent }}
        >
          {company.code}
        </span>
        <div>
          <div className="text-xs font-semibold text-ink">{company.name}</div>
          <div className="text-2xs text-muted">Scheduled · Wed at 09:00</div>
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
    <div className="overflow-hidden rounded-md border-hair border-hair bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-2xs font-bold text-white ring-2 ring-platform-instagram/40"
          style={{ backgroundColor: company.accent }}
        >
          {company.code}
        </span>
        <div className="text-xs font-semibold text-ink">{company.name}</div>
      </div>
      <MediaSlot upload={upload} aspect="aspect-square" />
      <p className="px-3 py-2 text-xs leading-relaxed text-ink">{body}</p>
    </div>
  );
}

function ContentBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-20 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-sm text-ink focus:outline-none"
    />
  );
}
