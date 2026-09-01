"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { hostMedia, formatSize, MAX_UPLOAD_BYTES, MEDIA_ACCEPT } from "@/lib/media/host";

export interface UploadedMedia {
  url: string;
  name: string;
  size: number;
  kind: "image" | "video";
}

export function MediaUpload({
  media,
  onChange,
  companyId,
}: {
  media: UploadedMedia | null;
  onChange: (m: UploadedMedia | null) => void;
  /** Si fourni, le fichier est hébergé publiquement (URL atteignable par
   *  Instagram/Facebook/LinkedIn). Sans companyId : aperçu local seulement. */
  companyId?: string;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hosting, setHosting] = useState(false);

  const accept = async (file: File) => {
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      // Rejet EXPLIQUÉ : l'ancien message disait seulement « choisissez un
      // fichier plus léger », sans dire pourquoi ni de combien (audit A-01).
      setError(
        t(
          `Fichier de ${formatSize(file.size)} — au-delà de ${formatSize(MAX_UPLOAD_BYTES)}, le montage se fait dans votre navigateur et dépasse sa mémoire. Réduisez la durée ou la définition, ou découpez la vidéo.`,
          `File is ${formatSize(file.size)} — above ${formatSize(MAX_UPLOAD_BYTES)}, editing runs in your browser and exceeds its memory. Shorten the clip, lower the resolution, or split the video.`
        )
      );
      return;
    }
    const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
    // Aperçu instantané (URL locale) pour une UX immédiate.
    onChange({ url: URL.createObjectURL(file), name: file.name, size: file.size, kind });

    // Hébergement public : indispensable pour publier sur les réseaux (les
    // plateformes récupèrent l'image côté serveur — une URL blob: ne marche pas).
    if (!companyId) return;
    setHosting(true);
    try {
      const res = await hostMedia(companyId, file, file.name, "compose");
      if (res.url) {
        onChange({ url: res.url, name: file.name, size: file.size, kind });
      } else {
        // Annule le média : sans ceci, l'aperçu instantané (URL blob: locale,
        // ligne 46) restait choisi malgré l'échec, et une publication ou un
        // export envoyait cette adresse — inatteignable pour Facebook/
        // Instagram comme pour le moteur de rendu (audit Editing Bench, P0-1b).
        onChange(null);
        setError(t("Hébergement du média échoué — réessayez ou choisissez un autre fichier.", "Media hosting failed — try again or choose another file."));
      }
    } finally {
      setHosting(false);
    }
  };

  if (media) {
    return (
      <div className="flex items-center gap-3 rounded-md border-hair border-hair bg-canvas p-2">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border-hair border-hair bg-card">
          {media.kind === "video" ? (
            <video src={media.url} className="h-full w-full object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt={media.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-ink">{media.name}</div>
          <div className="text-2xs text-muted">{formatSize(media.size)} · {hosting ? t("hébergement…", "hosting…") : t("prêt", "ready")}</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove file"
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-hair hover:text-ink"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) accept(file);
        }}
        className={`flex w-full flex-col items-center justify-center rounded-md border border-dashed px-3 py-4 text-center transition-colors ${
          dragOver ? "border-ai-text bg-ai-textbg" : "border-hair bg-canvas/60 hover:bg-canvas"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mb-1 text-muted">
          <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="text-xs text-ink">{t("Ou importez votre propre image/vidéo", "Or upload your own image/video")}</span>
        <span className="text-2xs text-muted">{t("PNG, JPG, WebP, MP4, MOV, WebM · jusqu'à 100 Mo", "PNG, JPG, WebP, MP4, MOV, WebM · up to 100MB")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) accept(file);
          e.target.value = "";
        }}
      />
      {error && <div className="mt-1 text-2xs text-red-600">{error}</div>}
    </div>
  );
}
