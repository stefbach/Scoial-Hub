"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { groupDateLabel } from "@/lib/format";
import type { ScheduledPost } from "@/lib/types";

export default function ScheduledPage() {
  const { data } = useCompany();
  const [view, setView] = useState<"list" | "calendar">("list");

  const groups = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const p of data.scheduled) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.scheduled]);

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
            <Button variant="primary">New post</Button>
          </>
        }
      />

      {view === "list" ? (
        <div className="space-y-4">
          {groups.map(([date, posts]) => (
            <div key={date}>
              <div className="section-label mb-1">{groupDateLabel(date)}</div>
              <div className="card divide-y divide-hair">
                {posts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="w-12 text-2xs text-muted">{p.time}</span>
                    <PlatformTag platform={p.platform} />
                    <span className="flex-1 text-ink">{p.title}</span>
                    {p.needsReview && (
                      <span className="text-2xs font-medium text-amber-600" title="Flagged for review">
                        ⚑ review
                      </span>
                    )}
                    <span
                      className={`text-2xs ${p.source === "automation" ? "text-ai-visual" : "text-muted"}`}
                    >
                      {p.source === "automation" ? "Automation" : "Manual"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <CalendarView posts={data.scheduled} />
      )}
    </div>
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
