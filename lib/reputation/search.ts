/**
 * lib/reputation/search.ts
 *
 * Recherche de mentions de marque sur le web et la presse. Server-only.
 *
 * DEUX FOURNISSEURS INTERCHANGEABLES, aucun obligatoire :
 *   - Brave Search   (BRAVE_SEARCH_API_KEY)  — le moins cher, recommandé
 *   - SerpAPI        (SERPAPI_KEY)           — repli
 *
 * Sans clé, la veille est DORMANTE : `isSearchConfigured()` renvoie false et
 * rien n'est appelé. Le jour où une clé est ajoutée, la veille démarre seule
 * sans redéploiement de code.
 *
 * Pourquoi pas les réseaux sociaux : Meta n'autorise plus la recherche par
 * mots-clés sur les publications publiques, X facture son API très cher et
 * LinkedIn n'expose aucune recherche publique. C'est la raison pour laquelle
 * l'écoute sociale est si chère chez les suites historiques — elles paient des
 * licences de données. La veille web et presse couvre l'essentiel du besoin
 * d'une PME à un coût sans commune mesure.
 */

const BRAVE_KEY = () => (process.env.BRAVE_SEARCH_API_KEY ?? "").trim();
const SERPAPI_KEY = () => (process.env.SERPAPI_KEY ?? "").trim();

export type SearchProvider = "brave" | "serpapi" | "none";

/** Fournisseur retenu, par ordre de préférence. */
export function searchProvider(): SearchProvider {
  if (BRAVE_KEY()) return "brave";
  if (SERPAPI_KEY()) return "serpapi";
  return "none";
}

export function isSearchConfigured(): boolean {
  return searchProvider() !== "none";
}

/** Un résultat de recherche, normalisé entre fournisseurs. */
export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  /** Nom de domaine, utile pour regrouper et afficher la source. */
  source: string;
  /** Date de publication si le fournisseur la donne. */
  publishedAt?: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Brave Search — https://api.search.brave.com */
async function braveSearch(query: string, limit: number): Promise<SearchHit[]> {
  const url =
    `https://api.search.brave.com/res/v1/web/search` +
    `?q=${encodeURIComponent(query)}&count=${limit}&freshness=pm`; // pm = mois écoulé
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": BRAVE_KEY() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Brave Search → HTTP ${res.status}`);
  const json = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
  };
  return (json.web?.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      title: String(r.title ?? ""),
      url: String(r.url),
      snippet: String(r.description ?? "").replace(/<[^>]+>/g, ""),
      source: hostOf(String(r.url)),
      publishedAt: r.age,
    }));
}

/** SerpAPI — https://serpapi.com */
async function serpapiSearch(query: string, limit: number): Promise<SearchHit[]> {
  const url =
    `https://serpapi.com/search.json` +
    `?engine=google&q=${encodeURIComponent(query)}&num=${limit}&tbs=qdr:m` +
    `&api_key=${encodeURIComponent(SERPAPI_KEY())}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`SerpAPI → HTTP ${res.status}`);
  const json = (await res.json()) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
  };
  return (json.organic_results ?? [])
    .filter((r) => r.link)
    .map((r) => ({
      title: String(r.title ?? ""),
      url: String(r.link),
      snippet: String(r.snippet ?? ""),
      source: hostOf(String(r.link)),
      publishedAt: r.date,
    }));
}

/**
 * Cherche des mentions. Ne throw jamais : une veille qui casse ne doit pas
 * faire échouer le cycle de pilotage qui l'héberge.
 */
export async function searchMentions(query: string, limit = 10): Promise<SearchHit[]> {
  const provider = searchProvider();
  if (provider === "none" || !query.trim()) return [];
  try {
    return provider === "brave"
      ? await braveSearch(query, limit)
      : await serpapiSearch(query, limit);
  } catch (e) {
    console.error("[reputation] recherche échouée :", e instanceof Error ? e.message : e);
    return [];
  }
}
