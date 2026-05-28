"use client";

import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { Meter } from "@/components/ui/Meter";
import type { Template } from "@/lib/types";

export default function LibraryPage() {
  const { data } = useCompany();
  const lib = data.library;

  return (
    <div>
      <PageHeader
        title="Library"
        actions={
          <>
            <Button variant="secondary">Select</Button>
            <Button variant="secondary">Bulk generate (text + image)</Button>
            <Button variant="primary">New template</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="metric-strip">
          <div className="text-2xs text-muted">Unused templates</div>
          <div className="mt-1 text-xl font-semibold text-ink">{lib.unused}</div>
        </div>
        <div className="metric-strip">
          <div className="text-2xs text-muted">Runway</div>
          <div className="mt-1 text-xl font-semibold text-ink">{lib.runway}</div>
        </div>
        <div className="rounded-lg border-hair border-ai-visual/20 bg-ai-visualbg px-4 py-3">
          <div className="text-2xs text-ai-visual">AI budget</div>
          <div className="mt-1 text-xl font-semibold text-ink">
            EUR {lib.aiBudgetUsed.toFixed(2)}/{lib.aiBudgetCap}
          </div>
          <div className="mb-1 text-2xs text-muted">
            Image {lib.imageSpend.toFixed(2)}/25 · Video {lib.videoSpend.toFixed(0)}/40
          </div>
          <Meter value={lib.aiBudgetUsed} max={lib.aiBudgetCap} tone="ai" />
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          placeholder="Search templates…"
          className="flex-1 rounded-md border-hair border-hair bg-card px-3 py-2 text-sm placeholder:text-muted focus:outline-none"
        />
        <button className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink">
          Platform: All
        </button>
        <button className="rounded-md border-hair border-ai-text/30 bg-ai-textbg px-3 py-2 text-xs text-ai-text">
          Status: Unused
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {lib.templates.map((t) => (
          <TemplateCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ t }: { t: Template }) {
  const tint =
    t.platform === "facebook" ? "bg-[#eef4fe]" : t.platform === "instagram" ? "bg-[#fdeef5]" : "bg-canvas";

  return (
    <div className="card overflow-hidden">
      <div className={`relative flex h-40 items-center justify-center ${t.media.ready ? tint : "bg-canvas"}`}>
        {t.media.ready ? (
          <span className="absolute right-2 top-2 rounded bg-ai-visual px-2 py-0.5 text-2xs font-medium text-white">
            {t.media.kind === "video" ? `AI video · ${t.media.seconds}s` : "AI image"}
          </span>
        ) : (
          <div className="text-center">
            <div className="text-2xs text-muted">No image yet</div>
            <button className="mt-1 rounded-md border-hair border-hair bg-card px-3 py-1 text-2xs text-ink">
              Generate
            </button>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <PlatformTag platform={t.platform} />
          <span className="rounded bg-canvas px-1.5 py-0.5 text-2xs text-muted">{t.tag}</span>
        </div>
        <p className="text-xs leading-relaxed text-ink">{t.body}</p>
      </div>
    </div>
  );
}
