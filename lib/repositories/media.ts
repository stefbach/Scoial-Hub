// Bibliothèque média : stocke et liste les visuels/vidéos d'une société.
// Source unique réutilisable partout (studios, campagnes, composer…).

import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

export interface MediaAsset {
  url: string;
  type: "image" | "video";
  format?: string;
  source?: string;
  prompt?: string;
  createdAt?: string;
}

/** Enregistre un asset dans la bibliothèque (idempotent par company+url). */
export async function saveMediaAsset(
  companyId: string,
  asset: { url: string; type?: "image" | "video"; format?: string; source?: string; prompt?: string }
): Promise<void> {
  if (!asset.url || !/^https?:\/\//i.test(asset.url)) return;
  const sb = createAdminClient();
  if (!sb) return;
  const uuid = await resolveCompanyUuid(companyId);
  await sb.from("sh_media_assets").upsert(
    {
      company_id: uuid,
      url: asset.url,
      type: asset.type ?? "image",
      format: asset.format ?? null,
      source: asset.source ?? null,
      prompt: asset.prompt ?? null,
    },
    { onConflict: "company_id,url" }
  );
}

/** Liste la bibliothèque (assets stockés) + le logo/charte du brand kit. */
export async function listMediaAssets(companyId: string, limit = 60): Promise<MediaAsset[]> {
  const sb = createAdminClient();
  if (!sb) return [];
  const uuid = await resolveCompanyUuid(companyId);
  const out: MediaAsset[] = [];

  const { data } = await sb
    .from("sh_media_assets")
    .select("url, type, format, source, prompt, created_at")
    .eq("company_id", uuid)
    .order("created_at", { ascending: false })
    .limit(limit);
  for (const r of data ?? []) {
    out.push({
      url: String(r.url),
      type: (r.type === "video" ? "video" : "image"),
      format: r.format ? String(r.format) : undefined,
      source: r.source ? String(r.source) : undefined,
      createdAt: r.created_at ? String(r.created_at) : undefined,
    });
  }

  // Ajoute le logo + la charte du brand kit (toujours disponibles).
  try {
    const { data: bk } = await sb.from("sh_brand_kits").select("logo_url, charte_url").eq("company_id", uuid).maybeSingle();
    const extra = [
      { url: bk?.logo_url, source: "brand-kit:logo" },
      { url: bk?.charte_url, source: "brand-kit:charte" },
    ];
    for (const e of extra) {
      if (e.url && typeof e.url === "string" && /^https?:\/\//i.test(e.url) && !out.some((a) => a.url === e.url)) {
        out.push({ url: e.url, type: "image", source: e.source });
      }
    }
  } catch { /* ignore */ }

  return out;
}
