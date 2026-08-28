// Cache mutualisé des recherches d'assets — SERVEUR, jamais navigateur.
//
// POURQUOI CE MODULE EXISTE
// Le quota Pexels (200 requêtes/heure) est partagé par TOUS les clients de la
// plateforme, soit environ trois par minute. Un cache par navigateur ne
// protégerait qu'un seul client à la fois et ne satisferait pas non plus
// l'obligation Pixabay du cache de 24 h. La même recherche doit donc servir
// tout le monde depuis un seul point, ici.
//
// Implémentation en mémoire de processus : suffisant pour un seul serveur
// Next.js, mais ne se partage pas entre plusieurs instances derrière un
// répartiteur de charge. Une vraie mutualisation multi-instance demanderait
// une table Supabase ou un cache externe (Redis) — hors périmètre de cette
// passe d'architecture ; le contrat (clé, TTL, dégradation) est cependant
// déjà celui qu'un remplacement par un cache distribué respecterait.

import { env } from "@/lib/env";
import type { AssetResult, AssetSearchQuery } from "./types";

interface CacheEntry {
  results: AssetResult[];
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/** Clé stable : la même recherche (requête, types, page) doit taper le même cache. */
export function cacheKey(q: AssetSearchQuery): string {
  const kinds = [...q.kinds].sort().join(",");
  return `${q.query.trim().toLowerCase()}|${kinds}|${q.page ?? 1}`;
}

export function readCache(key: string): AssetResult[] | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.results;
}

export function writeCache(key: string, results: AssetResult[]): void {
  // N'occupe pas le cache avec une page blanche : une recherche sans résultat
  // reste retentée à la prochaine requête plutôt que de figer un vide pendant
  // 24 h (utile en particulier si les fournisseurs n'étaient pas TOUS injoignables).
  if (results.length === 0) return;
  store.set(key, { results, expiresAt: Date.now() + env.assetsCacheTtlSeconds * 1000 });
}

/** Exposé pour les scripts de vérification uniquement. */
export function clearCacheForTests(): void {
  store.clear();
}
