"use client";

// components/ui/MediaLightbox.tsx
//
// Aperçu agrandi d'un visuel/vidéo (retour client Rosiane #5, BUGS-SocialHub35) :
// jusqu'ici, cliquer sur une vignette de la médiathèque (app/(organic)/media)
// ne faisait rien pour une image, et une vidéo restait coincée dans sa petite
// vignette carrée. Composant générique — la même logique existait déjà,
// dupliquée, dans components/series/SeriesPlanner.tsx.

import { useT } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";

export function MediaLightbox({
  open,
  onClose,
  url,
  kind,
  title,
}: {
  open: boolean;
  onClose: () => void;
  url: string | null;
  kind: "image" | "video";
  title?: string;
}) {
  const t = useT();
  return (
    <Modal open={open && Boolean(url)} onClose={onClose} width="max-w-3xl">
      {url && (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {title && <p className="text-sm font-semibold text-ink">{title}</p>}
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary ml-auto text-2xs">
              {t("Ouvrir l'original", "Open original")}
            </a>
          </div>
          {kind === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={url}
              controls
              autoPlay
              className="max-h-[75vh] w-full rounded-xl border border-hair bg-canvas object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="max-h-[75vh] w-full rounded-xl border border-hair bg-canvas object-contain" />
          )}
        </div>
      )}
    </Modal>
  );
}
