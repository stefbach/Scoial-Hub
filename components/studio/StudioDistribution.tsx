"use client";

// ── StudioDistribution — diffuser une création (toujours disponible) ──────────
// Bloc unifié présent en permanence dans les studios : on choisit un média
// (la création en cours OU un visuel/vidéo de la bibliothèque) puis on le diffuse
//   • en ORGANIQUE  → réseaux + date/heure (publier / programmer),
//   • en PUBLICITÉ  → ouverture de la pub Meta préremplie.
// But : ne plus dépendre d'une génération réussie pour pouvoir diffuser.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { PublishScheduler } from "./PublishScheduler";
import { MediaLibraryButton, type LibraryAsset } from "./MediaLibrary";

export function StudioDistribution({
  companyId,
  producedUrl,
  producedKind = "video",
  defaultText = "",
  title,
}: {
  companyId: string;
  /** Média produit par le studio (sélectionné par défaut quand il existe). */
  producedUrl?: string | null;
  producedKind?: "image" | "video";
  defaultText?: string;
  title?: string;
}) {
  const t = useT();
  const [media, setMedia] = useState<{ url: string; kind: "image" | "video" } | null>(
    producedUrl ? { url: producedUrl, kind: producedKind } : null
  );
  const [fromLibrary, setFromLibrary] = useState(false);

  // Dès qu'une nouvelle création est produite, on la sélectionne (sauf si
  // l'utilisateur a explicitement choisi un média de la bibliothèque).
  useEffect(() => {
    if (producedUrl && !fromLibrary) setMedia({ url: producedUrl, kind: producedKind });
  }, [producedUrl, producedKind, fromLibrary]);

  function pickFromLibrary(a: LibraryAsset) {
    setFromLibrary(true);
    setMedia({ url: a.url, kind: a.type });
  }

  return (
    <div className="space-y-3 rounded-xl border border-hair bg-canvas/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="section-label">{title ?? t("Diffuser la création", "Distribute the creation")}</p>
        <MediaLibraryButton
          companyId={companyId}
          onPick={pickFromLibrary}
          label={media ? t("📚 Changer de média", "📚 Change media") : t("📚 Choisir dans la bibliothèque", "📚 Pick from library")}
          className="btn-ghost text-2xs text-page"
        />
      </div>

      {media ? (
        <>
          {/* Média sélectionné */}
          <div className="flex items-center gap-2 rounded-lg border border-hair bg-card p-2">
            {media.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
            ) : (
              <video src={media.url} className="h-12 w-12 shrink-0 rounded object-cover" muted preload="metadata" />
            )}
            <div className="min-w-0">
              <p className="truncate text-2xs font-medium text-ink">{media.url.split("/").pop()}</p>
              <p className="text-2xs text-muted">
                {media.kind === "image" ? t("Image", "Image") : t("Vidéo", "Video")}
                {fromLibrary ? t(" · bibliothèque", " · library") : t(" · création en cours", " · current creation")}
              </p>
            </div>
          </div>

          <PublishScheduler companyId={companyId} mediaUrl={media.url} mediaKind={media.kind} defaultText={defaultText} />
        </>
      ) : (
        <p className="text-2xs text-muted">
          {t(
            "Choisissez un média — votre création ou un visuel de la bibliothèque — pour le publier, le programmer en organique ou l'utiliser dans une pub.",
            "Pick a media — your creation or a library visual — to publish, schedule organically or use it in an ad."
          )}
        </p>
      )}
    </div>
  );
}
