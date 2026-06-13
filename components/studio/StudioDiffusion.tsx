"use client";

// ── StudioDiffusion — barre de diffusion partagée par les 3 studios ───────────
// Une fois un média produit (vidéo, avatar ou affiche), on propose TOUJOURS les
// mêmes actions, au même endroit, de façon cohérente :
//   • 📚 Stocker dans la bibliothèque (réutilisable partout)
//   • 📣 Intégrer dans une pub Meta (média pré-rempli sur /campaigns/new)
//   • 🚀 Publier maintenant / 📅 Programmer (Facebook / Instagram / TikTok)
// Le sous-titrage reste spécifique à la vidéo (géré dans chaque studio), mais la
// distribution est unifiée ici.

import { PublishScheduler } from "./PublishScheduler";
import { useT } from "@/lib/i18n";

export function StudioDiffusion({
  companyId,
  mediaUrl,
  mediaKind,
  defaultText = "",
  savedToLibrary,
  onSaveToLibrary,
  saving = false,
}: {
  companyId: string;
  /** URL publique (https) du média produit — requise pour publier/programmer/pub. */
  mediaUrl: string;
  mediaKind: "image" | "video";
  /** Légende par défaut (réutilisée comme texte de pub et de publication). */
  defaultText?: string;
  /** undefined = ne pas afficher la ligne « bibliothèque » (déjà auto-enregistré). */
  savedToLibrary?: boolean;
  /** Si fourni, affiche un bouton d'enregistrement manuel en bibliothèque. */
  onSaveToLibrary?: () => void;
  saving?: boolean;
}) {
  const t = useT();

  // Lien « créer une pub » : le média est pré-rempli sur /campaigns/new via les
  // paramètres ?image= / ?video= (+ ?text=), déjà gérés par cette page.
  const adHref =
    `/campaigns/new?${mediaKind === "video" ? "video" : "image"}=${encodeURIComponent(mediaUrl)}` +
    (defaultText.trim() ? `&text=${encodeURIComponent(defaultText.trim().slice(0, 300))}` : "");

  return (
    <div className="space-y-2 rounded-xl border border-hair bg-canvas/60 p-3">
      <p className="section-label">{t("Diffuser ce média", "Distribute this media")}</p>

      {/* Bibliothèque */}
      {savedToLibrary !== undefined &&
        (savedToLibrary ? (
          <p className="rounded-lg bg-success-50 px-3 py-1.5 text-2xs font-medium text-success-700">
            {t("✓ Enregistré dans la bibliothèque — réutilisable partout", "✓ Saved to the library — reusable everywhere")}
          </p>
        ) : (
          <button
            type="button"
            onClick={onSaveToLibrary}
            disabled={saving || !onSaveToLibrary}
            className="btn-secondary inline-flex w-full items-center justify-center gap-1.5 text-xs disabled:opacity-50"
          >
            {saving ? t("Enregistrement…", "Saving…") : t("📚 Enregistrer dans la bibliothèque", "📚 Save to library")}
          </button>
        ))}

      {/* Intégrer dans une pub Meta */}
      <a href={adHref} className="btn-secondary flex w-full items-center justify-center text-xs">
        {t("📣 Intégrer dans une pub Meta", "📣 Use in a Meta ad")}
      </a>

      {/* Publier / programmer (FB / IG / TikTok) */}
      <PublishScheduler companyId={companyId} mediaUrl={mediaUrl} mediaKind={mediaKind} defaultText={defaultText} />
    </div>
  );
}
