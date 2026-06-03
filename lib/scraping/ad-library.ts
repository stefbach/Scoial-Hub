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
}

export async function fetchAds(
  input: FetchAdsInput
): Promise<{ ads: AdEntry[]; error?: string }> {
  const token = adLibraryToken();
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
    const ads = (data.data ?? [])
      .map(mapAd)
      // Tri par impressions décroissantes (dispo pour les pubs politiques/sociales).
      .sort((a, b) => b.impressionsHigh - a.impressionsHigh);
    return { ads };
  } catch (err) {
    return { ads: [], error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}
