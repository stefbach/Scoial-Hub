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

  /**
   * Téléverse un fichier (logo/charte) dans le bucket public `sh-logos` et
   * retourne son URL publique. Dégradation : retourne null si stockage absent.
   */
  const uploadAsset = useCallback(
    async (file: File, kind: "logo" | "charte"): Promise<string | null> => {
      if (!companyId) return null;
      const supabase = createClient();
      if (!supabase) return null;
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${companyId}/${kind}-${Date.now()}-${safe}`;
        const { error } = await supabase.storage
          .from("sh-logos")
          .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type || undefined });
        if (error) return null;
        const { data } = supabase.storage.from("sh-logos").getPublicUrl(path);
        return data.publicUrl;
      } catch {
        return null;
      }
    },
    [companyId]
  );

  return { kit: kit ?? (companyId ? makeEmptyBrandKit(companyId) : null), hasKit: !!kit, loading, saving, save, uploadAsset };
}
