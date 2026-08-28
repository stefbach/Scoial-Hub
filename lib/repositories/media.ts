// Bibliothèque média : stocke et liste les visuels/vidéos d'une société.
// Source unique réutilisable partout (studios, campagnes, composer…).

import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { isSafeRemoteUrl } from "@/lib/security/url-guard";
import { isWebpUrl, isWebpBytes, toJpeg } from "@/lib/media/image-format";

export interface MediaAsset {
  url: string;
  type: "image" | "video";
  format?: string;
  source?: string;
  prompt?: string;
  createdAt?: string;
}

const STORAGE_BUCKET = "sh-videos";

/** Extension de fichier déduite du content-type (repli sur le type de média). */
function extFromContentType(ct: string, kind: "image" | "video"): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.startsWith("video")) return "mp4";
  return kind === "video" ? "mp4" : "png";
}

/**
 * Télécharge un média depuis une URL éphémère (Replicate / Shotstack / etc.) et
 * le stocke durablement sur Supabase Storage. Renvoie l'URL publique permanente,
 * ou l'URL d'origine en cas d'échec (dégradation gracieuse, jamais bloquant).
 * Idempotent : une URL déjà hébergée sur notre bucket est renvoyée telle quelle.
 */
export async function persistRemoteMedia(
  companyId: string,
  url: string,
  kind: "image" | "video" = "image"
): Promise<string> {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  if (url.includes(`/storage/v1/object/public/${STORAGE_BUCKET}/`)) return url;
  // Anti-SSRF : ne récupère jamais une URL pointant vers un hôte interne/privé.
  if (!isSafeRemoteUrl(url)) return url;
  try {
    const sb = createAdminClient();
    if (!sb) return url;
    const uuid = await resolveCompanyUuid(companyId);
    if (!uuid) return url;
    const resp = await fetch(url);
    if (!resp.ok) return url;
    let ct = resp.headers.get("content-type") || (kind === "video" ? "video/mp4" : "image/png");
    let buf: Buffer = Buffer.from(await resp.arrayBuffer());
    // WebP → JPEG dès la persistance : LinkedIn (JPG/PNG/GIF) et Instagram
    // (JPEG) refusent le WebP — un visuel stocké en WebP partirait sans image.
    if (kind === "image" && isWebpBytes(buf)) {
      try {
        buf = await toJpeg(buf);
        ct = "image/jpeg";
      } catch { /* conversion impossible → on stocke tel quel */ }
    }
    const ext = extFromContentType(ct, kind);
    const path = `${uuid}/persist/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, buf, { contentType: ct, upsert: true });
    if (error) return url;
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || url;
  } catch {
    return url;
  }
}

/**
 * Garantit qu'une URL d'image est PUBLIABLE sur les réseaux (LinkedIn,
 * Instagram, Facebook) : si elle pointe vers un WebP — format refusé par ces
 * APIs — l'image est convertie en JPEG, rehébergée sur le bucket public, et la
 * nouvelle URL est renvoyée. Sinon (ou en cas d'échec), l'URL d'origine est
 * renvoyée telle quelle. Couvre les posts programmés AVANT le passage de la
 * génération IA au JPEG, dont le média en base référence encore un .webp.
 */
export async function ensurePublishableImageUrl(
  companyId: string,
  url: string
): Promise<string> {
  if (!url || !isWebpUrl(url)) return url;
  if (!isSafeRemoteUrl(url)) return url;
  try {
    const sb = createAdminClient();
    if (!sb) return url;
    const uuid = await resolveCompanyUuid(companyId);
    if (!uuid) return url;
    const resp = await fetch(url);
    if (!resp.ok) return url;
    const jpeg = await toJpeg(Buffer.from(await resp.arrayBuffer()));
    const path = `${uuid}/persist/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) return url;
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || url;
  } catch {
    return url;
  }
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

/**
 * Supprime DÉFINITIVEMENT un média de la bibliothèque : la ligne en base
 * (sh_media_assets) ET, si le fichier est hébergé sur notre bucket Storage, le
 * fichier lui-même. Les visuels du brand kit (logo/charte) ne sont pas stockés
 * ici → non concernés. Ne throw jamais ; renvoie true si la ligne a été retirée.
 */
export async function deleteMediaAsset(companyId: string, url: string): Promise<boolean> {
  if (!url) return false;
  const sb = createAdminClient();
  if (!sb) return false;
  const uuid = await resolveCompanyUuid(companyId);

  // 1) Retire l'entrée de la bibliothèque (table).
  const { error } = await sb
    .from("sh_media_assets")
    .delete()
    .eq("company_id", uuid)
    .eq("url", url);
  if (error) console.error("[media] deleteMediaAsset row:", error);

  // 2) Supprime le fichier du Storage s'il est hébergé chez nous, et UNIQUEMENT
  //    dans le dossier de cette société (garde-fou anti-suppression croisée).
  try {
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
      if (path.startsWith(`${uuid}/`)) {
        await sb.storage.from(STORAGE_BUCKET).remove([path]);
      }
    }
  } catch (e) {
    console.warn("[media] deleteMediaAsset storage:", e);
  }

  return !error;
}

/** Liste la bibliothèque (assets stockés) + le logo/charte du brand kit. */
export async function listMediaAssets(companyId: string, limit = 1000): Promise<MediaAsset[]> {
  const sb = createAdminClient();
  if (!sb) return [];
  const uuid = await resolveCompanyUuid(companyId);
  const out: MediaAsset[] = [];
  const cap = Math.min(Math.max(limit, 1), 2000);

  const { data } = await sb
    .from("sh_media_assets")
    .select("url, type, format, source, prompt, created_at")
    .eq("company_id", uuid)
    .order("created_at", { ascending: false })
    .limit(cap);
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
