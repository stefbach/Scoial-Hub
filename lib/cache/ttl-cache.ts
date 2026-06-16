// Cache mémoire à TTL + coalescing des requêtes en vol.
// But : réduire les appels répétés aux API externes (ex. Meta Graph) — moins de
// latence et de pression sur les rate-limits. Portée = process (instance
// serverless chaude) : la fraîcheur est bornée par le TTL, donc on l'utilise
// uniquement pour des lectures où une légère péremption est acceptable.
//
// `coalesce` garantit qu'un seul appel amont part même si N requêtes identiques
// arrivent en même temps (anti « thundering herd »).

interface Entry<T> { value: T; expires: number }

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Renvoie la valeur en cache si fraîche, sinon exécute `fn` (en dédupliquant les
 * appels concurrents) et met le résultat en cache pour `ttlMs`.
 */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const flying = inflight.get(key);
  if (flying) return flying as Promise<T>;

  const p = (async () => {
    try {
      const value = await fn();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p as Promise<T>;
}

/** Invalide toutes les entrées dont la clé commence par `prefix`. */
export function invalidate(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
