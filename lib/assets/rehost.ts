// Rehébergement serveur d'un asset externe — pendant de lib/media/host.ts,
// pour les fichiers rapatriés depuis un fournisseur plutôt qu'importés par
// l'utilisateur. Même bucket, pour que le reste du pipeline (export, quotas)
// ne voie qu'un seul type d'origine.
//
// COPIE DIFFÉRÉE (§6.4) : cette fonction n'est appelée qu'à l'ACQUISITION
// (premier export du montage), jamais à la recherche ni à l'insertion. Un
// utilisateur qui essaie dix vidéos avant d'en garder une ne doit pas en
// faire stocker dix — pendant l'édition, l'aperçu utilise l'adresse d'origine
// du fournisseur.

import { createClient } from "@/lib/supabase/server";

const BUCKET = "sh-videos";

export interface RehostResult {
  url?: string;
  bytes?: number;
  error?: string;
}

/** Rapatrie un fichier distant et renvoie son URL publique sur notre stockage. */
export async function rehostAsset(
  companyId: string,
  sourceUrl: string,
  provider: string,
  providerId: string
): Promise<RehostResult> {
  const sb = createClient();
  if (!sb) return { error: "Stockage indisponible" };

  let res: Response;
  try {
    res = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Téléchargement impossible" };
  }
  if (!res.ok) return { error: `HTTP ${res.status} à la source` };

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const ext = extensionFor(contentType);
  const path = `${companyId}/assets/${provider}-${providerId}-${Date.now()}${ext}`;

  const buffer = await res.arrayBuffer();
  try {
    const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { upsert: true, contentType });
    if (error) return { error: error.message };
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) return { error: "URL publique introuvable" };
    return { url: pub.publicUrl, bytes: buffer.byteLength };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Téléversement impossible" };
  }
}

function extensionFor(contentType: string): string {
  if (contentType.includes("mp4")) return ".mp4";
  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return ".mp3";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  return "";
}
