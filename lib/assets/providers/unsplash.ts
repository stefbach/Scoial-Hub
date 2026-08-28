// Fournisseur Unsplash — photos (mission bibliothèque, chapitre 5).
//
// 50 req/h en démonstration, relevé après validation de production. Lien
// direct attendu, mais APPEL OBLIGATOIRE au point de suivi de téléchargement
// à chaque usage effectif (PROVIDER_POLICY.unsplash.track) — c'est la seule
// condition non négociable de leurs directives API. Attribution photographe +
// Unsplash obligatoire partout où le média apparaît.

import { env, isUnsplashConfigured } from "@/lib/env";
import type { AssetKind, AssetResult } from "../types";

const SEARCH_ENDPOINT = "https://api.unsplash.com/search/photos";

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  urls: { regular: string; small: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
}

export async function searchUnsplash(query: string, kinds: AssetKind[], page = 1): Promise<AssetResult[]> {
  // Unsplash ne couvre que les photos : les autres types n'appellent jamais
  // ce fournisseur (§5.1) — la vérification du type évite un appel inutile.
  if (!isUnsplashConfigured || !kinds.includes("image")) return [];

  try {
    const res = await fetch(
      `${SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&per_page=15&page=${page}`,
      {
        headers: { Authorization: `Client-ID ${env.unsplashAccessKey}` },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results: UnsplashPhoto[] };
    return (data.results ?? []).map((p) => ({
      provider: "unsplash" as const,
      providerId: p.id,
      kind: "image" as const,
      previewUrl: p.urls.small,
      sourceUrl: p.urls.regular,
      width: p.width,
      height: p.height,
      author: p.user.name,
      authorUrl: p.user.links.html,
      license: "unsplash",
      attributionRequired: true,
      downloadTrackUrl: p.links.download_location,
    }));
  } catch {
    return [];
  }
}

/**
 * Point de suivi de téléchargement — Unsplash l'exige à chaque usage
 * EFFECTIF, pas à la recherche. Appelé uniquement à l'acquisition
 * (lib/assets/gateway.ts#acquireAsset). Ne throw jamais : un suivi manqué ne
 * doit pas empêcher l'insertion du média dans le montage.
 */
export async function trackUnsplashDownload(downloadTrackUrl: string): Promise<void> {
  try {
    await fetch(downloadTrackUrl, {
      headers: { Authorization: `Client-ID ${env.unsplashAccessKey}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Dégradation propre — voir le commentaire ci-dessus.
  }
}
