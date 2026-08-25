// Hébergement public d'un média — RÈGLE DE PLATEFORME, une seule implémentation.
//
// Instagram, Facebook et LinkedIn récupèrent le média depuis LEURS serveurs :
// une adresse `blob:` n'existe que dans l'onglet de l'utilisateur et leur est
// structurellement inaccessible. Tout média destiné à la publication doit donc
// être hébergé publiquement avant d'être transmis.
//
// Le composant d'import respectait cette règle ; l'éditeur média produisait une
// adresse `blob:` et la transmettait telle quelle — toute publication passée
// par l'éditeur était donc vouée à l'échec (audit A-06, gravité critique).
// La règle vit désormais ici, et les deux appelants l'utilisent.

import { createClient } from "@/lib/supabase/client";

/** Bucket public des médias de composition. */
const BUCKET = "sh-videos";

/**
 * Plafond d'import. Contrainte réelle : ffmpeg.wasm s'exécute en WebAssembly
 * 32 bits (~2 Go d'espace adressable, partagé entre l'entrée, la sortie et les
 * tampons). Au-delà d'environ 100 Mo de source, l'onglet se bloque. Le plafond
 * reste donc à 100 Mo tant que le rendu serveur n'absorbe pas les cas lourds.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Formats acceptés à l'import. */
export const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm";

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export interface HostResult {
  /** URL publique atteignable par les réseaux sociaux. */
  url?: string;
  /** Cause de l'échec, à afficher telle quelle. */
  error?: string;
}

/**
 * Téléverse un fichier ou un blob et renvoie son URL publique.
 * Ne throw jamais : l'appelant reçoit une URL ou une raison.
 *
 * @param folder sous-dossier logique (`compose`, `edited`…) — facilite le tri
 *               et le nettoyage ultérieur du bucket.
 */
export async function hostMedia(
  companyId: string,
  data: Blob | File,
  fileName: string,
  folder = "compose"
): Promise<HostResult> {
  if (!companyId) return { error: "companyId manquant" };
  const sb = createClient();
  if (!sb) return { error: "Stockage indisponible" };

  const safe = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") || "media";
  const path = `${companyId}/${folder}/${Date.now()}-${safe}`;
  const contentType = data.type || "application/octet-stream";

  try {
    const { error } = await sb.storage.from(BUCKET).upload(path, data, { upsert: true, contentType });
    if (error) return { error: error.message };
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    return pub?.publicUrl ? { url: pub.publicUrl } : { error: "URL publique introuvable" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Téléversement impossible" };
  }
}
