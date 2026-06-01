"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { AudienceDetailModal } from "@/components/paid/AudienceDetailModal";
import type { Audience, AudienceType } from "@/lib/types";

type TypeFilter = "all" | AudienceType;
type StatusFilter = "all" | "in_use" | "not_in_use";

const TYPE: Record<AudienceType, { label: string; ring: string }> = {
  saved: { label: "Saved", ring: "border-l-platform-facebook" },
  custom: { label: "Custom", ring: "border-l-ai-visual" },
  lookalike: { label: "Lookalike", ring: "border-l-amber-400" },
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
  const { data } = useCompany();
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
    <div>
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

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Strip label="Total audiences" value={String(total)} />
        <Strip label="In use" value={String(inUseCount)} />
        <Strip label="Combined reach" value={a.combinedReach} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audiences…"
            className="w-full rounded-md border-hair border-hair bg-card py-2 pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas"
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
              className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas"
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
      <div className="grid grid-cols-2 gap-3">
        {visible.map((aud) => (
          <AudienceCard key={aud.id} aud={aud} onClick={() => setOpenAudience(aud)} />
        ))}
        <div
          title="AI audience suggestions will be enabled when the backend is connected."
          className="flex cursor-not-allowed flex-col items-center justify-center rounded-lg border border-dashed border-ai-visual/40 bg-ai-visualbg/40 p-5 text-center opacity-60"
        >
          <span className="text-sm font-medium text-ink">Let AI suggest an audience</span>
          <span className="text-2xs text-ai-visual">Describe your target in plain English</span>
        </div>
      </div>

      {visible.length === 0 && (
        <div className="card mt-3 px-3 py-8 text-center text-sm text-muted">
          No audiences match these filters.
        </div>
      )}

      <AudienceDetailModal
        audience={openAudience}
        onClose={() => setOpenAudience(null)}
        onChanged={refresh}
      />

      {newModalOpen && (
        <Modal open onClose={() => setNewModalOpen(false)} width="max-w-md">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
            New audience
          </div>
          <div className="p-4 text-sm text-ink">
            New audience creation coming in next update — type picker (Saved / Custom / Lookalike)
            with type-specific forms is being designed.
          </div>
          <div className="flex justify-end border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setNewModalOpen(false)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Strip({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-strip">
      <div className="text-2xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function AudienceCard({ aud, onClick }: { aud: Audience; onClick: () => void }) {
  const t = TYPE[aud.type];
  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer border-l-4 p-3 transition-shadow hover:shadow-sm ${t.ring}`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded bg-canvas px-1.5 py-0.5 text-2xs font-medium text-ink">{t.label}</span>
        {aud.inUse > 0 && <StatusBadge tone="green">In use ({aud.inUse})</StatusBadge>}
      </div>
      <div className="text-sm font-semibold text-ink">{aud.name}</div>
      <div className="text-2xs text-muted">{aud.description}</div>
      <div className="text-2xs text-muted">{aud.detail}</div>
      <div className="mt-2 flex items-center justify-between text-2xs text-muted">
        <span>{aud.reach}</span>
        <span>{aud.created}</span>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
