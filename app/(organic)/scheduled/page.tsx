"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { ScheduledDetailModal } from "@/components/organic/ScheduledDetailModal";
import { groupDateLabel } from "@/lib/format";
import type { ScheduledPost } from "@/lib/types";

type TabId = "all" | "scheduled" | "drafts";
const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "scheduled", label: "Scheduled" },
  { id: "drafts", label: "Drafts" },
];

const isDraft = (p: ScheduledPost) => p.status === "draft";

export default function ScheduledPage() {
  return (
    <Suspense fallback={null}>
      <ScheduledContent />
    </Suspense>
  );
}

function ScheduledContent() {
  const { company, data } = useCompany();
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [openPost, setOpenPost] = useState<ScheduledPost | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const param = params.get("tab");
  const tab: TabId = param === "scheduled" || param === "drafts" ? param : "all";

  const setTab = (t: TabId) => {
    router.push(t === "all" ? "/scheduled" : `/scheduled?tab=${t}`);
  };

  // Published posts leave the Scheduled screen entirely.
  const visible = data.scheduled.filter((p) => p.status !== "published");

  const isScheduledStatus = (p: ScheduledPost) => !isDraft(p);
  const counts = {
    all: visible.length,
    scheduled: visible.filter(isScheduledStatus).length,
    drafts: visible.filter(isDraft).length,
  };

  const posts = useMemo(() => {
    if (tab === "scheduled") return visible.filter(isScheduledStatus);
    if (tab === "drafts") return visible.filter(isDraft);
    return visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.scheduled, tab, openPost]);

  const groups = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const p of posts) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [posts]);

  return (
    <div>
      <PageHeader
        title="Scheduled"
        actions={
          <>
            <div className="flex rounded-md border-hair border-hair bg-card p-0.5 text-xs">
              <button
                onClick={() => setView("list")}
                className={`rounded px-3 py-1 ${view === "list" ? "bg-canvas font-medium text-ink" : "text-muted"}`}
              >
                List
              </button>
              <button
                onClick={() => setView("calendar")}
                className={`rounded px-3 py-1 ${view === "calendar" ? "bg-canvas font-medium text-ink" : "text-muted"}`}
              >
                Calendar
              </button>
            </div>
            <Button variant="primary" onClick={() => router.push("/compose")}>New post</Button>
          </>
        }
      />

      <div className="mb-4 flex gap-5 border-b-hair border-hair">
        {TABS.map((t) => {
          const c = counts[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-1 pb-2 text-sm ${
                t.id === tab
                  ? "border-page font-medium text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label} ({c})
            </button>
          );
        })}
      </div>

      {view === "list" ? (
        <div className="space-y-4">
          {groups.length === 0 && (
            <div className="card px-3 py-6 text-center text-sm text-muted">
              Nothing here yet.
            </div>
          )}
          {groups.map(([date, items]) => (
            <div key={date}>
              <div className="section-label mb-1">{groupDateLabel(date)}</div>
              <div className="card divide-y divide-hair">
                {items.map((p) => (
                  <PostRow key={p.id} post={p} onOpen={() => setOpenPost(p)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <CalendarView posts={posts} />
      )}

      <ScheduledDetailModal
        companyId={company.id}
        post={openPost}
        onClose={() => setOpenPost(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function PostRow({ post: p, onOpen }: { post: ScheduledPost; onOpen: () => void }) {
  const inner = (
    <>
      <span className="w-12 text-2xs text-muted">{p.time}</span>
      <PlatformTag platform={p.platform} />
      <span className="flex-1 text-ink">{p.title}</span>
      {p.needsReview && (
        <span className="text-2xs font-medium text-amber-600" title="Flagged for review">
          ⚑ review
        </span>
      )}
      {isDraft(p) ? (
        <span className="text-2xs font-medium text-amber-600">Draft</span>
      ) : (
        <span
          className={`text-2xs ${p.source === "automation" ? "text-ai-visual" : "text-muted"}`}
        >
          {p.source === "automation" ? "Automation" : "Manual"}
        </span>
      )}
    </>
  );

  if (isDraft(p)) {
    return (
      <Link
        href={`/compose?draft=${p.id}`}
        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-canvas"
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-canvas"
    >
      {inner}
    </button>
  );
}

function CalendarView({ posts }: { posts: ScheduledPost[] }) {
  const byDate = new Map<number, ScheduledPost[]>();
  for (const p of posts) {
    const day = Number(p.date.slice(-2));
    byDate.set(day, [...(byDate.get(day) ?? []), p]);
  }
  // May 2026 starts on a Friday; render a simple month grid.
  const firstDow = 5;
  const cells = Array.from({ length: 35 }, (_, i) => i - firstDow + 1);

  return (
    <div className="card p-3">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-2xs text-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const valid = day >= 1 && day <= 31;
          const items = valid ? byDate.get(day) ?? [] : [];
          return (
            <div
              key={i}
              className={`min-h-[64px] rounded-md border-hair p-1 ${valid ? "border-hair bg-canvas" : "border-transparent"}`}
            >
              {valid && <div className="text-2xs text-muted">{day}</div>}
              <div className="mt-1 space-y-1">
                {items.map((p) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <PlatformTag platform={p.platform} />
                    <span className="truncate text-2xs text-ink">{p.time}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
