"use client";

/**
 * components/compose/AlbumUpload.tsx
 *
 * Retour client (réunion Rosiane, point #7) : publier plusieurs photos en une
 * seule publication (album Facebook / carrousel Instagram) — jusqu'ici
 * `MediaUpload` ne portait qu'UN SEUL fichier, aucun chemin n'existait pour
 * en attacher plusieurs à la même publication.
 *
 * Gère uniquement les images SUPPLÉMENTAIRES (la première reste le visuel
 * choisi via `MediaUpload`, qui sert aussi de couverture pour les canaux qui
 * ne savent pas afficher un carrousel — LinkedIn, TikTok, aperçus).
 */

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { hostMedia, formatSize, MAX_UPLOAD_BYTES } from "@/lib/media/host";
import type { UploadedMedia } from "@/components/ui/MediaUpload";

/** Facebook et Instagram plafonnent tous deux un album/carrousel à 10 visuels. */
export const ALBUM_MAX_ITEMS = 10;

export function AlbumUpload({
  extra,
  onChange,
  companyId,
  max = ALBUM_MAX_ITEMS,
}: {
  /** Images au-delà de la première (déjà portée par `MediaUpload`). */
  extra: UploadedMedia[];
  /** Setter React (style `useState`) : les mises à jour d'hébergement, asynchrones,
   *  ont besoin de la fonction plutôt que d'une valeur figée à l'appel. */
  onChange: (updater: UploadedMedia[] | ((prev: UploadedMedia[]) => UploadedMedia[])) => void;
  companyId: string;
  /** Total incluant la première image (par défaut : plafond Facebook/Instagram). */
  max?: number;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hostingCount, setHostingCount] = useState(0);
  const remaining = Math.max(0, max - 1 - extra.length);

  const acceptFiles = async (files: File[]) => {
    setError(null);
    const room = files.slice(0, remaining);
    if (files.length > room.length) {
      setError(t(`Limité à ${max} visuels par publication — ${files.length - room.length} image(s) ignorée(s).`, `Limited to ${max} visuals per post — ${files.length - room.length} image(s) skipped.`));
    }
    for (const file of room) {
      if (!file.type.startsWith("image")) {
        setError(t("L'album n'accepte que des images.", "Albums only accept images."));
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(t(`Fichier de ${formatSize(file.size)} — au-delà de ${formatSize(MAX_UPLOAD_BYTES)}.`, `File is ${formatSize(file.size)} — above ${formatSize(MAX_UPLOAD_BYTES)}.`));
        continue;
      }
      const local: UploadedMedia = { url: URL.createObjectURL(file), name: file.name, size: file.size, kind: "image" };
      onChange((prev) => [...prev, local]);
      setHostingCount((n) => n + 1);
      try {
        const res = await hostMedia(companyId, file, file.name, "compose-album");
        if (res.url) {
          const hostedUrl = res.url;
          onChange((prev) => prev.map((m) => (m === local ? { ...m, url: hostedUrl } : m)));
        } else {
          setError(t("Hébergement d'une image de l'album échoué.", "Album image hosting failed."));
        }
      } finally {
        setHostingCount((n) => n - 1);
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {extra.map((item, i) => (
          <div key={`${item.url}-${i}`} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-hair bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(extra.filter((_, j) => j !== i))}
              aria-label={t("Retirer cette image de l'album", "Remove this image from the album")}
              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/70 text-[9px] text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-hair text-muted hover:bg-canvas"
          >
            <span className="text-base leading-none">+</span>
            <span className="text-[9px]">{t("Ajouter", "Add")}</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) acceptFiles(files);
            e.target.value = "";
          }}
        />
      </div>
      <div className="text-2xs text-muted">
        {extra.length + 1}/{max} {t("visuels", "visuals")}
        {hostingCount > 0 && ` · ${t("hébergement…", "hosting…")}`}
      </div>
      {error && <div className="text-2xs text-red-600">{error}</div>}
    </div>
  );
}
