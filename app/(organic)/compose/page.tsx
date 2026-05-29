"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { AiTextPanel, AiVisualsPanel } from "@/components/ui/AiPanel";

const SAMPLE =
  "Staying hydrated isn't just about quenching thirst — it supports metabolism, focus, and recovery. Aim for 2L a day.";

export default function ComposePage() {
  const { company, data } = useCompany();
  const [selected, setSelected] = useState<string[]>(
    data.accounts.map((a) => a.id)
  );
  const [when, setWhen] = useState<"now" | "schedule">("schedule");

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );

  const count = selected.length;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      {/* Editor */}
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-ink">New post</span>
            <span className="text-hair">|</span>
            <span className="text-sm text-muted">
              Company: <span className="font-semibold text-ink">{company.code}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">Save as draft</Button>
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
                {company.code} {a.platform === "facebook" ? "Facebook" : a.platform === "instagram" ? "Instagram" : "LinkedIn"}
              </button>
            );
          })}
        </div>

        <div className="mb-1 text-xs font-medium text-ink">Post content</div>
        <Tabs
          className="mb-4"
          tabs={[
            { id: "all", label: "All platforms", content: <ContentBox /> },
            { id: "fb", label: "Facebook", content: <ContentBox /> },
            { id: "ig", label: "Instagram", content: <ContentBox /> },
          ]}
        />

        <div className="mb-4">
          <AiTextPanel brandVoiceLabel={company.code} />
        </div>
        <div className="mb-4">
          <AiVisualsPanel used={data.library.aiBudgetUsed} cap={data.library.aiBudgetCap} />
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
            <input
              readOnly
              value="Wed, 27 May 2026"
              className="rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink"
            />
            <input
              readOnly
              value="09:00"
              className="rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t-hair border-hair pt-3">
          <Button variant="secondary">Cancel</Button>
          <Button variant="primary" disabled={count === 0}>
            {when === "now" ? `Publish ${count} posts` : `Schedule ${count} posts`}
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="panel p-3">
        <div className="mb-2 text-sm font-medium text-ink">Preview</div>
        <div className="mb-3 flex gap-2 text-2xs">
          <span className="rounded border-hair border-hair bg-card px-2 py-0.5 text-ink">Facebook</span>
          <span className="px-2 py-0.5 text-muted">Instagram</span>
        </div>
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
          <p className="text-xs leading-relaxed text-ink">{SAMPLE}</p>
          <div className="mt-2 flex aspect-video items-center justify-center rounded-md border-hair border-hair bg-canvas">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ai-visual text-2xs font-bold text-white">
              AI
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentBox() {
  return (
    <textarea
      defaultValue={SAMPLE}
      className="h-20 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-sm text-ink focus:outline-none"
    />
  );
}
