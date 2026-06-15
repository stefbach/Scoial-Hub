"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { ScheduledDetailModal } from "@/components/organic/ScheduledDetailModal";
import { groupDateLabel } from "@/lib/format";
import { deletePost } from "@/lib/draft-store";
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

  // ── Fusion des posts réels Supabase ──────────────────────────────────────
  const [apiPosts, setApiPosts] = useState<ScheduledPost[]>([]);
  const fetchedForCompany = useRef<string | null>(null);
  // Mises à jour optimistes : un post supprimé/replanifié doit disparaître ou se
  // mettre à jour IMMÉDIATEMENT, sans attendre un rechargement (les données de
  // contexte `data.scheduled` ne sont pas rafraîchies et ré-affichaient l'ancien).
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, { date?: string; time?: string }>>({});
  const markRemoved = useCallback((id: string) => setRemovedIds((prev) => new Set(prev).add(id)), []);
  const markRescheduled = useCallback((id: string, date: string, time: string) =>
    setOverrides((prev) => ({ ...prev, [id]: { date, time } })), []);

  const fetchPosts = useCallback(async () => {
    if (!company.id) return;
    try {
      const res = await fetch(`/api/scheduled-posts?companyId=${encodeURIComponent(company.id)}`, { cache: "no-store" });
      if (!res.ok) return;
      const fetched: ScheduledPost[] = await res.json();
      if (Array.isArray(fetched)) {
        setApiPosts(fetched);
        fetchedForCompany.current = company.id;
      }
    } catch {
      // Silencieux — fallback données locales
    }
  }, [company.id]);

  useEffect(() => {
    fetchPosts();
    // Refetch au retour sur l'onglet — anti-rebond pour éviter une rafale de
    // requêtes si on alt-tab plusieurs fois rapidement.
    let t: ReturnType<typeof setTimeout> | null = null;
    const handleFocus = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { fetchPosts(); }, 1000);
    };
    window.addEventListener("focus", handleFocus);
    return () => { if (t) clearTimeout(t); window.removeEventListener("focus", handleFocus); };
  }, [fetchPosts]);

  const mergedScheduled = useMemo(() => {
    const apiIds = new Set(apiPosts.map((p) => p.id));
    const localOnly = data.scheduled.filter((p) => !apiIds.has(p.id));
    return [...apiPosts, ...localOnly]
      .filter((p) => !removedIds.has(p.id)) // supprimés → masqués tout de suite
      .map((p) => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p)); // date/heure replanifiées
  }, [apiPosts, data.scheduled, removedIds, overrides]);

  const param = params.get("tab");
  const tab: TabId = param === "scheduled" || param === "drafts" ? param : "all";

  const setTab = (id: TabId) => {
    router.push(id === "all" ? "/scheduled" : `/scheduled?tab=${id}`);
  };

  const visible = mergedScheduled.filter((p) => p.status !== "published");

  // Suppression rapide depuis la liste (survol) : serveur + store local + refetch.
  const handleQuickDelete = useCallback(async (post: ScheduledPost) => {
    if (typeof window !== "undefined" && !window.confirm(
      t("Supprimer cette publication ? Cette action est irréversible.", "Delete this post? This cannot be undone.")
    )) return;
    markRemoved(post.id); // disparaît immédiatement de la liste
    try {
      await fetch(`/api/scheduled-posts/${post.id}`, { method: "DELETE" });
    } catch { /* repli store local */ }
    deletePost(company.id, post.id);
    await fetchPosts();
  }, [company.id, fetchPosts, t, markRemoved]);

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
                  <PostRow
                    key={p.id}
                    post={p}
                    onOpen={() => setOpenPost(p)}
                    onEdit={() => router.push(`/compose?post=${p.id}`)}
                    onDelete={() => handleQuickDelete(p)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <CalendarView posts={posts} onOpen={setOpenPost} />
      )}

      <ScheduledDetailModal
        companyId={company.id}
        post={openPost}
        onClose={() => setOpenPost(null)}
        onChanged={fetchPosts}
        onOptimisticDelete={markRemoved}
        onOptimisticReschedule={markRescheduled}
      />
    </div>
  );
}

function PostRow({
  post: p,
  onOpen,
  onEdit,
  onDelete,
}: {
  post: ScheduledPost;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
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
    <div className="group/row relative">
      <button
        onClick={onOpen}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 pr-24 text-left text-sm transition-colors hover:bg-canvas"
      >
        {inner}
      </button>
      {/* Actions rapides révélées au survol (#16) */}
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label={t("Modifier", "Edit")}
            title={t("Modifier", "Edit")}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-card text-muted shadow-xs ring-1 ring-hair transition-colors hover:text-ink"
          >
            <RowEditIcon />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={t("Supprimer", "Delete")}
            title={t("Supprimer", "Delete")}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-card text-danger-600 shadow-xs ring-1 ring-hair transition-colors hover:bg-danger-50"
          >
            <RowTrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function RowEditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RowTrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarView({
  posts,
  onOpen,
}: {
  posts: ScheduledPost[];
  onOpen: (post: ScheduledPost) => void;
}) {
  const t = useT();

  // Derive the displayed month from the earliest post date, or fall back to today.
  const today = new Date();
  const earliest = posts
    .map((p) => new Date(p.date + "T00:00:00"))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const seed = earliest ?? today;

  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth()); // 0-based

  // Group posts by "YYYY-MM-DD" key so multi-month data is unambiguous.
  const byIsoDate = new Map<string, ScheduledPost[]>();
  for (const p of posts) {
    byIsoDate.set(p.date, [...(byIsoDate.get(p.date) ?? []), p]);
  }

  // Number of days in the displayed month.
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // 0=Sun … 6=Sat → we want Mon=0 … Sun=6 grid.
  const rawFirstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const firstDow = (rawFirstDow + 6) % 7; // convert: Mon=0 … Sun=6
  const totalCells = Math.ceil((daysInMonth + firstDow) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => i - firstDow + 1);

  const monthPad = (n: number) => String(n).padStart(2, "0");
  const monthPrefix = `${viewYear}-${monthPad(viewMonth + 1)}-`;

  const MONTH_NAMES = [
    t("Janvier", "January"), t("Février", "February"), t("Mars", "March"),
    t("Avril", "April"), t("Mai", "May"), t("Juin", "June"),
    t("Juillet", "July"), t("Août", "August"), t("Septembre", "September"),
    t("Octobre", "October"), t("Novembre", "November"), t("Décembre", "December"),
  ];

  // Mon-first day headers
  const DAY_LABELS = [
    t("Lun", "Mon"), t("Mar", "Tue"), t("Mer", "Wed"), t("Jeu", "Thu"),
    t("Ven", "Fri"), t("Sam", "Sat"), t("Dim", "Sun"),
  ];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className="card overflow-hidden p-4">
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          aria-label={t("Mois précédent", "Previous month")}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-ink">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          aria-label={t("Mois suivant", "Next month")}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers (Mon-first) */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase tracking-wide text-muted">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const valid = day >= 1 && day <= daysInMonth;
          const isoKey = valid ? `${monthPrefix}${monthPad(day)}` : "";
          const items = valid ? byIsoDate.get(isoKey) ?? [] : [];
          const hasItems = items.length > 0;
          return (
            <div
              key={i}
              onClick={hasItems ? () => onOpen(items[0]) : undefined}
              role={hasItems ? "button" : undefined}
              tabIndex={hasItems ? 0 : undefined}
              onKeyDown={
                hasItems
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(items[0]);
                      }
                    }
                  : undefined
              }
              className={`min-h-[72px] rounded-lg p-1.5 ${
                valid
                  ? hasItems
                    ? "cursor-pointer border border-primary-200 bg-primary-50/40 transition-colors hover:bg-primary-50"
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
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(p);
                    }}
                    className="flex w-full cursor-pointer items-center gap-1 overflow-hidden rounded bg-card px-1 py-0.5 text-left shadow-xs transition-colors hover:bg-canvas"
                  >
                    <PlatformTag platform={p.platform} />
                    <span className="truncate text-2xs text-ink">{p.time}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
