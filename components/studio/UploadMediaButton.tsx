"use client";

// ── UploadMediaButton — « 📤 Importer » un média RÉALISÉ PAR L'UTILISATEUR ─────
// Bouton d'import direct depuis l'ordinateur : le fichier (image ou vidéo) est
// hébergé sur le stockage (URL https stable — jamais de data-URI dans les
// requêtes), enregistré dans la médiathèque, puis renvoyé via onUploaded.
// Utilisé par les espaces réseau (LinkedIn, Facebook, Instagram, TikTok…) pour
// joindre ses propres visuels/vidéos à une publication.

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";

const ACCEPT_ATTR: Record<"image" | "video" | "all", string> = {
  image: "image/*",
  video: "video/*",
  all: "image/*,video/*",
};

export function UploadMediaButton({
  companyId,
  accept = "all",
  label,
  className,
  onUploaded,
}: {
  companyId: string;
  /** Types de fichiers proposés (contrainte du réseau cible). */
  accept?: "image" | "video" | "all";
  label?: string;
  className?: string;
  /** URL publique hébergée + type détecté du fichier. */
  onUploaded: (url: string, kind: "image" | "video") => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setErr(null);
    const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
    const sb = createClient();
    if (!sb) {
      setErr(t("Stockage indisponible — ajoutez le média via la bibliothèque.", "Storage unavailable — add the media via the library."));
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "png"))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${companyId}/upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await sb.storage.from("sh-videos").upload(path, file, {
        contentType: file.type || undefined,
        upsert: true,
      });
      if (error) { setErr(t(`Échec de l'import : ${error.message}`, `Upload failed: ${error.message}`)); return; }
      const { data } = sb.storage.from("sh-videos").getPublicUrl(path);
      const url = data?.publicUrl;
      if (!url) { setErr(t("Échec de l'import.", "Upload failed.")); return; }
      // Enregistre dans la médiathèque (réutilisable partout) — non bloquant.
      fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, url, type: kind, source: "upload" }),
      }).catch(() => {});
      onUploaded(url, kind);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Échec de l'import.", "Upload failed."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = ""; // permet de réimporter le même fichier
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR[accept]}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={className ?? "btn-secondary text-2xs"}
        title={t("Importer un média depuis votre ordinateur", "Upload a media file from your computer")}
      >
        {busy ? (
          <span className="inline-flex items-center gap-1"><Spinner size={12} className="text-current" /> {t("Import…", "Uploading…")}</span>
        ) : (
          label ?? t("📤 Importer", "📤 Upload")
        )}
      </button>
      {err && <span className="text-2xs text-danger-600">{err}</span>}
    </>
  );
}
