// Connecteur Bibliothèque publicitaire Meta (Facebook Ad Library API).
// Données RÉELLES des publicités concurrentes sur Facebook/Instagram.
// Token : META_AD_LIBRARY_TOKEN (token UTILISATEUR "EAA…", identité vérifiée
// pour les pubs politiques/sociales). Endpoint : graph.facebook.com/.../ads_archive

const GRAPH = "https://graph.facebook.com/v21.0/ads_archive";

export const adLibraryToken = (): string => process.env.META_AD_LIBRARY_TOKEN ?? "";
export const isAdLibraryConfigured = (): boolean => Boolean(adLibraryToken());

export interface AdEntry {
  id: string;
  pageName: string;
  body: string;
  linkTitle: string;
  impressionsLow: number;
  impressionsHigh: number;
  spendLow: number;
  spendHigh: number;
  currency: string;
  startTime: string;
  platforms: string[];
  snapshotUrl: string;
}

interface RawAd {
  id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  impressions?: { lower_bound?: string; upper_bound?: string };
  spend?: { lower_bound?: string; upper_bound?: string };
  currency?: string;
  ad_delivery_start_time?: string;
  publisher_platforms?: string[];
  ad_snapshot_url?: string;
}

function num(v: unknown): number {
  return typeof v === "string" ? parseInt(v, 10) || 0 : typeof v === "number" ? v : 0;
}

function mapAd(a: RawAd): AdEntry {
  return {
    id: String(a.id ?? ""),
    pageName: a.page_name ?? "",
    body: a.ad_creative_bodies?.[0] ?? "",
    linkTitle: a.ad_creative_link_titles?.[0] ?? "",
    impressionsLow: num(a.impressions?.lower_bound),
    impressionsHigh: num(a.impressions?.upper_bound),
    spendLow: num(a.spend?.lower_bound),
    spendHigh: num(a.spend?.upper_bound),
    currency: a.currency ?? "",
    startTime: a.ad_delivery_start_time ?? "",
    platforms: a.publisher_platforms ?? [],
    snapshotUrl: a.ad_snapshot_url ?? "",
  };
}

export interface FetchAdsInput {
  country?: string;
  searchTerms?: string;
  searchPageIds?: string[];
  adType?: "POLITICAL_AND_ISSUE_ADS" | "ALL";
  limit?: number;
  /** Token explicite (token utilisateur d'une société connectée) — prioritaire. */
  token?: string;
}

export async function fetchAds(
  input: FetchAdsInput
): Promise<{ ads: AdEntry[]; error?: string; metricsAvailable?: boolean }> {
  const token = input.token || adLibraryToken();
  if (!token) return { ads: [], error: "Token Ad Library absent (META_AD_LIBRARY_TOKEN)." };

  const url = new URL(GRAPH);
  url.searchParams.set("ad_type", input.adType ?? "POLITICAL_AND_ISSUE_ADS");
  url.searchParams.set("ad_reached_countries", JSON.stringify([input.country || "MU"]));
  url.searchParams.set("ad_active_status", "ACTIVE");
  if (input.searchPageIds && input.searchPageIds.length > 0) {
    url.searchParams.set("search_page_ids", JSON.stringify(input.searchPageIds));
  } else if (input.searchTerms) {
    url.searchParams.set("search_terms", input.searchTerms);
  } else {
    url.searchParams.set("search_terms", ".");
  }
  url.searchParams.set(
    "fields",
    "id,page_name,ad_creative_bodies,ad_creative_link_titles,impressions,spend,currency,ad_delivery_start_time,publisher_platforms,ad_snapshot_url"
  );
  url.searchParams.set("limit", String(Math.min(input.limit ?? 40, 100)));
  url.searchParams.set("access_token", token);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      data?: RawAd[];
      error?: { message?: string; error_user_msg?: string };
    };
    if (data.error) {
      return { ads: [], error: data.error.error_user_msg || data.error.message || "Erreur Ad Library" };
    }
    // LIMITATION Meta Ad Library : les champs `impressions` et `spend` ne sont
    // renvoyés QUE pour ad_type=POLITICAL_AND_ISSUE_ADS (pubs politiques/sociales,
    // identité vérifiée). En mode "ALL", ces champs reviennent vides (0) — il ne
    // faut donc NI les afficher comme une donnée fiable NI trier dessus.
    const adTypeUsed = input.adType ?? "POLITICAL_AND_ISSUE_ADS";
    const metricsAvailable = adTypeUsed === "POLITICAL_AND_ISSUE_ADS";

    const mapped = (data.data ?? []).map(mapAd);
    // Tri par impressions décroissantes uniquement quand la métrique existe.
    const ads = metricsAvailable
      ? mapped.sort((a, b) => b.impressionsHigh - a.impressionsHigh)
      : mapped;
    return { ads, metricsAvailable };
  } catch (err) {
    return { ads: [], error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Source alternative : ScrapeCreators — Facebook Ad Library
   Accessible avec la SEULE clé SCRAPECREATORS_API_KEY (header x-api-key), sans
   token Meta ni identité vérifiée. Idéal quand META_AD_LIBRARY_TOKEN est absent.
   Endpoint : GET /v1/facebook/adLibrary/search/ads
───────────────────────────────────────────────────────────────────────────── */

const SC_ADLIB = "https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads";

export const scrapeCreatorsKey = (): string => process.env.SCRAPECREATORS_API_KEY ?? "";
export const isScrapeCreatorsConfigured = (): boolean => Boolean(scrapeCreatorsKey());

interface ScAdSnapshot {
  body?: { text?: string };
  title?: string;
  link_description?: string;
  caption?: string;
  cta_type?: string;
  page_name?: string;
  images?: Array<{ original_image_url?: string; resized_image_url?: string }>;
  videos?: Array<{ video_preview_image_url?: string; video_hd_url?: string; video_sd_url?: string }>;
}
interface ScAd {
  ad_archive_id?: string;
  page_id?: string;
  page_name?: string;
  is_active?: boolean;
  start_date?: number;
  publisher_platform?: string[];
  impressions_with_index?: { impressions_text?: string | null };
  spend?: string | null;
  snapshot?: ScAdSnapshot;
}

/** Convertit un timestamp Unix (secondes) en ISO ; tolère déjà-ISO ou vide. */
function unixToIso(ts: unknown): string {
  if (typeof ts === "number" && ts > 0) return new Date(ts * 1000).toISOString();
  if (typeof ts === "string" && ts) {
    const n = Number(ts);
    if (!Number.isNaN(n) && n > 0) return new Date(n * 1000).toISOString();
    return ts; // déjà une date lisible
  }
  return "";
}

function mapScAd(a: ScAd): AdEntry {
  const snap = a.snapshot ?? {};
  const thumb =
    snap.images?.[0]?.resized_image_url ??
    snap.images?.[0]?.original_image_url ??
    snap.videos?.[0]?.video_preview_image_url ??
    "";
  return {
    id: String(a.ad_archive_id ?? ""),
    pageName: a.page_name ?? snap.page_name ?? "",
    body: snap.body?.text ?? "",
    linkTitle: snap.title ?? snap.link_description ?? snap.caption ?? "",
    // ScrapeCreators (comme Meta) ne renvoie impressions/spend que pour les pubs
    // politiques/sociales — non fiables ici, on laisse 0.
    impressionsLow: 0,
    impressionsHigh: 0,
    spendLow: 0,
    spendHigh: 0,
    currency: "",
    startTime: unixToIso(a.start_date),
    platforms: a.publisher_platform ?? [],
    // Lien direct vers la fiche dans la Meta Ad Library.
    snapshotUrl: a.ad_archive_id
      ? `https://www.facebook.com/ads/library/?id=${a.ad_archive_id}`
      : "",
  };
}

export async function fetchAdsScrapeCreators(
  input: FetchAdsInput
): Promise<{ ads: AdEntry[]; error?: string; metricsAvailable?: boolean }> {
  const key = scrapeCreatorsKey();
  if (!key) return { ads: [], error: "SCRAPECREATORS_API_KEY absent." };

  const url = new URL(SC_ADLIB);
  // La recherche par mot-clé est requise. À défaut, on élargit avec un point.
  url.searchParams.set("query", input.searchTerms?.trim() || ".");
  if (input.country) url.searchParams.set("country", input.country.toUpperCase());
  url.searchParams.set("ad_type", input.adType === "POLITICAL_AND_ISSUE_ADS" ? "political_and_issue_ads" : "all");
  url.searchParams.set("status", "ACTIVE");
  url.searchParams.set("trim", "true");

  try {
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": key, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ads: [], error: `ScrapeCreators Ad Library: ${res.status} ${txt}`.trim() };
    }
    const data = (await res.json().catch(() => ({}))) as {
      searchResults?: ScAd[];
      results?: ScAd[];
      data?: ScAd[];
    };
    const raw = data.searchResults ?? data.results ?? data.data ?? [];
    const ads = raw.map(mapScAd).filter((a) => a.id);
    // Métriques non fiables hors pubs politiques → comme la voie Meta.
    const metricsAvailable = false;
    return { ads: ads.slice(0, input.limit ?? 40), metricsAvailable };
  } catch (err) {
    return { ads: [], error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}
