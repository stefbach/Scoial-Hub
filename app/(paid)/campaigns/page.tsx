"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { CreateAdModal } from "@/components/paid/CreateAdModal";
import { NewCampaignModal } from "@/components/paid/NewCampaignModal";
import { MetaAdAccountsPanel } from "@/components/ads/MetaAdAccountsPanel";
import { AgentLauncher } from "@/components/agents/AgentLauncher";
import { Modal } from "@/components/ui/Modal";
import {
  deleteCampaign as deleteCampaignLocal,
  hydrateCampaigns,
  toggleCampaign,
} from "@/lib/campaign-store";
import { eur } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import type { Campaign } from "@/lib/types";

export default function CampaignsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignsContent />
    </Suspense>
  );
}

function CampaignsContent() {
  const t = useT();
  const { company, data } = useCompany();
  const params = useSearchParams();
  const [, setTick] = useState(0);
  const refresh = () => setTick((tick) => tick + 1);

  // Make sure every campaign has its detail fields ready.
  useEffect(() => {
    hydrateCampaigns(company.id);
    refresh();
  }, [company.id]);

  // ── Fusion des campagnes réelles Supabase ────────────────────────────────
  // Récupère les campagnes depuis l'API et les fusionne avec les données mock.
  // Si le fetch échoue, on continue d'afficher les données locales sans erreur.
  const [apiCampaigns, setApiCampaigns] = useState<Campaign[]>([]);
  const [loadingApi, setLoadingApi] = useState(true);
  const fetchedForCompany = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCampaigns() {
      if (!company.id) return;
      try {
        const res = await fetch(`/api/campaigns?companyId=${encodeURIComponent(company.id)}`);
        if (!res.ok) return; // Silencieux — on garde l'affichage actuel
        const fetched: Campaign[] = await res.json();
        if (!cancelled && Array.isArray(fetched)) {
          setApiCampaigns(fetched);
          fetchedForCompany.current = company.id;
        }
      } catch {
        // Silencieux — fallback données locales
      } finally {
        if (!cancelled) setLoadingApi(false);
      }
    }

    setLoadingApi(true);
    fetchCampaigns();

    const handleFocus = () => { fetchCampaigns(); };
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [company.id]);

  // Séparation claire : les campagnes RÉELLES (API/Supabase, persistées) d'un
  // côté, et les BROUILLONS locaux (mock, non encore en base) de l'autre.
  const apiIds = useMemo(() => new Set(apiCampaigns.map((c) => c.id)), [apiCampaigns]);

  // Brouillons = campagnes présentes uniquement dans le store local et pas
  // encore renvoyées par l'API. Dédoublonnées par id.
  const draftCampaigns = useMemo(
    () => data.campaigns.list.filter((c) => !apiIds.has(c.id)),
    [data.campaigns.list, apiIds]
  );

  // Campagnes réelles = ce que renvoie l'API (inclut les campagnes Agent IA).
  const realCampaigns = apiCampaigns;

  const mergedCampaigns = useMemo(
    () => [...realCampaigns, ...draftCampaigns],
    [realCampaigns, draftCampaigns]
  );

  const c = {
    ...data.campaigns,
    list: mergedCampaigns,
    activeCampaigns: mergedCampaigns.filter((camp) => camp.status === "active").length || data.campaigns.activeCampaigns,
  };

  const [draftsOpen, setDraftsOpen] = useState(true);

  const [adModal, setAdModal] = useState(false);
  const [campaignModal, setCampaignModal] = useState<{ open: boolean; campaign?: Campaign }>({
    open: params.get("new") === "true",
  });
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);
  const [expanded, setExpanded] = useState<string | null>(c.list[0]?.id ?? null);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t("Campagnes", "Campaigns")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCampaignModal({ open: true })}>{t("Brouillon local", "Local draft")}</Button>
            <Link href="/campaigns/new" className="btn-primary inline-flex items-center text-sm">
              {t("Créer une pub Meta", "Create Meta ad")}
            </Link>
          </>
        }
      />

      {/* Agent IA — lançable directement depuis la page Campagnes */}
      <div className="mb-4">
        <AgentLauncher context={t("page Campagnes", "Campaigns page")} defaultObjective={t("Concevoir et préparer une campagne publicitaire", "Design and prepare an ad campaign")} />
      </div>

      {/* Comptes publicitaires Meta présents (données réelles) */}
      <div className="mb-6">
        <MetaAdAccountsPanel />
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={t("Campagnes actives", "Active campaigns")}
          value={String(c.activeCampaigns)}
          icon={<CampaignIcon />}
          accent="blue"
        />
        <KpiCard
          label={t("Dépenses du mois", "Spend this month")}
          value={eur(c.spendMtd)}
          icon={<SpendIcon />}
          accent="indigo"
        />
        <KpiCard
          label={t("Conversions (30j)", "Conversions (30d)")}
          value={String(c.conversions)}
          icon={<ConvIcon />}
          accent="green"
        />
        <KpiCard
          label={t("CPC moyen", "Avg. CPC")}
          value={eur(c.avgCpc, { decimals: true })}
          icon={<CpcIcon />}
          accent="amber"
        />
      </div>

      {/* Campaign list */}
      {loadingApi && c.list.length === 0 ? (
        <div className="card flex items-center justify-center gap-2.5 px-6 py-16 text-sm text-muted">
          <Spinner size={18} className="text-primary-600" />
          {t("Chargement des campagnes…", "Loading campaigns…")}
        </div>
      ) : c.list.length === 0 ? (
        <EmptyState
          icon={<CampaignIcon />}
          title={t("Aucune campagne pour l'instant", "No campaigns yet")}
          description={t(
            "Créez votre première campagne pour commencer à générer du trafic et des conversions.",
            "Create your first campaign to start driving traffic and conversions."
          )}
          action={
            <Button variant="primary" onClick={() => setCampaignModal({ open: true })}>
              {t("Nouvelle campagne", "New campaign")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* ── Section principale : campagnes réelles (persistées) ───────── */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-hair bg-canvas/60 px-5 py-3">
              <span className="section-label">
                {t("Campagnes", "Campaigns")} ({realCampaigns.length})
              </span>
              <span className="text-2xs text-muted">{t("Publiées · en base", "Published · in database")}</span>
            </div>
            {realCampaigns.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted">
                {t(
                  "Aucune campagne publiée pour le moment.",
                  "No published campaigns yet."
                )}
                {draftCampaigns.length > 0 && (
                  <span className="mt-1 block text-2xs">
                    {t(
                      "Vos brouillons apparaissent ci-dessous.",
                      "Your drafts appear below."
                    )}
                  </span>
                )}
              </div>
            ) : (
              <div className="divide-y divide-hair">
                {realCampaigns.map((camp) => (
                  <CampaignRow
                    key={camp.id}
                    camp={camp}
                    isFromApi
                    open={expanded === camp.id}
                    onChevron={() => setExpanded((e) => (e === camp.id ? null : camp.id))}
                    onToggleEnabled={() => {
                      toggleCampaign(company.id, camp.id);
                      refresh();
                    }}
                    onEdit={() => setCampaignModal({ open: true, campaign: camp })}
                    onDelete={() => setConfirmDelete(camp)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Section repliable : brouillons (locaux, non publiés) ──────── */}
          {draftCampaigns.length > 0 && (
            <div className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setDraftsOpen((o) => !o)}
                aria-expanded={draftsOpen}
                className="flex w-full items-center justify-between border-b border-hair bg-canvas/60 px-5 py-3 text-left transition-colors hover:bg-canvas"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block text-[10px] text-muted transition-transform duration-150 ${draftsOpen ? "rotate-90" : ""}`}
                  >
                    ▸
                  </span>
                  <span className="section-label">
                    {t("Brouillons (non publiés)", "Drafts (unpublished)")} ({draftCampaigns.length})
                  </span>
                </span>
                <span className="text-2xs text-muted">
                  {t("Pas encore en base", "Not yet in database")}
                </span>
              </button>
              {draftsOpen && (
                <div className="divide-y divide-hair">
                  {draftCampaigns.map((camp) => (
                    <CampaignRow
                      key={camp.id}
                      camp={camp}
                      isDraft
                      open={expanded === camp.id}
                      onChevron={() => setExpanded((e) => (e === camp.id ? null : camp.id))}
                      onToggleEnabled={() => {
                        toggleCampaign(company.id, camp.id);
                        refresh();
                      }}
                      onEdit={() => setCampaignModal({ open: true, campaign: camp })}
                      onDelete={() => setConfirmDelete(camp)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <CreateAdModal open={adModal} onClose={() => setAdModal(false)} />
      <NewCampaignModal
        open={campaignModal.open}
        campaign={campaignModal.campaign}
        onClose={() => setCampaignModal({ open: false })}
        onSaved={refresh}
      />

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} width="max-w-sm">
        <div className="p-5 sm:p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <TrashIcon />
          </div>
          <h3 className="text-base font-semibold text-ink">{t("Supprimer la campagne", "Delete campaign")}</h3>
          <p className="mt-1.5 text-sm text-muted">
            {t("Supprimer", "Delete")} &ldquo;{confirmDelete?.name}&rdquo;? {t("Cette action est irréversible.", "This action cannot be undone.")}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>{t("Annuler", "Cancel")}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirmDelete) return;
                const idToDelete = confirmDelete.id;
                try {
                  await fetch(`/api/campaigns/${idToDelete}`, { method: "DELETE" });
                } catch {
                  // Silent — proceed with local removal
                }
                deleteCampaignLocal(company.id, idToDelete);
                setApiCampaigns((prev) => prev.filter((c) => c.id !== idToDelete));
                setConfirmDelete(null);
                refresh();
              }}
            >
              {t("Supprimer", "Delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────────────────── */
type Accent = "blue" | "indigo" | "green" | "amber";

const ACCENT_CLASSES: Record<Accent, { icon: string; ring: string }> = {
  blue:   { icon: "bg-primary-50 text-primary-600",  ring: "border-l-primary-400" },
  indigo: { icon: "bg-ai-textbg text-ai-text",        ring: "border-l-ai-text" },
  green:  { icon: "bg-success-50 text-success-600",   ring: "border-l-success-500" },
  amber:  { icon: "bg-warning-50 text-warning-600",   ring: "border-l-warning-500" },
};

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: Accent;
}) {
  const ac = ACCENT_CLASSES[accent];
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

/* ── Empty state ──────────────────────────────────────────────────────── */
function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-canvas text-muted shadow-xs">
        {icon}
      </div>
      <h3 className="mt-5 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ── Campaign row ─────────────────────────────────────────────────────── */
function CampaignRow({
  camp,
  isFromApi,
  isDraft,
  open,
  onChevron,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  camp: Campaign;
  isFromApi?: boolean;
  isDraft?: boolean;
  open: boolean;
  onChevron: () => void;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const detailHref = `/campaigns/${camp.id}`;
  const status = camp.enabled ? t("Actif", "Active") : t("En pause", "Paused");
  const statusTone = camp.enabled ? "green" : "gray";
  const budgetPct = camp.budget > 0 ? Math.min(100, Math.round((camp.spend / camp.budget) * 100)) : 0;

  return (
    <div
      onClick={() => router.push(detailHref)}
      className="group cursor-pointer px-5 py-4 transition-colors hover:bg-canvas/70"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left — chevron + name block */}
        <div className="flex flex-1 items-start gap-3 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChevron();
            }}
            aria-expanded={open}
            aria-label={open ? t("Réduire la campagne", "Collapse campaign") : t("Développer la campagne", "Expand campaign")}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hair hover:text-ink"
          >
            <span
              className={`inline-block text-[10px] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            >
              ▸
            </span>
          </button>

          <div className="min-w-0 flex-1">
            {/* Name + badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={detailHref}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-ink hover:underline"
              >
                {camp.name}
              </Link>
              <StatusBadge tone={statusTone} dot>{status}</StatusBadge>
              {isDraft && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-2xs font-semibold text-warning-700 ring-1 ring-warning-200">
                  <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                    <path d="M8 1.5l2.5 2.5L4 10.5 1.5 11 2 8.5 8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t("Brouillon", "Draft")}
                </span>
              )}
              {camp.platforms.map((p) => (
                <PlatformChip key={p} platform={p} />
              ))}
              {isFromApi && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-200">
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5">
                    <path d="M6 1l1.545 3.13L11 4.854 8.5 7.29l.59 3.44L6 9.13l-3.09 1.6.59-3.44L1 4.854l3.455-.724L6 1z" />
                  </svg>
                  {t("créé par IA", "created by AI")}
                </span>
              )}
            </div>

            {/* Sub-line: objective + metrics */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted">
              <span className="font-medium text-ink/70">{camp.objective}</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-hair" />
                {t("Dépensé", "Spent")}{" "}
                <span className="font-semibold text-ink">{eur(camp.spend)}</span>
                {" / "}
                <span>{eur(camp.budget)}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-hair" />
                {camp.metricsLabel}{" "}
                <span className="font-semibold text-ink">{camp.metricsValue}</span>
              </span>
              {camp.cplLabel && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1 w-1 rounded-full bg-hair" />
                  {camp.cplLabel}
                </span>
              )}
            </div>

            {/* Budget progress bar */}
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hair">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    budgetPct >= 90
                      ? "bg-danger-500"
                      : budgetPct >= 70
                      ? "bg-warning-500"
                      : "bg-primary-400"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <span className="w-8 text-right text-2xs tabular-nums text-muted">{budgetPct}%</span>
            </div>
          </div>
        </div>

        {/* Right — actions + toggle */}
        <div
          className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton title={t("Modifier", "Edit")} ariaLabel={t("Modifier la campagne", "Edit campaign")} onClick={onEdit}>
            <PencilIcon />
          </IconButton>
          <IconButton title={t("Supprimer", "Delete")} ariaLabel={t("Supprimer la campagne", "Delete campaign")} danger onClick={onDelete}>
            <TrashIcon />
          </IconButton>
          <span className="ml-2">
            <Toggle key={String(camp.enabled)} defaultOn={camp.enabled} onChange={onToggleEnabled} />
          </span>
        </div>
        {/* Always-visible toggle when not hovering */}
        <div
          className="flex shrink-0 items-center group-hover:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <Toggle key={`stable-${String(camp.enabled)}`} defaultOn={camp.enabled} onChange={onToggleEnabled} />
        </div>
      </div>

      {/* Expanded — ad sets */}
      {open && (
        <div className="ml-8 mt-4" onClick={(e) => e.stopPropagation()}>
          <div className="section-label mb-2.5">{t("Ensembles de publicités", "Ad sets")} ({camp.adSets.length})</div>
          {camp.adSets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hair bg-canvas px-4 py-5 text-center text-xs text-muted">
              {t("Aucun ensemble de publicités pour l'instant.", "No ad sets yet.")}
            </div>
          ) : (
            <div className="space-y-1.5">
              {camp.adSets.map((set) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-2.5 transition-colors hover:bg-white/[0.05] hover:border-page/40"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/ad-sets/${set.id}`}
                      className="text-xs font-semibold text-ink hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {set.name}
                    </Link>
                    <div className="mt-0.5 text-2xs text-muted">
                      {set.placement} · {set.targeting}
                    </div>
                  </div>
                  <div className="ml-4 shrink-0 text-2xs tabular-nums text-muted">
                    <span className="mr-2 font-medium text-ink">{set.ads} {t("pubs", "ads")}</span>
                    {eur(set.dailyBudget)}/{t("jour", "day")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Platform chip ─────────────────────────────────────────────────────── */
const PLATFORM_STYLES: Record<string, string> = {
  Facebook:  "bg-[#e7f0fd] text-[#1877f2]",
  Instagram: "bg-[#fce4ec] text-[#e1306c]",
  LinkedIn:  "bg-[#e8f0fb] text-[#0a66c2]",
};

function PlatformChip({ platform }: { platform: string }) {
  const cls = PLATFORM_STYLES[platform] ?? "bg-canvas text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ${cls}`}>
      {platform}
    </span>
  );
}

/* ── Icon button ─────────────────────────────────────────────────────── */
function IconButton({
  title,
  ariaLabel,
  danger,
  onClick,
  children,
}: {
  title: string;
  ariaLabel: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        danger
          ? "text-danger-500 hover:bg-danger-50 hover:text-danger-700"
          : "text-muted hover:bg-hair hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Icons ────────────────────────────────────────────────────────────── */
function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CampaignIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 11l19-9-9 19-2-8-8-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SpendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v10M9.5 9.5C9.5 8.4 10.6 8 12 8s2.5.4 2.5 1.5-1.2 1.8-2.5 2-2.5.9-2.5 2S10.4 16 12 16s2.5-.4 2.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ConvIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CpcIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
