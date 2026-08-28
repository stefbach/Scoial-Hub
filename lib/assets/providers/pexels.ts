// Fournisseur Pexels — photos et vidéos (mission bibliothèque, chapitre 5).
//
// Quota 200 req/h · 20 000/mois pour l'ensemble de la plateforme (une seule
// clé) : voir lib/assets/cache.ts pour la mutualisation qui le protège.
// Rehébergement libre ; lien visible vers Pexels exigé par leurs règles
// d'usage (attributionRequired: true dans PROVIDER_POLICY).

import { env, isPexelsConfigured } from "@/lib/env";
import type { AssetKind, AssetResult } from "../types";

const PHOTO_ENDPOINT = "https://api.pexels.com/v1/search";
const VIDEO_ENDPOINT = "https://api.pexels.com/videos/search";

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  src: { large: string; medium: string; original: string };
}

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

/** Définition intermédiaire plutôt que la maximale — limite le poids transmis
 * au navigateur et les bascules vers le rendu serveur (§6.4). */
function bestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  const hd = files.filter((f) => f.quality === "hd" || f.quality === "sd");
  const pool = hd.length > 0 ? hd : files;
  return [...pool].sort((a, b) => a.width - b.width)[Math.floor(pool.length / 2)] ?? pool[0];
}

async function fetchPexels<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: env.pexelsApiKey },
      // Les recherches se font à la validation, jamais à la frappe (§6.4) —
      // aucun besoin d'un délai d'expiration agressif ici.
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Dégradation propre : un fournisseur en échec ne fait jamais échouer la
    // recherche entière (§6.4) — l'appelant reçoit simplement [].
    return null;
  }
}

export async function searchPexels(query: string, kinds: AssetKind[], page = 1): Promise<AssetResult[]> {
  if (!isPexelsConfigured) return [];
  const out: AssetResult[] = [];
  const q = encodeURIComponent(query);

  if (kinds.includes("image")) {
    const data = await fetchPexels<{ photos: PexelsPhoto[] }>(
      `${PHOTO_ENDPOINT}?query=${q}&per_page=15&page=${page}`
    );
    for (const p of data?.photos ?? []) {
      out.push({
        provider: "pexels",
        providerId: String(p.id),
        kind: "image",
        previewUrl: p.src.medium,
        sourceUrl: p.src.large,
        width: p.width,
        height: p.height,
        author: p.photographer,
        authorUrl: p.photographer_url,
        license: "pexels",
        attributionRequired: true,
      });
    }
  }

  if (kinds.includes("video")) {
    const data = await fetchPexels<{ videos: PexelsVideo[] }>(
      `${VIDEO_ENDPOINT}?query=${q}&per_page=15&page=${page}`
    );
    for (const v of data?.videos ?? []) {
      const file = bestVideoFile(v.video_files);
      if (!file) continue;
      out.push({
        provider: "pexels",
        providerId: String(v.id),
        kind: "video",
        previewUrl: v.image,
        sourceUrl: file.link,
        width: file.width,
        height: file.height,
        durationSec: v.duration,
        author: v.user.name,
        authorUrl: v.user.url,
        license: "pexels",
        attributionRequired: true,
      });
    }
  }

  return out;
}
