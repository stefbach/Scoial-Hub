"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useCompany } from "@/lib/company-context";
import { deleteAd, duplicateAd, toggleAd, updateAd } from "@/lib/campaign-store";
import { eur } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Ad } from "@/lib/types";

interface Context {
  campaignId: string;
  campaignName: string;
  adSetId: string;
  adSetName: string;
}

export function AdDetailModal({
  ad,
  context,
  onClose,
  onChanged,
}: {
  ad: Ad | null;
  context?: Context;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { company } = useCompany();
  const t = useT();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [headline, setHeadline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [cta, setCta] = useState("");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    if (ad) {
      setEditing(false);
      setConfirmDelete(false);
      setShowTechnical(false);
      setHeadline(ad.headline ?? "");
      setBodyText(ad.bodyText ?? "");
      setCta(ad.cta ?? "");
      setDestination(ad.destinationUrl ?? "");
    }
  }, [ad]);

  useEffect(() => {
    if (!ad) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ad, onClose]);

  if (!ad) return null;

  const statusLabel = ad.status === "active" ? t("Actif", "Active") : t("En pause", "Paused");
  const sourceLabel =
    ad.source === "uploaded"
      ? t("Téléchargement manuel", "Manual upload")
      : ad.aiModel
      ? `AI · ${ad.aiModel}`
      : "AI";

  const saveEdit = () => {
    updateAd(company.id, ad.id, {
      headline: headline.trim(),
      bodyText: bodyText.trim(),
      cta: cta.trim(),
      destinationUrl: destination.trim(),
    });
    onChanged();
    setEditing(false);
  };

  const goToCampaign = () => {
    onClose();
    if (context) router.push(`/campaigns/${context.campaignId}`);
  };
  const goToAdSet = () => {
    onClose();
    if (context) router.push(`/ad-sets/${context.adSetId}`);
  };

  return (
    <Modal open onClose={onClose} width="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b-hair border-hair px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-canvas px-1.5 py-0.5 text-2xs font-semibold uppercase text-muted">
            {t("Publicité", "Ad")}
          </span>
          <span className="text-sm font-semibold text-ink">{ad.name}</span>
          <StatusBadge tone={ad.status === "active" ? "green" : "gray"}>{statusLabel}</StatusBadge>
        </div>
        <button
          onClick={onClose}
          aria-label={t("Fermer", "Close")}
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="grid max-h-[75vh] grid-cols-[280px_1fr] overflow-hidden">
        {/* Left column */}
        <div className="overflow-y-auto bg-canvas/40 p-4">
          <div className="section-label mb-2">{t("Créatif", "Creative")}</div>
          <div className={`relative flex aspect-video items-center justify-center rounded-md border-hair border-hair ${ad.thumb}`}>
            {ad.source === "ai_generated" && (
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-ai-visual px-1.5 py-0.5 text-2xs font-medium text-white">
                <SparkleIcon /> AI
              </span>
            )}
            <ImageIcon />
          </div>
          <dl className="mt-3 space-y-1 text-2xs">
            <Row label={t("Format", "Format")} value={ad.format ?? "—"} />
            <Row label={t("Source", "Source")} value={sourceLabel} />
            <Row label={t("Dimensions", "Dimensions")} value={ad.dimensions ?? "—"} />
          </dl>
        </div>

        {/* Right column */}
        <div className="overflow-y-auto p-4">
          {context && (
            <>
              <div className="section-label mb-1">{t("Emplacement", "Where it lives")}</div>
              <div className="mb-3 text-xs">
                <button onClick={goToCampaign} className="text-ai-text hover:underline">
                  {t("Campagnes", "Campaigns")}
                </button>
                <span className="mx-1 text-hair">›</span>
                <button onClick={goToCampaign} className="text-ai-text hover:underline">
                  {context.campaignName}
                </button>
                <span className="mx-1 text-hair">›</span>
                <button onClick={goToAdSet} className="text-ai-text hover:underline">
                  {context.adSetName}
                </button>
              </div>
            </>
          )}

          <div className="section-label mb-1">{t("Texte publicitaire", "Copy")}</div>
          {editing ? (
            <div className="mb-3 space-y-2 rounded-md border-hair border-hair bg-card p-3">
              <div>
                <label className="text-2xs font-medium text-muted">{t("Titre", "Headline")}</label>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="mt-1 w-full rounded-md border-hair border-hair bg-card px-2 py-1.5 text-sm text-ink focus:outline-none"
                />
              </div>
              <div>
                <label className="text-2xs font-medium text-muted">{t("Corps du texte", "Body text")}</label>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="mt-1 h-20 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-sm text-ink focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-2xs font-medium text-muted">{t("Bouton d'action", "CTA")}</label>
                  <input
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    className="mt-1 w-full rounded-md border-hair border-hair bg-card px-2 py-1.5 text-sm text-ink focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-2xs font-medium text-muted">{t("URL de destination", "Destination URL")}</label>
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="mt-1 w-full rounded-md border-hair border-hair bg-card px-2 py-1.5 text-sm text-ink focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(false)}>{t("Annuler", "Cancel")}</Button>
                <Button variant="primary" onClick={saveEdit}>{t("Enregistrer", "Save")}</Button>
              </div>
            </div>
          ) : (
            <div className="mb-3 space-y-2 rounded-md border-hair border-hair bg-card p-3 text-sm text-ink">
              <div className="font-semibold">{ad.headline}</div>
              <p className="whitespace-pre-line text-xs leading-relaxed">{ad.bodyText}</p>
              <div className="flex items-center gap-1 text-2xs text-muted">
                <CursorIcon /> CTA: <span className="font-medium text-ink">{ad.cta}</span>
              </div>
              <div className="flex items-center gap-1 text-2xs">
                <LinkIcon />
                <Link
                  href={ad.destinationUrl ?? "#"}
                  className="truncate text-platform-linkedin underline"
                >
                  {ad.destinationUrl}
                </Link>
              </div>
            </div>
          )}

          <div className="section-label mb-1">{t("Performance · 30 derniers jours", "Performance · last 30 days")}</div>
          <div className="mb-3 grid grid-cols-4 gap-2">
            <MiniMetric label={t("Dépenses", "Spend")} value={eur(ad.spend)} />
            <MiniMetric label="CTR" value={ad.ctr} tone="green" />
            <MiniMetric label="CPC" value={eur(Number((ad.spend / Math.max(1, ad.conversions || 10)).toFixed(2)), { decimals: true })} />
            <MiniMetric label={t("Conv.", "Conv.")} value={String(ad.conversions)} />
          </div>

          <div>
            <button
              onClick={() => setShowTechnical((s) => !s)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-2xs text-muted hover:bg-canvas"
            >
              <span>{t("Détails techniques", "Technical details")}</span>
              <span className="inline-block transition-transform" style={{ transform: showTechnical ? "rotate(90deg)" : undefined }}>▸</span>
            </button>
            {showTechnical && (
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-2xs">
                <Row label={t("Créé le", "Created")} value={ad.createdAt ? format(new Date(`${ad.createdAt}T00:00:00`), "d MMM yyyy") : "—"} />
                <Row label={t("Créé par", "Created by")} value={ad.createdBy ?? "—"} />
                <Row label="Meta Ad ID" value={ad.metaAdId ?? "—"} />
                <Row label="Meta Ad Set ID" value={ad.metaAdSetId ?? "—"} />
                <Row
                  label={t("Dernière synchro", "Last synced")}
                  value={ad.lastSyncedAt ? format(new Date(ad.lastSyncedAt), "d MMM HH:mm") : "—"}
                />
              </dl>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <span className="flex items-center gap-1.5"><TrashIcon /> {t("Supprimer", "Delete")}</span>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              toggleAd(company.id, ad.id);
              onChanged();
            }}
          >
            {ad.status === "active" ? t("Mettre en pause", "Pause") : t("Activer", "Activate")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              duplicateAd(company.id, ad.id);
              onChanged();
            }}
          >
            {t("Dupliquer", "Duplicate")}
          </Button>
          <Button variant="primary" onClick={() => setEditing((e) => !e)}>
            {editing ? t("Fermer l'édition", "Close edit") : t("Modifier", "Edit")}
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20 p-6">
          <div className="w-full max-w-xs rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">{t("Supprimer cette publicité ? Cette action est irréversible.", "Delete this ad? This cannot be undone.")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>{t("Annuler", "Cancel")}</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteAd(company.id, ad.id);
                  onChanged();
                  onClose();
                }}
              >
                {t("Supprimer", "Delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return (
    <div className="rounded-md border-hair border-hair bg-canvas p-2">
      <div className="text-2xs text-muted">{label}</div>
      <div className={`text-sm font-semibold ${tone === "green" ? "text-green-600" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-muted">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 17l-5-5-9 9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function CursorIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l7 18 2-8 8-2L3 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
