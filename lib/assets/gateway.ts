// Passerelle d'assets — point d'entrée SERVEUR unique (mission bibliothèque,
// chapitre 6). Recherche et acquisition passent TOUJOURS par ici : c'est ce
// qui garantit qu'aucune clé de fournisseur ne quitte jamais le serveur
// (règle 6), que le cache est mutualisé (§6.4) et que la politique de fichier
// de chaque fournisseur est appliquée sans exception (règle 3).

import { isCoverrConfigured, isPexelsConfigured, isPixabayConfigured, isUnsplashConfigured } from "@/lib/env";
import { searchCoverr } from "./providers/coverr";
import { searchPexels } from "./providers/pexels";
import { searchPixabay } from "./providers/pixabay";
import { searchUnsplash, trackUnsplashDownload } from "./providers/unsplash";
import { rehostAsset } from "./rehost";
import { cacheKey, readCache, writeCache } from "./cache";
import { PROVIDER_POLICY, type AssetProvenance, type AssetResult, type AssetSearchQuery } from "./types";

/** Fournisseurs configurés — un fournisseur absent est masqué, sans erreur. */
export function configuredProviders(): string[] {
  const out: string[] = [];
  if (isPexelsConfigured) out.push("pexels");
  if (isCoverrConfigured) out.push("coverr");
  if (isPixabayConfigured) out.push("pixabay");
  if (isUnsplashConfigured) out.push("unsplash");
  return out;
}

/**
 * Recherche mutualisée. Aucun fournisseur configuré → tableau vide, sans
 * erreur ni exception (dégradation obligatoire, chapitre 10). Un fournisseur
 * en échec (quota, panne, latence) n'empêche jamais les autres de répondre :
 * chaque appel est isolé et ses erreurs absorbées AU NIVEAU DU FOURNISSEUR
 * (voir chaque module dans providers/), Promise.allSettled ici est une
 * seconde ligne de défense.
 */
export async function searchAssets(query: AssetSearchQuery): Promise<AssetResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const key = cacheKey(query);
  const cached = readCache(key);
  if (cached) return cached;

  const calls = [
    searchPexels(q, query.kinds, query.page),
    searchCoverr(q, query.kinds, query.page),
    searchPixabay(q, query.kinds, query.page),
    searchUnsplash(q, query.kinds, query.page),
  ];
  const settled = await Promise.allSettled(calls);
  const results = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  writeCache(key, results);
  return results;
}

/** Un média déjà acquis par un autre client — jamais stocké deux fois. */
const acquiredCache = new Map<string, { url: string; bytes: number }>();
const dedupeKey = (provider: string, providerId: string) => `${provider}:${providerId}`;

export interface AcquireOutcome {
  url: string;
  bytes?: number;
  provenance: AssetProvenance;
}

/**
 * Acquisition — appelée au premier EXPORT du montage, jamais à l'insertion
 * (copie différée, §6.4). Applique la politique du fournisseur (règle 3),
 * déclenche l'appel de suivi s'il est exigé, et renvoie la provenance à
 * écrire dans le document de projet AU MOMENT de cet appel (règle 4).
 */
export async function acquireAsset(companyId: string, asset: AssetResult): Promise<AcquireOutcome | { error: string }> {
  const provenance: AssetProvenance = {
    provider: asset.provider,
    providerId: asset.providerId,
    author: asset.author,
    authorUrl: asset.authorUrl,
    license: asset.license,
    sourceUrl: asset.sourceUrl,
  };

  if (asset.provider === "internal") {
    return { url: asset.sourceUrl, bytes: asset.bytes, provenance };
  }

  const policy = PROVIDER_POLICY[asset.provider];
  const dkey = dedupeKey(asset.provider, asset.providerId);
  const already = acquiredCache.get(dkey);

  if (policy.track && asset.downloadTrackUrl) {
    // Le suivi porte sur l'USAGE, pas sur le stockage : il est redéclenché à
    // chaque acquisition même si le fichier est déjà rehébergé.
    void trackUnsplashDownload(asset.downloadTrackUrl);
  }

  if (!policy.rehost) {
    return { url: asset.sourceUrl, bytes: asset.bytes, provenance };
  }

  if (already) return { url: already.url, bytes: already.bytes, provenance };

  const hosted = await rehostAsset(companyId, asset.sourceUrl, asset.provider, asset.providerId);
  if (!hosted.url) return { error: hosted.error ?? "Acquisition impossible" };

  acquiredCache.set(dkey, { url: hosted.url, bytes: hosted.bytes ?? asset.bytes ?? 0 });
  return { url: hosted.url, bytes: hosted.bytes ?? asset.bytes, provenance };
}

/** Exposé pour les scripts de vérification uniquement. */
export function clearAcquiredCacheForTests(): void {
  acquiredCache.clear();
}
