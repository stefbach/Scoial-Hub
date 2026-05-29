"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PlatformTag } from "@/components/ui/PlatformTag";
import { Meter } from "@/components/ui/Meter";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { BulkActionBar } from "@/components/organic/BulkActionBar";
import { BulkGenerateModal } from "@/components/organic/BulkGenerateModal";
import { NewTemplateModal } from "@/components/organic/NewTemplateModal";
import { TemplateDetailModal } from "@/components/organic/TemplateDetailModal";
import { GenerateImageModal } from "@/components/organic/GenerateImageModal";
import { deleteTemplates, retagTemplates } from "@/lib/template-store";
import type { Platform, Template, TemplateStatus } from "@/lib/types";

type PlatformFilter = "all" | Platform;
type StatusFilter = "all" | TemplateStatus;

const PLATFORM_LABEL: Record<PlatformFilter, string> = {
  all: "All",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};
const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All",
  unused: "Unused",
  used: "Used",
  archived: "Archived",
};

export default function LibraryPage() {
  const { company, data } = useCompany();
  const lib = data.library;

  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("unused");
  const [search, setSearch] = useState("");

  const [bulkGenOpen, setBulkGenOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Template | null>(null);
  const [genImageId, setGenImageId] = useState<string | null>(null);

  const visible = useMemo(() => {
    return lib.templates.filter((t) => {
      if (platformFilter !== "all" && t.platform !== platformFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit = t.body.toLowerCase().includes(q) || t.tags.some((tg) => tg.includes(q));
        if (!hit) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.templates, platformFilter, statusFilter, search, detail, genImageId]);

  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const toggleSelectMode = () => (selectMode ? exitSelect() : setSelectMode(true));

  const toggleId = (id: string) =>
    setSelectedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedList = [...selectedIds];

  return (
    <div className={selectMode ? "pb-16" : ""}>
      <PageHeader
        title="Library"
        actions={
          <>
            <Button
              variant={selectMode ? "primary" : "secondary"}
              onClick={toggleSelectMode}
            >
              Select
            </Button>
            <Button variant="secondary" onClick={() => setBulkGenOpen(true)}>
              Bulk generate (text + image)
            </Button>
            <Button variant="primary" onClick={() => setNewOpen(true)}>New template</Button>
          </>
        }
      />

      {/* Informational metric cards — intentionally non-interactive */}
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

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="flex-1 rounded-md border-hair border-hair bg-card px-3 py-2 text-sm placeholder:text-muted focus:outline-none"
        />

        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas"
            >
              Platform: {PLATFORM_LABEL[platformFilter]}
            </button>
          )}
        >
          {(close) =>
            (["all", "facebook", "instagram", "linkedin"] as PlatformFilter[]).map((p) => (
              <DropdownItem
                key={p}
                active={p === platformFilter}
                onClick={() => {
                  setPlatformFilter(p);
                  close();
                }}
              >
                {PLATFORM_LABEL[p]}
              </DropdownItem>
            ))
          }
        </Dropdown>

        {/* Status filter pill: body opens dropdown; X clears */}
        {statusFilter === "all" ? (
          <Dropdown
            align="right"
            trigger={(open, toggle) => (
              <button
                onClick={toggle}
                className="rounded-md border-hair border-hair bg-card px-3 py-2 text-xs text-ink hover:bg-canvas"
              >
                Status: All
              </button>
            )}
          >
            {(close) =>
              (["all", "unused", "used", "archived"] as StatusFilter[]).map((s) => (
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
        ) : (
          <div className="flex items-center overflow-hidden rounded-md border-hair border-ai-text/30 bg-ai-textbg text-xs text-ai-text">
            <Dropdown
              align="right"
              trigger={(open, toggle) => (
                <button onClick={toggle} className="py-2 pl-3 pr-2 hover:bg-ai-text/10">
                  Status: {STATUS_LABEL[statusFilter]}
                </button>
              )}
            >
              {(close) =>
                (["all", "unused", "used", "archived"] as StatusFilter[]).map((s) => (
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
            <button
              onClick={() => setStatusFilter("all")}
              aria-label="Clear status filter"
              className="px-2 py-2 hover:bg-ai-text/10"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {visible.map((t) => (
          <TemplateCard
            key={t.id}
            t={t}
            selectMode={selectMode}
            selected={selectedIds.has(t.id)}
            onToggleSelect={() => toggleId(t.id)}
            onOpen={() => setDetail(t)}
            onGenerate={() => setGenImageId(t.id)}
          />
        ))}
        {visible.length === 0 && (
          <div className="col-span-2 card px-3 py-8 text-center text-sm text-muted">
            No templates match these filters.
          </div>
        )}
      </div>

      {selectMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          visibleCount={visible.length}
          onSelectAll={() => setSelectedIds(new Set(visible.map((t) => t.id)))}
          onClear={exitSelect}
          onRetag={(tags) => {
            retagTemplates(company.id, selectedList, tags);
            refresh();
            exitSelect();
          }}
          onDelete={() => {
            deleteTemplates(company.id, selectedList);
            refresh();
            exitSelect();
          }}
        />
      )}

      {bulkGenOpen && (
        <BulkGenerateModal brandVoice={company.brandVoice} onClose={() => setBulkGenOpen(false)} />
      )}
      {newOpen && (
        <NewTemplateModal companyId={company.id} onClose={() => setNewOpen(false)} onSaved={refresh} />
      )}
      <TemplateDetailModal
        companyId={company.id}
        template={detail}
        onClose={() => setDetail(null)}
        onChanged={refresh}
      />
      {genImageId && (
        <GenerateImageModal
          companyId={company.id}
          templateId={genImageId}
          onClose={() => setGenImageId(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function TemplateCard({
  t,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
  onGenerate,
}: {
  t: Template;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onGenerate: () => void;
}) {
  const tint =
    t.platform === "facebook" ? "bg-[#eef4fe]" : t.platform === "instagram" ? "bg-[#fdeef5]" : "bg-canvas";

  const handleClick = () => {
    if (selectMode) onToggleSelect();
    else onOpen();
  };

  return (
    <div
      onClick={handleClick}
      className="card cursor-pointer overflow-hidden transition-shadow hover:shadow-sm"
    >
      <div className={`relative flex h-40 items-center justify-center ${t.media.ready ? tint : "bg-canvas"}`}>
        {selectMode && (
          <span
            className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border ${
              selected ? "border-ai-text bg-ai-text text-white" : "border-muted bg-card"
            }`}
          >
            {selected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        )}
        {t.media.ready ? (
          t.media.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.media.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute right-2 top-2 rounded bg-ai-visual px-2 py-0.5 text-2xs font-medium text-white">
              {t.media.kind === "video" ? `AI video · ${t.media.seconds}s` : "AI image"}
            </span>
          )
        ) : (
          <div className="text-center">
            <div className="text-2xs text-muted">No image yet</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
              className="mt-1 rounded-md border-hair border-hair bg-card px-3 py-1 text-2xs text-ink hover:bg-canvas"
            >
              Generate
            </button>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <PlatformTag platform={t.platform} />
          {t.tags.map((tag) => (
            <span key={tag} className="rounded bg-canvas px-1.5 py-0.5 text-2xs text-muted">
              {tag}
            </span>
          ))}
          {t.status !== "unused" && (
            <span className="ml-auto rounded bg-canvas px-1.5 py-0.5 text-2xs capitalize text-muted">
              {t.status}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-ink">{t.body}</p>
      </div>
    </div>
  );
}
