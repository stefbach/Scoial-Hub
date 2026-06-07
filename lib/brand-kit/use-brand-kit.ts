"use client";

// Hook client : charge le brand kit persistant d'une société et fournit des
// helpers pour l'enregistrer et téléverser logo/charte dans Supabase Storage
// (bucket public `sh-logos`). Réutilisable par Studio Affiches, Studio Vidéo et
// le Composer pour partager une identité visuelle cohérente.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandKit, makeEmptyBrandKit } from "@/lib/brand-kit/types";

export function useBrandKit(companyId: string | undefined) {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Chargement initial du kit persistant.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/brand-kit?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setKit((d.kit as BrandKit) ?? null);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  /** Enregistre un patch et met à jour l'état local. */
  const save = useCallback(
    async (patch: Partial<BrandKit>): Promise<BrandKit | null> => {
      if (!companyId) return null;
      setSaving(true);
      try {
        const res = await fetch("/api/brand-kit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, kit: patch }),
        });
        const d = await res.json();
        if (res.ok && d.kit) {
          setKit(d.kit as BrandKit);
          return d.kit as BrandKit;
        }
        return null;
      } catch {
        return null;
      } finally {
        setSaving(false);
      }
    },
    [companyId]
  );

  /** Remet le brand kit à zéro (logo, charte, palette, charte IA…). */
  const reset = useCallback(async (): Promise<BrandKit | null> => {
    if (!companyId) return null;
    setSaving(true);
    try {
      const res = await fetch(`/api/brand-kit?companyId=${encodeURIComponent(companyId)}`, {
        method: "DELETE",
      });
      const d = await res.json();
      if (res.ok && d.kit) {
        setKit(d.kit as BrandKit);
        return d.kit as BrandKit;
      }
      return null;
    } catch {
      return null;
    } finally {
      setSaving(false);
    }
  }, [companyId]);

  /**
   * Téléverse un blob (logo/charte, rasterisé en PNG côté appelant) dans le
   * bucket public `sh-logos` et retourne son URL publique. Dégradation :
   * retourne null si stockage absent ou si l'upload échoue.
   */
  const uploadAsset = useCallback(
    async (blob: Blob, kind: "logo" | "charte", fileName: string): Promise<string | null> => {
      if (!companyId) return null;
      const supabase = createClient();
      if (!supabase) return null;
      try {
        const safe = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") || `${kind}.png`;
        const path = `${companyId}/${kind}-${Date.now()}-${safe}`;
        const { error } = await supabase.storage
          .from("sh-logos")
          .upload(path, blob, { cacheControl: "3600", upsert: true, contentType: blob.type || "image/png" });
        if (error) {
          console.warn("[brand-kit] upload error:", error.message);
          return null;
        }
        const { data } = supabase.storage.from("sh-logos").getPublicUrl(path);
        return data.publicUrl;
      } catch {
        return null;
      }
    },
    [companyId]
  );

  return { kit: kit ?? (companyId ? makeEmptyBrandKit(companyId) : null), hasKit: !!kit, loading, saving, save, reset, uploadAsset };
}
