"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
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

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryContent />
    </Suspense>
  );
}

function LibraryContent() {
  const { company, data } = useCompany();
  const lib = data.library;
  const params = useSearchParams();
  const t = useT();
  const initialPlatform = params.get("platform");
  const initialTag = params.get("tag");
  const initialStatus = params.get("status");

  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(
    initialPlatform === "facebook" || initialPlatform === "instagram" || initialPlatform === "linkedin"
      ? initialPlatform
      : "all"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initialStatus === "all" || initialStatus === "used" || initialStatus === "archived"
      ? initialStatus
      : "unused"
  );
  const [search, setSearch] = useState(initialTag ?? "");

  const [bulkGenOpen, setBulkGenOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Template | null>(null);
  const [genImageId, setGenImageId] = useState<string | null>(null);

  const PLATFORM_LABEL: Record<PlatformFilter, string> = {
    all: t("Tout", "All"),
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    twitter: "Twitter/X",
  };
  const STATUS_LABEL: Record<StatusFilter, string> = {
    all: t("Tout", "All"),
    unused: t("Non utilisé", "Unused"),
    used: t("Utilisé", "Used"),
    archived: t("Archivé", "Archived"),
  };

  const visible = useMemo(() => {
    return lib.templates.filter((tpl) => {
      if (platformFilter !== "all" && tpl.platform !== platformFilter) return false;
      if (statusFilter !== "all" && tpl.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit = tpl.body.toLowerCase().includes(q) || tpl.tags.some((tg) => tg.includes(q));
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
    <div className={`animate-fade-in ${selectMode ? "pb-16" : ""}`}>
      <PageHeader
        title={t("Modèles de posts", "Post templates")}
        actions={
          <>
            <Button
              variant={selectMode ? "primary" : "secondary"}
              onClick={toggleSelectMode}
            >
              {selectMode ? t("Annuler la sélection", "Cancel select") : t("Sélectionner", "Select")}
            </Button>
            <Button variant="secondary" onClick={() => setBulkGenOpen(true)}>
              {t("Génération en masse", "Bulk generate")}
            </Button>
            <Button variant="primary" onClick={() => setNewOpen(true)}>{t("Nouveau modèle", "New template")}</Button>
          </>
        }
      />

      <p className="mb-4 text-2xs text-muted">
        {t("Ici : vos modèles de contenu (texte). Pour vos visuels & vidéos :", "Here: your content templates (text). For your visuals & videos:")}{" "}
        <Link href="/media" className="text-primary-600 hover:underline">{t("→ Médiathèque", "→ Media library")}</Link>
      </p>

      {/* Metric strips */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="metric-strip">
          <div className="section-label mb-1">{t("Modèles non utilisés", "Unused templates")}</div>
          <div className="mt-1.5 text-2xl font-bold text-ink">{lib.unused}</div>
        </div>
        <div className="metric-strip">
          <div className="section-label mb-1">{t("Autonomie", "Runway")}</div>
          <div className="mt-1.5 text-2xl font-bold text-ink">{lib.runway}</div>
        </div>
        <div className="rounded-xl border border-ai-visual/25 bg-ai-visualbg px-4 py-3 shadow-xs">
          <div className="section-label mb-1 text-ai-visual">{t("Budget IA", "AI budget")}</div>
          <div className="mt-1.5 text-2xl font-bold text-ink">
            EUR {lib.aiBudgetUsed.toFixed(2)}<span className="text-sm font-normal text-muted">/{lib.aiBudgetCap}</span>
          </div>
          <div className="my-1.5 text-2xs text-muted">
            {t("Image", "Image")} {lib.imageSpend.toFixed(2)}/25 · {t("Vidéo", "Video")} {lib.videoSpend.toFixed(0)}/40
          </div>
          <Meter value={lib.aiBudgetUsed} max={lib.aiBudgetCap} tone="ai" />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Rechercher des modèles…", "Search templates…")}
          className="input min-w-0 flex-1"
        />

        <Dropdown
          align="right"
          trigger={(open, toggle) => (
            <button
              onClick={toggle}
              className="shrink-0 whitespace-nowrap rounded-lg border border-hair bg-card px-3 py-2 text-xs font-medium text-ink shadow-xs hover:bg-canvas transition-colors"
            >
              {t("Plateforme", "Platform")}: {PLATFORM_LABEL[platformFilter]}
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
                className="shrink-0 whitespace-nowrap rounded-lg border border-hair bg-card px-3 py-2 text-xs font-medium text-ink shadow-xs hover:bg-canvas transition-colors"
              >
                {t("Statut", "Status")}: {t("Tout", "All")}
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
          <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-ai-text/30 bg-ai-textbg text-xs text-ai-text shadow-xs">
            <Dropdown
              align="right"
              trigger={(open, toggle) => (
                <button onClick={toggle} className="whitespace-nowrap py-2 pl-3 pr-2 font-medium hover:bg-ai-text/10">
                  {t("Statut", "Status")}: {STATUS_LABEL[statusFilter]}
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
              aria-label={t("Effacer le filtre de statut", "Clear status filter")}
              className="px-2 py-2 hover:bg-ai-text/10"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            t={tpl}
            selectMode={selectMode}
            selected={selectedIds.has(tpl.id)}
            onToggleSelect={() => toggleId(tpl.id)}
            onOpen={() => setDetail(tpl)}
            onGenerate={() => setGenImageId(tpl.id)}
          />
        ))}
        {visible.length === 0 && (
          <div className="col-span-2 card flex flex-col items-center gap-3 px-4 py-14 text-center lg:col-span-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-2xl shadow-xs">
              📚
            </span>
            <div>
              <p className="text-sm font-medium text-ink">{t("Aucun modèle ne correspond à ces filtres", "No templates match these filters")}</p>
              <p className="mt-0.5 text-2xs text-muted">
                {t("Essayez d'ajuster votre recherche ou vos filtres, ou créez un nouveau modèle.", "Try adjusting your search or filters, or create a new template.")}
              </p>
            </div>
            <Button variant="secondary" onClick={() => setNewOpen(true)}>
              {t("Nouveau modèle", "New template")}
            </Button>
          </div>
        )}
      </div>

      {selectMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          visibleCount={visible.length}
          onSelectAll={() => setSelectedIds(new Set(visible.map((tpl) => tpl.id)))}
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
  t: tpl,
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
  const translate = useT();
  const [imgError, setImgError] = useState(false);
  const tint =
    tpl.platform === "facebook" ? "bg-[#eef4fe]" : tpl.platform === "instagram" ? "bg-[#fdeef5]" : "bg-canvas";

  const handleClick = () => {
    if (selectMode) onToggleSelect();
    else onOpen();
  };

  return (
    <div
      onClick={handleClick}
      className={`card cursor-pointer overflow-hidden transition-all hover:shadow-md ${
        selected ? "ring-2 ring-ai-text/50" : ""
      }`}
    >
      <div className={`relative flex h-40 items-center justify-center ${tpl.media.ready ? tint : "bg-canvas"}`}>
        {selectMode && (
          <span
            className={`absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-md border shadow-sm ${
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
        {tpl.media.ready ? (
          tpl.media.url && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tpl.media.url}
              alt=""
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : tpl.media.url && imgError ? (
            // Image indisponible (URL expirée/invalide) → repli propre, pas d'icône cassée
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-canvas text-muted">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
                <path d="M21 16l-5-5L5 20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-2xs">{translate("Aperçu indisponible", "Preview unavailable")}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                className="mt-0.5 rounded-md border border-hair bg-card px-2 py-0.5 text-2xs font-medium text-ink hover:bg-canvas"
              >
                {translate("Régénérer", "Regenerate")}
              </button>
            </div>
          ) : (
            <span className="absolute right-2 top-2 rounded-full bg-ai-visual px-2.5 py-0.5 text-2xs font-semibold text-white shadow-sm">
              {tpl.media.kind === "video" ? `${translate("Vidéo IA", "AI video")} · ${tpl.media.seconds}s` : translate("Image IA", "AI image")}
            </span>
          )
        ) : (
          <div className="text-center">
            <div className="text-2xs text-muted">{translate("Pas encore d'image", "No image yet")}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
              className="mt-2 rounded-lg border border-hair bg-card px-3 py-1 text-2xs font-medium text-ink shadow-xs hover:bg-canvas transition-colors"
            >
              {translate("Générer", "Generate")}
            </button>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="mb-2 flex flex-wrap items-start gap-1.5">
          <PlatformTag platform={tpl.platform} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {tpl.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
          {tpl.status !== "unused" && (
            <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-2xs font-medium capitalize text-muted">
              {tpl.status}
            </span>
          )}
        </div>
        <p className="line-clamp-3 text-xs leading-relaxed text-ink">{tpl.body}</p>
      </div>
    </div>
  );
}
