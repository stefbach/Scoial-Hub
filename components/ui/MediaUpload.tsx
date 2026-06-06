"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,video/mp4";

export interface UploadedMedia {
  url: string;
  name: string;
  size: number;
  kind: "image" | "video";
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MediaUpload({
  media,
  onChange,
}: {
  media: UploadedMedia | null;
  onChange: (m: UploadedMedia | null) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("File is over 25MB. Please choose a smaller file.");
      return;
    }
    const kind = file.type.startsWith("video") ? "video" : "image";
    onChange({
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      kind,
    });
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
          <div className="text-2xs text-muted">{formatSize(media.size)} · uploaded</div>
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
        <span className="text-2xs text-muted">{t("PNG, JPG, MP4 · jusqu'à 25 Mo", "PNG, JPG, MP4 · up to 25MB")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
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
