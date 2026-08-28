// Fournisseur Pixabay — photos et vidéos (mission bibliothèque, chapitre 5).
//
// ≈100 req/minute. Politique de fichier stricte : lien direct permanent
// INTERDIT — téléchargement obligatoire sur notre serveur à l'acquisition
// (PROVIDER_POLICY.pixabay.rehost), et cache mutualisé de 24 h (déjà la
// valeur plancher d'ASSETS_CACHE_TTL_SECONDS). Aucune attribution requise.

import { env, isPixabayConfigured } from "@/lib/env";
import type { AssetKind, AssetResult } from "../types";

const IMAGE_ENDPOINT = "https://pixabay.com/api/";
const VIDEO_ENDPOINT = "https://pixabay.com/api/videos/";

interface PixabayImageHit {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
}

interface PixabayVideoHit {
  id: number;
  duration: number;
  picture_id: string;
  videos: {
    medium?: { url: string; width: number; height: number; size: number };
    small?: { url: string; width: number; height: number; size: number };
    large?: { url: string; width: number; height: number; size: number };
  };
}

async function fetchPixabay<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function searchPixabay(query: string, kinds: AssetKind[], page = 1): Promise<AssetResult[]> {
  if (!isPixabayConfigured) return [];
  const out: AssetResult[] = [];
  const q = encodeURIComponent(query);
  const key = encodeURIComponent(env.pixabayApiKey);

  if (kinds.includes("image")) {
    const data = await fetchPixabay<{ hits: PixabayImageHit[] }>(
      `${IMAGE_ENDPOINT}?key=${key}&q=${q}&image_type=photo&per_page=15&page=${page}&safesearch=true`
    );
    for (const h of data?.hits ?? []) {
      out.push({
        provider: "pixabay",
        providerId: String(h.id),
        kind: "image",
        previewUrl: h.webformatURL,
        sourceUrl: h.largeImageURL,
        width: h.imageWidth,
        height: h.imageHeight,
        license: "pixabay",
        attributionRequired: false,
      });
    }
  }

  if (kinds.includes("video")) {
    const data = await fetchPixabay<{ hits: PixabayVideoHit[] }>(
      `${VIDEO_ENDPOINT}?key=${key}&q=${q}&per_page=15&page=${page}&safesearch=true`
    );
    for (const h of data?.hits ?? []) {
      // Définition intermédiaire plutôt que "large" (§6.4).
      const file = h.videos.medium ?? h.videos.small ?? h.videos.large;
      if (!file) continue;
      out.push({
        provider: "pixabay",
        providerId: String(h.id),
        kind: "video",
        previewUrl: `https://i.vimeocdn.com/video/${h.picture_id}_295x166.jpg`,
        sourceUrl: file.url,
        width: file.width,
        height: file.height,
        durationSec: h.duration,
        bytes: file.size,
        license: "pixabay",
        attributionRequired: false,
      });
    }
  }

  return out;
}
