"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { ScheduledDetailModal } from "@/components/organic/ScheduledDetailModal";
import { groupDateLabel } from "@/lib/format";
import type { ScheduledPost } from "@/lib/types";

type TabId = "all" | "scheduled" | "drafts";

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
  const t = useT();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [openPost, setOpenPost] = useState<ScheduledPost | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // ── Fusion des posts réels Supabase ──────────────────────────────────────
  const [apiPosts, setApiPosts] = useState<ScheduledPost[]>([]);
  const fetchedForCompany = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPosts() {
      if (!company.id) return;
      try {
        const res = await fetch(`/api/scheduled-posts?companyId=${encodeURIComponent(company.id)}`);
        if (!res.ok) return;
        const fetched: ScheduledPost[] = await res.json();
        if (!cancelled && Array.isArray(fetched)) {
          setApiPosts(fetched);
          fetchedForCompany.current = company.id;
        }
      } catch {
        // Silencieux — fallback données locales
      }
    }

    fetchPosts();

    const handleFocus = () => { fetchPosts(); };
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [company.id]);

  const mergedScheduled = useMemo(() => {
    const apiIds = new Set(apiPosts.map((p) => p.id));
    const localOnly = data.scheduled.filter((p) => !apiIds.has(p.id));
    return [...apiPosts, ...localOnly];
  }, [apiPosts, data.scheduled]);

  const param = params.get("tab");
  const tab: TabId = param === "scheduled" || param === "drafts" ? param : "all";

  const setTab = (id: TabId) => {
    router.push(id === "all" ? "/scheduled" : `/scheduled?tab=${id}`);
  };

  const visible = mergedScheduled.filter((p) => p.status !== "published");

  const isScheduledStatus = (p: ScheduledPost) => !isDraft(p);
  const counts = {
    all: visible.length,
    scheduled: visible.filter(isScheduledStatus).length,
    drafts: visible.filter(isDraft).length,
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: "all", label: t("Tout", "All") },
    { id: "scheduled", label: t("Planifiés", "Scheduled") },
    { id: "drafts", label: t("Brouillons", "Drafts") },
  ];

  const posts = useMemo(() => {
    if (tab === "scheduled") return visible.filter(isScheduledStatus);
    if (tab === "drafts") return visible.filter(isDraft);
    return visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedScheduled, tab, openPost]);

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
    <div className="animate-fade-in">
      <PageHeader
        title={t("Planifiés", "Scheduled")}
        actions={
          <>
            {/* View toggle */}
            <div className="flex rounded-lg border border-hair bg-card p-0.5 text-xs shadow-xs">
              <button
                onClick={() => setView("list")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  view === "list"
                    ? "bg-canvas font-semibold text-ink shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t("Liste", "List")}
              </button>
              <button
                onClick={() => setView("calendar")}
                className={`rounded-md px-3 py-1.5 transition-all ${
                  view === "calendar"
                    ? "bg-canvas font-semibold text-ink shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t("Calendrier", "Calendar")}
              </button>
            </div>
            <Button variant="primary" onClick={() => router.push("/compose")}>{t("Nouvelle publication", "New post")}</Button>
          </>
        }
      />

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 border-b border-hair">
        {TABS.map((tb) => {
          const c = counts[tb.id];
          const active = tb.id === tab;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors ${
                active
                  ? "border-page font-semibold text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tb.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-2xs font-semibold ${
                  active ? "bg-page/10 text-page" : "bg-canvas text-muted"
                }`}
              >
                {c}
              </span>
            </button>
          );
        })}
      </div>

      {view === "list" ? (
        <div className="space-y-5">
          {groups.length === 0 && (
            <div className="card flex flex-col items-center gap-3 px-4 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-2xl shadow-xs">
                🗓️
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{t("Aucune publication planifiée", "Nothing scheduled yet")}</p>
                <p className="mt-0.5 text-2xs text-muted">
                  {tab === "drafts"
                    ? t("Aucun brouillon enregistré. Commencez à composer pour sauvegarder un brouillon.", "No drafts saved. Start composing to save a draft.")
                    : t("Aucune publication ici. Créez et planifiez votre première publication.", "No posts here. Create and schedule your first post.")}
                </p>
              </div>
              <Button variant="secondary" onClick={() => router.push("/compose")}>
                {t("Créer une publication", "Create a post")}
              </Button>
            </div>
          )}
          {groups.map(([date, items]) => (
            <div key={date} className="animate-slide-up">
              <div className="section-label mb-2">{groupDateLabel(date)}</div>
              <div className="card divide-y divide-hair overflow-hidden">
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
  const t = useT();
  const inner = (
    <>
      <span className="w-14 shrink-0 rounded-md bg-canvas px-1.5 py-0.5 text-center text-2xs font-medium text-muted">
        {p.time}
      </span>
      <PlatformTag platform={p.platform} />
      <span className="flex-1 truncate text-sm text-ink">{p.title}</span>
      {p.needsReview && (
        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-2xs font-semibold text-warning-700">
          {t("À relire", "Review")}
        </span>
      )}
      {isDraft(p) ? (
        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-2xs font-semibold text-warning-700">
          {t("Brouillon", "Draft")}
        </span>
      ) : (
        <span
          className={`rounded-full px-2 py-0.5 text-2xs font-medium ${
            p.source === "automation"
              ? "bg-ai-textbg text-ai-text"
              : "bg-canvas text-muted"
          }`}
        >
          {p.source === "automation" ? t("Automatisation", "Automation") : t("Manuel", "Manual")}
        </span>
      )}
      {p.automationName === "Agent IA" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-200">
          <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5">
            <path d="M6 1l1.545 3.13L11 4.854 8.5 7.29l.59 3.44L6 9.13l-3.09 1.6.59-3.44L1 4.854l3.455-.724L6 1z" />
          </svg>
          IA
        </span>
      )}
    </>
  );

  if (isDraft(p)) {
    return (
      <Link
        href={`/compose?draft=${p.id}`}
        className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-canvas"
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-canvas"
    >
      {inner}
    </button>
  );
}

function CalendarView({ posts }: { posts: ScheduledPost[] }) {
  const t = useT();
  const byDate = new Map<number, ScheduledPost[]>();
  for (const p of posts) {
    const day = Number(p.date.slice(-2));
    byDate.set(day, [...(byDate.get(day) ?? []), p]);
  }
  // May 2026 starts on a Friday; render a simple month grid.
  const firstDow = 5;
  const cells = Array.from({ length: 35 }, (_, i) => i - firstDow + 1);

  const DAY_LABELS = [
    t("Dim", "Sun"), t("Lun", "Mon"), t("Mar", "Tue"),
    t("Mer", "Wed"), t("Jeu", "Thu"), t("Ven", "Fri"), t("Sam", "Sat"),
  ];

  return (
    <div className="card overflow-hidden p-4">
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase tracking-wide text-muted">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const valid = day >= 1 && day <= 31;
          const items = valid ? byDate.get(day) ?? [] : [];
          const hasItems = items.length > 0;
          return (
            <div
              key={i}
              className={`min-h-[72px] rounded-lg p-1.5 ${
                valid
                  ? hasItems
                    ? "border border-primary-200 bg-primary-50/40"
                    : "border border-hair bg-canvas/60"
                  : "border-transparent"
              }`}
            >
              {valid && (
                <div className={`mb-1 text-2xs font-medium ${hasItems ? "text-page" : "text-muted"}`}>
                  {day}
                </div>
              )}
              <div className="space-y-1">
                {items.map((p) => (
                  <div key={p.id} className="flex items-center gap-1 overflow-hidden rounded bg-card px-1 py-0.5 shadow-xs">
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
