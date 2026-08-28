// Fournisseur Coverr — vidéos et musique (mission bibliothèque, chapitre 5).
//
// Quota 1 000 appels/mois en développement, 500 appels/minute en production.
// Rehébergement libre, aucune attribution exigée.
//
// AVERTISSEMENT DE FRAÎCHEUR : l'API publique de Coverr est moins stabilisée
// que celle des autres fournisseurs retenus. Les noms de champs ci-dessous
// sont une meilleure estimation à partir de leur documentation publique —
// à revérifier contre les conditions RÉELLEMENT en vigueur au moment de
// l'intégration (la lecture des conditions prime sur ce commentaire).

import { env, isCoverrConfigured } from "@/lib/env";
import type { AssetKind, AssetResult } from "../types";

const VIDEO_ENDPOINT = "https://api.coverr.co/videos";
const MUSIC_ENDPOINT = "https://api.coverr.co/music";

interface CoverrVideo {
  id: string;
  title?: string;
  poster: string;
  urls: { mp4_download?: string; mp4?: string };
  duration?: number;
  width?: number;
  height?: number;
}

interface CoverrTrack {
  id: string;
  title?: string;
  urls: { mp3_download?: string; mp3?: string };
  duration?: number;
}

async function fetchCoverr<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.coverrApiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function searchCoverr(query: string, kinds: AssetKind[], page = 1): Promise<AssetResult[]> {
  if (!isCoverrConfigured) return [];
  const out: AssetResult[] = [];
  const q = encodeURIComponent(query);

  if (kinds.includes("video")) {
    const data = await fetchCoverr<{ hits: CoverrVideo[] }>(`${VIDEO_ENDPOINT}?query=${q}&page_size=15&page=${page}`);
    for (const v of data?.hits ?? []) {
      const source = v.urls.mp4_download ?? v.urls.mp4;
      if (!source) continue;
      out.push({
        provider: "coverr",
        providerId: v.id,
        kind: "video",
        previewUrl: v.poster,
        sourceUrl: source,
        width: v.width,
        height: v.height,
        durationSec: v.duration,
        license: "coverr",
        attributionRequired: false,
      });
    }
  }

  if (kinds.includes("audio")) {
    const data = await fetchCoverr<{ hits: CoverrTrack[] }>(`${MUSIC_ENDPOINT}?query=${q}&page_size=15&page=${page}`);
    for (const t of data?.hits ?? []) {
      const source = t.urls.mp3_download ?? t.urls.mp3;
      if (!source) continue;
      out.push({
        provider: "coverr",
        providerId: t.id,
        kind: "audio",
        previewUrl: source,
        sourceUrl: source,
        durationSec: t.duration,
        license: "coverr",
        attributionRequired: false,
      });
    }
  }

  return out;
}
