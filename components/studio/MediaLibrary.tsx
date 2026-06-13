"use client";

// ── MediaLibrary — parcourir et choisir un média de la bibliothèque ───────────
// Bloc réutilisable dans tous les studios : ouvre une fenêtre listant les visuels
// et vidéos déjà enregistrés pour la marque (+ logo / charte du brand kit), pour
// les RÉUTILISER dans un assemblage, une publication, une pub… sans tout refaire.

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";

export interface LibraryAsset {
  url: string;
  type: "image" | "video";
  format?: string;
  source?: string;
}

type Filter = "all" | "image" | "video" | "logo";

function isLogo(a: LibraryAsset) {
  return (a.source ?? "").startsWith("brand-kit");
}

/** Bouton qui ouvre la bibliothèque ; `onPick` reçoit l'asset choisi. */
export function MediaLibraryButton({
  companyId,
  onPick,
  accept = "all",
  label,
  className,
}: {
  companyId: string;
  onPick: (asset: LibraryAsset) => void;
  /** Types proposés à la sélection (filtre l'affichage). */
  accept?: "all" | "image" | "video";
  label?: string;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "btn-secondary text-xs"}>
        {label ?? t("📚 Bibliothèque", "📚 Library")}
      </button>
      {open && (
        <MediaLibraryModal
          companyId={companyId}
          accept={accept}
          onClose={() => setOpen(false)}
          onPick={(a) => { onPick(a); setOpen(false); }}
        />
      )}
    </>
  );
}

function MediaLibraryModal({
  companyId,
  accept,
  onClose,
  onPick,
}: {
  companyId: string;
  accept: "all" | "image" | "video";
  onClose: () => void;
  onPick: (a: LibraryAsset) => void;
}) {
  const t = useT();
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(accept === "all" ? "all" : accept);

  const load = useCallback(async () => {
    setError(null); setAssets(null);
    try {
      const r = await fetch(`/api/media?companyId=${encodeURIComponent(companyId)}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error || t("Chargement impossible.", "Couldn't load.")); setAssets([]); return; }
      setAssets(Array.isArray(d.assets) ? d.assets : []);
    } catch {
      setError(t("Erreur réseau.", "Network error.")); setAssets([]);
    }
  }, [companyId, t]);

  useEffect(() => { load(); }, [load]);

  // Fermeture à la touche Échap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = (assets ?? []).filter((a) => {
    if (accept !== "all" && a.type !== accept) return false;
    if (filter === "all") return true;
    if (filter === "logo") return isLogo(a);
    return a.type === filter && !isLogo(a);
  });

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: t("Tout", "All") },
    ...(accept !== "video" ? [{ id: "image" as Filter, label: t("Images", "Images") }] : []),
    ...(accept !== "image" ? [{ id: "video" as Filter, label: t("Vidéos", "Videos") }] : []),
    { id: "logo", label: t("Logo / charte", "Logo / brand") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-hair bg-page shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">{t("Bibliothèque média", "Media library")}</p>
            <p className="text-2xs text-muted">{t("Choisissez un visuel ou une vidéo déjà créés.", "Pick a visual or video you already created.")}</p>
          </div>
          <button onClick={onClose} aria-label={t("Fermer", "Close")} className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-1.5 border-b border-hair px-4 py-2">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={`rounded-full px-2.5 py-1 text-2xs font-medium transition-colors ${filter === f.id ? "bg-page text-white ring-1 ring-primary-300" : "bg-canvas text-muted ring-1 ring-hair hover:text-ink"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Grille */}
        <div className="min-h-[200px] flex-1 overflow-y-auto p-4">
          {assets === null ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted">
              <Spinner size={16} className="text-primary-600" /> {t("Chargement…", "Loading…")}
            </div>
          ) : error ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted">
              {error}
              <button onClick={load} className="btn-secondary text-xs">{t("Réessayer", "Retry")}</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1 text-center text-sm text-muted">
              <p>{t("Bibliothèque vide pour ce filtre.", "Empty library for this filter.")}</p>
              <p className="text-2xs">{t("Les créations enregistrées (studios, pubs, logo) apparaîtront ici.", "Saved creations (studios, ads, logo) will show up here.")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {visible.map((a) => (
                <button key={a.url} type="button" onClick={() => onPick(a)}
                  className="group relative overflow-hidden rounded-lg border border-hair bg-canvas text-left transition-colors hover:border-primary-300">
                  {a.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="h-28 w-full object-cover" onError={(e) => { e.currentTarget.style.opacity = "0.3"; }} />
                  ) : (
                    <video src={a.url} className="h-28 w-full object-cover" muted preload="metadata" />
                  )}
                  <span className="absolute left-1 top-1 rounded bg-ink/70 px-1.5 py-0.5 text-2xs font-semibold text-white">
                    {isLogo(a) ? "LOGO" : a.type === "image" ? "IMG" : "VID"}
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center bg-page/0 text-2xs font-semibold text-white opacity-0 transition-opacity group-hover:bg-page/40 group-hover:opacity-100">
                    {t("Choisir", "Pick")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
