/**
 * GET /api/creatives?companyId=&q=&country=
 *
 * Agrège des créas existantes à utiliser comme INSPIRATION dans la création :
 *  - source "ad"    : pubs réelles (Ad Library via ScrapeCreators). Tapez votre
 *                     propre marque (= vos pubs) ou un concurrent (= ses pubs).
 *  - source "veille": contenus organiques concurrents du dernier run de veille.
 *
 * Ne renvoie jamais d'erreur fatale : si une source échoue, on renvoie le reste.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { fetchAdsScrapeCreators, isScrapeCreatorsConfigured } from "@/lib/scraping/ad-library";
import type { CompetitorContent } from "@/lib/scraping/types";

export interface CreativeItem {
  id: string;
  source: "ad" | "veille";
  /** Marque / compte d'origine (nom de page ou @handle). */
  origin: string;
  platform: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string;
  caption: string;
  url: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const country = (req.nextUrl.searchParams.get("country") ?? "").trim();

  if (!companyId) {
    return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  }

  const creatives: CreativeItem[] = [];

  // 1. Pubs (Ad Library via ScrapeCreators) — nécessite un mot-clé.
  if (q && isScrapeCreatorsConfigured()) {
    try {
      const { ads } = await fetchAdsScrapeCreators({
        searchTerms: q,
        country: country || undefined,
        adType: "ALL",
        limit: 24,
      });
      for (const a of ads) {
        if (!a.thumbnailUrl) continue; // sans visuel, inutile pour l'inspiration
        creatives.push({
          id: `ad-${a.id}`,
          source: "ad",
          origin: a.pageName || "—",
          platform: a.platforms[0] ?? "facebook",
          mediaType: a.mediaType ?? "image",
          thumbnailUrl: a.thumbnailUrl,
          caption: a.body || a.linkTitle || "",
          url: a.snapshotUrl,
        });
      }
    } catch (err) {
      console.warn("[creatives] ads source failed:", err);
    }
  }

  // 2. Veille — contenus organiques concurrents du dernier run terminé.
  if (isSupabaseConfigured) {
    try {
      const supabase = createAdminClient();
      if (supabase) {
        const uuid = await resolveCompanyUuid(companyId);
        const { data } = await supabase
          .from("sh_benchmark_runs")
          .select("results")
          .eq("company_id", uuid)
          .eq("status", "done")
          .order("finished_at", { ascending: false })
          .limit(1)
          .single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contents: CompetitorContent[] = (data as any)?.results?.scrape?.contents ?? [];
        for (const c of contents) {
          if (!c.thumbnailUrl) continue;
          creatives.push({
            id: `veille-${c.network}-${c.handle}-${c.url}`,
            source: "veille",
            origin: c.accountName ?? c.handle,
            platform: c.network,
            mediaType: c.type === "video" || c.type === "reel" ? "video" : "image",
            thumbnailUrl: c.thumbnailUrl,
            caption: c.caption ?? "",
            url: c.url,
          });
        }
      }
    } catch (err) {
      console.warn("[creatives] veille source failed:", err);
    }
  }

  return NextResponse.json({ creatives });
}
