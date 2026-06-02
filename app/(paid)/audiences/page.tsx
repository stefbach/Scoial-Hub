"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { AudienceDetailModal } from "@/components/paid/AudienceDetailModal";
import { NewAudienceModal } from "@/components/paid/NewAudienceModal";
import type { Audience, AudienceType } from "@/lib/types";

type TypeFilter = "all" | AudienceType;
type StatusFilter = "all" | "in_use" | "not_in_use";

const TYPE: Record<AudienceType, { label: string; ring: string; bg: string }> = {
  saved:     { label: "Saved",     ring: "border-l-platform-facebook", bg: "bg-[#e7f0fd] text-[#1877f2]" },
  custom:    { label: "Custom",    ring: "border-l-ai-visual",          bg: "bg-ai-visualbg text-ai-visual" },
  lookalike: { label: "Lookalike", ring: "border-l-warning-500",        bg: "bg-warning-50 text-warning-700" },
};

const TYPE_LABEL: Record<TypeFilter, string> = {
  all: "All",
  saved: "Saved",
  custom: "Custom",
  lookalike: "Lookalike",
};

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All",
  in_use: "In use",
  not_in_use: "Not in use",
};

export default function AudiencesPage() {
  return (
    <Suspense fallback={null}>
      <AudiencesContent />
    </Suspense>
  );
}

function AudiencesContent() {
  const { company, data } = useCompany();
  const router = useRouter();
  const params = useSearchParams();

  const initialType = params.get("type") as TypeFilter | null;
  const initialStatus = params.get("status") as StatusFilter | null;

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    initialType === "saved" || initialType === "custom" || initialType === "lookalike"
      ? initialType
      : "all"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initialStatus === "in_use" || initialStatus === "not_in_use" ? initialStatus : "all"
  );

  const [openAudience, setOpenAudience] = useState<Audience | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // Sync URL with active filters.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (typeFilter !== "all") qs.set("type", typeFilter);
    if (statusFilter !== "all") qs.set("status", statusFilter);
    if (search.trim()) qs.set("q", search.trim());
    const s = qs.toString();
    router.replace(s ? `/audiences?${s}` : "/audiences");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, search]);

  const a = data.audiences;

  const visible = useMemo(() => {
    return a.list.filter((aud) => {
      if (typeFilter !== "all" && aud.type !== typeFilter) return false;
      if (statusFilter === "in_use" && aud.inUse === 0) return false;
      if (statusFilter === "not_in_use" && aud.inUse > 0) return false;
      if (search.trim() && !aud.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.list, typeFilter, statusFilter, search, openAudience]);

  // Derived metrics from current state.
  const total = a.list.length;
  const inUseCount = a.list.filter((aud) => aud.inUse > 0).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Audiences"
        actions={
          <>
            <Button
              variant="secondary"
              disabled
              title="Audience sync will be enabled when Meta is connected."
            >
              Sync from Meta
            </Button>
            <Button variant="primary" onClick={() => setNewModalOpen(true)}>
              New audience
            </Button>
          </>
        }
      />

      {/* KPI strips */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <KpiStrip
          label="Total audiences"
          value={String(total)}
          icon={<UsersIcon />}
          accent="blue"
        />
        <KpiStrip
          label="In use"
          value={String(inUseCount)}
          icon={<CheckIcon />}
          accent="green"
        />
        <KpiStrip
          label="Combined reach"
          value={a.combinedReach}
          icon={<ReachIcon />}
          accent="indigo"
        />
      </div>

      {/* Filters */}
      <div className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audiences…"
            className="input pl-9"
          />
        </div>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="rounded-md border border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas"
            >
              Type: {TYPE_LABEL[typeFilter]}
            </button>
          )}
        >
          {(close) =>
            (["all", "saved", "custom", "lookalike"] as TypeFilter[]).map((t) => (
              <DropdownItem
                key={t}
                active={t === typeFilter}
                onClick={() => {
                  setTypeFilter(t);
                  close();
                }}
              >
                {TYPE_LABEL[t]}
              </DropdownItem>
            ))
          }
        </Dropdown>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="rounded-md border border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas"
            >
              Status: {STATUS_LABEL[statusFilter]}
            </button>
          )}
        >
          {(close) =>
            (["all", "in_use", "not_in_use"] as StatusFilter[]).map((s) => (
              <DropdownItem
                key={s}
                active={s === statusFilter}
                onClick={() => {
                  setStatusFilter(s);
                  close();
                }}
              >
                {STATUS_LABEL[s]}
              </DropdownItem>
            ))
          }
        </Dropdown>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-muted">
            <UsersIcon />
          </div>
          <p className="mt-4 text-sm font-medium text-ink">No audiences match these filters</p>
          <p className="mt-1 text-sm text-muted">Try adjusting the type or status filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((aud) => (
            <AudienceCard key={aud.id} aud={aud} onClick={() => setOpenAudience(aud)} />
          ))}
          <div
            title="AI audience suggestions will be enabled when the backend is connected."
            className="flex cursor-not-allowed flex-col items-center justify-center rounded-xl border border-dashed border-ai-visual/40 bg-ai-visualbg/30 p-6 text-center opacity-60"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-ai-visualbg text-ai-visual">
              <SparkleIcon />
            </div>
            <span className="text-sm font-medium text-ink">Let AI suggest an audience</span>
            <span className="mt-0.5 text-2xs text-ai-visual">Describe your target in plain English</span>
          </div>
        </div>
      )}

      <AudienceDetailModal
        audience={openAudience}
        onClose={() => setOpenAudience(null)}
        onChanged={refresh}
      />

      {newModalOpen && (
        <NewAudienceModal
          companyId={company.id}
          onClose={() => setNewModalOpen(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}

/* ── KPI strip ──────────────────────────────────────────────────────── */
type KpiAccent = "blue" | "green" | "indigo";
const KPI_ACCENT: Record<KpiAccent, { icon: string; ring: string }> = {
  blue:   { icon: "bg-primary-50 text-primary-600",  ring: "border-l-primary-400" },
  green:  { icon: "bg-success-50 text-success-600",   ring: "border-l-success-500" },
  indigo: { icon: "bg-ai-textbg text-ai-text",        ring: "border-l-ai-text" },
};

function KpiStrip({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: KpiAccent;
}) {
  const ac = KPI_ACCENT[accent];
  return (
    <div className={`metric-strip flex items-center gap-3.5 border-l-[3px] ${ac.ring}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ac.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xs font-medium uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-0.5 text-xl font-semibold leading-tight tabular-nums text-ink">{value}</div>
      </div>
    </div>
  );
}

/* ── Audience card ──────────────────────────────────────────────────── */
function AudienceCard({ aud, onClick }: { aud: Audience; onClick: () => void }) {
  const t = TYPE[aud.type];
  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer border-l-[3px] p-4 transition-all hover:shadow-md ${t.ring}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-2xs font-semibold ${t.bg}`}>{t.label}</span>
        {aud.inUse > 0 && (
          <StatusBadge tone="green" dot>In use ({aud.inUse})</StatusBadge>
        )}
      </div>
      <div className="text-sm font-semibold text-ink">{aud.name}</div>
      <div className="mt-0.5 text-2xs text-muted">{aud.description}</div>
      {aud.detail && <div className="mt-0.5 text-2xs text-muted">{aud.detail}</div>}
      <div className="mt-3 flex items-center justify-between border-t border-hair pt-2.5 text-2xs text-muted">
        <span className="font-medium text-ink">{aud.reach}</span>
        <span>{aud.created}</span>
      </div>
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────── */
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ReachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
