"use client";

import { useRef, useState } from "react";

export interface UploadedImage {
  url: string;
  name: string;
  size: number;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/svg+xml";

function validate(file: File): string | null {
  if (!/^image\//.test(file.type)) return "Only image files (PNG, JPG, SVG) are accepted.";
  if (file.size > MAX_BYTES) return "Image is over 5MB. Please choose a smaller file.";
  return null;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Reusable image upload control with click + drag-and-drop, 5MB image-only
 * validation, and an object-URL preview (frontend-only — no backend).
 *
 * variant:
 *  - "zone"   → dropzone with inline thumbnail/filename/remove (forms)
 *  - "avatar" → circular chip with camera overlay (Profile)
 *  - "logo"   → rounded-square chip with camera overlay (Organization)
 */
export function ImageUpload({
  value,
  onChange,
  variant = "zone",
  fallback,
  label = "Drop a logo file here, or click to upload (PNG, JPG, SVG · up to 5MB)",
}: {
  value: UploadedImage | null;
  onChange: (img: UploadedImage | null) => void;
  variant?: "zone" | "avatar" | "logo";
  fallback?: React.ReactNode; // initials shown when no image (avatar/logo)
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = (file?: File) => {
    if (!file) return;
    const err = validate(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onChange({ url: URL.createObjectURL(file), name: file.name, size: file.size });
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => {
        accept(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  // ── Shaped chip variants (avatar / logo) ──────────────────────────
  if (variant === "avatar" || variant === "logo") {
    const shape = variant === "avatar" ? "rounded-full" : "rounded-md";
    return (
      <div>
        <div className="flex items-center gap-3">
          <div
            className="relative"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files?.[0]); }}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center overflow-hidden ${shape} bg-page text-sm font-bold text-white ${
                dragOver ? "ring-2 ring-ai-text" : ""
              }`}
            >
              {value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.url} alt="upload" className="h-full w-full object-cover" />
              ) : (
                fallback
              )}
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-hair border-hair bg-card text-muted shadow-sm hover:text-ink"
              aria-label="Upload image"
            >
              <CameraIcon />
            </button>
          </div>
          <div className="text-2xs text-muted">
            {value ? (
              <>
                <div className="font-medium text-ink">{value.name}</div>
                <div>{formatSize(value.size)}</div>
                <button type="button" onClick={() => onChange(null)} className="mt-0.5 text-red-600 hover:underline">
                  Remove
                </button>
              </>
            ) : (
              <>JPG, PNG or SVG · up to 5MB. Drag &amp; drop or click the camera.</>
            )}
          </div>
        </div>
        {error && <div className="mt-1 text-2xs text-red-600">{error}</div>}
        {hiddenInput}
      </div>
    );
  }

  // ── Dropzone variant (forms) ──────────────────────────────────────
  if (value) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-md border-hair border-hair bg-canvas p-2">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border-hair border-hair bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.url} alt={value.name} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-ink">{value.name}</div>
            <div className="text-2xs text-muted">{formatSize(value.size)}</div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove image"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-hair hover:text-ink"
          >
            ✕
          </button>
        </div>
        {hiddenInput}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files?.[0]); }}
        className={`flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-3 text-left text-2xs transition-colors ${
          dragOver ? "border-ai-text bg-ai-textbg text-ai-text" : "border-hair bg-canvas/60 text-muted hover:bg-canvas"
        }`}
      >
        <UploadIcon />
        <span>{label}</span>
      </button>
      {error && <div className="mt-1 text-2xs text-red-600">{error}</div>}
      {hiddenInput}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M5 8h3l2-2h4l2 2h3a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
