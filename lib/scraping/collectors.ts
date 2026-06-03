/**
 * Collecteurs de données concurrentielles par réseau social.
 *
 * Architecture :
 * - YouTube : YouTube Data API v3 (gratuit, 10 000 unités/jour) si YOUTUBE_API_KEY présent.
 * - Autres réseaux : endpoints publics oEmbed / pages publiques (best-effort, fetch natif).
 *   Les plateformes fermées (Instagram, TikTok, LinkedIn, Twitter/X) n'exposent pas
 *   d'API publique gratuite pour scraper les comptes tiers. Un scraping robuste
 *   nécessiterait une infrastructure dédiée (proxies rotatifs, headless browser,
 *   comptes connectés, conformité CGU). Ici on couvre le gratuit/officiel uniquement.
 * - Simulateur déterministe : génère des données réalistes et cohérentes pour
 *   tout réseau sans clé API, afin que l'interface reste pleinement fonctionnelle.
 */

import type { CompetitorContent, ScrapeNetwork, ScrapeQuery, ScrapeResult } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
   Utilitaires communs
───────────────────────────────────────────────────────────────────────────── */

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash simple d'une chaîne vers un entier (pour le seed). */
function strHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

/* ─────────────────────────────────────────────────────────────────────────────
   Interface commune des collecteurs
───────────────────────────────────────────────────────────────────────────── */

export interface Collector {
  network: ScrapeNetwork;
  /** Indique si ce collecteur opère en mode réel (true) ou simulé (false). */
  isReal: boolean;
  collect(query: ScrapeQuery): Promise<CompetitorContent[]>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Simulateur générique — déterministe par seed (handle + réseau + keywords)
───────────────────────────────────────────────────────────────────────────── */

const CAPTION_TEMPLATES: Record<ScrapeNetwork, string[]> = {
  youtube: [
    "Comment {keyword} a changé notre approche en {year} — résultats concrets",
    "{keyword} : le guide complet pour {geo} | Tuto pas-à-pas",
    "Pourquoi {keyword} est indispensable pour votre business en {year}",
    "On a testé {keyword} pendant 30 jours — voici ce qu'on a appris",
    "Top 10 des tendances {keyword} à suivre absolument",
  ],
  instagram: [
    "✨ {keyword} comme vous ne l'avez jamais vu. Sauvegardez ce post ! #trending",
    "Notre secret pour {keyword} 🚀 Taguez un ami qui a besoin de voir ça !",
    "💡 Thread : {keyword} en 5 étapes simples. Quel est votre step préféré ? 👇",
    "Avant / Après : {keyword} avec notre méthode exclusive. DM pour en savoir plus !",
    "Ce que personne ne vous dit sur {keyword} 🤫 #révélation #{geo}",
  ],
  tiktok: [
    "POV : tu découvres {keyword} et ça change ta vie 😱 #viral",
    "J'ai essayé {keyword} 7 jours, voilà ce que ça donne ✅ #{geo}",
    "{keyword} hack que tu aurais dû connaître depuis longtemps 🤯",
    "Répondre à @user — tout sur {keyword} en 60 secondes chrono ⏱️",
    "Le trend {keyword} qui envahit {geo} en ce moment 📈",
  ],
  linkedin: [
    "Voici ce que {keyword} m'a appris sur le leadership en {year}.\n\nThread 🧵",
    "3 erreurs que j'ai commises avec {keyword} (et comment les éviter)",
    "Résultats de notre étude sur {keyword} : chiffres exclusifs pour {geo}",
    "Mon avis honnête sur {keyword} après 6 mois d'implémentation",
    "Pourquoi {keyword} va redéfinir notre secteur d'ici {year}",
  ],
  twitter: [
    "Thread 🧵 : Tout ce que vous devez savoir sur {keyword} en {year}",
    "Hot take : {keyword} est surestimé. Je vous explique pourquoi →",
    "Quelqu'un peut m'expliquer pourquoi {keyword} devient viral en {geo} ? 👀",
    "Mise à jour : {keyword} vient d'atteindre un nouveau palier. Data ici →",
    "PSA : si vous n'utilisez pas encore {keyword}, vous prenez du retard 🚨",
  ],
  facebook: [
    "🔥 {keyword} : notre équipe partage ses meilleures pratiques !",
    "Concours ! Partagez votre expérience {keyword} et gagnez... 🎁",
    "Live demain à 18h : on parle {keyword} avec nos experts. Inscrivez-vous !",
    "📊 Résultats de notre sondage sur {keyword} en {geo} — surprenants !",
    "{keyword} : votre avis nous intéresse. Commentez ci-dessous 👇",
  ],
};

const ENGAGEMENT_RANGES: Record<ScrapeNetwork, { views: [number, number]; er: [number, number] }> = {
  youtube:   { views: [5000,  500000], er: [0.02, 0.08] },
  instagram: { views: [2000,  200000], er: [0.03, 0.12] },
  tiktok:    { views: [10000, 2000000], er: [0.04, 0.15] },
  linkedin:  { views: [500,   50000],  er: [0.02, 0.10] },
  twitter:   { views: [1000,  100000], er: [0.01, 0.06] },
  facebook:  { views: [3000,  300000], er: [0.01, 0.05] },
};

const CONTENT_TYPES: Record<ScrapeNetwork, Array<CompetitorContent["type"]>> = {
  youtube:   ["video"],
  instagram: ["post", "reel", "story"],
  tiktok:    ["video"],
  linkedin:  ["post", "video"],
  twitter:   ["post"],
  facebook:  ["post", "video"],
};

function buildSimulatedContent(
  network: ScrapeNetwork,
  handle: string,
  query: ScrapeQuery,
  index: number
): CompetitorContent {
  const seed = strHash(`${network}|${handle}|${query.keywords.join(",")}|${index}`);
  const rand = mulberry32(seed);

  const { views: [vMin, vMax], er: [erMin, erMax] } = ENGAGEMENT_RANGES[network];
  const views = Math.round(vMin + rand() * (vMax - vMin));
  const er    = erMin + rand() * (erMax - erMin);
  const likes    = Math.round(views * er * (0.6 + rand() * 0.3));
  const comments = Math.round(views * er * (0.05 + rand() * 0.1));
  const shares   = Math.round(views * er * (0.02 + rand() * 0.08));

  const templates = CAPTION_TEMPLATES[network];
  const template  = templates[Math.floor(rand() * templates.length)];
  const keyword   = query.keywords[Math.floor(rand() * Math.max(1, query.keywords.length))] ?? query.theme;
  const caption   = template
    .replace("{keyword}", keyword)
    .replace("{geo}", query.geo.toUpperCase())
    .replace("{year}", String(new Date().getFullYear()));

  const types   = CONTENT_TYPES[network];
  const type    = types[Math.floor(rand() * types.length)];
  const daysAgo = Math.floor(rand() * 60);

  return {
    network,
    handle,
    accountName: handle.replace(/^@/, ""),
    type,
    url: `https://${network}.com/${handle.replace(/^@/, "")}/${seed.toString(16)}`,
    caption,
    likes,
    comments,
    views,
    shares,
    engagementRate: parseFloat(er.toFixed(4)),
    postedAt: isoDate(daysAgo),
    simulated: true,
  };
}

class SimulatedCollector implements Collector {
  isReal = false;

  constructor(public network: ScrapeNetwork) {}

  async collect(query: ScrapeQuery): Promise<CompetitorContent[]> {
    const limit = query.limit ?? 20;
    const results: CompetitorContent[] = [];

    const networkCompetitors = query.competitors.filter((c) => c.network === this.network);
    const targets = networkCompetitors.length > 0
      ? networkCompetitors
      : [{ network: this.network, handle: `@concurrent_${this.network}` }];

    for (const competitor of targets) {
      const count = Math.ceil(limit / targets.length);
      for (let i = 0; i < count; i++) {
        results.push(buildSimulatedContent(this.network, competitor.handle, query, i));
      }
    }

    return results.slice(0, limit);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Collecteur YouTube (YouTube Data API v3 — gratuit, quota 10k/jour)
   Utilise la recherche par mots-clés + stats des vidéos.
   Nécessite : YOUTUBE_API_KEY dans l'environnement.
───────────────────────────────────────────────────────────────────────────── */

interface YtSearchItem {
  id: { videoId?: string; channelId?: string };
  snippet: {
    channelTitle: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnails?: { medium?: { url: string } };
    channelId: string;
  };
}

interface YtVideoStats {
  id: string;
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

class YouTubeCollector implements Collector {
  network: ScrapeNetwork = "youtube";
  isReal = true;

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async collect(query: ScrapeQuery): Promise<CompetitorContent[]> {
    const limit = Math.min(query.limit ?? 20, 50);
    const contents: CompetitorContent[] = [];

    try {
      // 1. Recherche par mots-clés + région
      const q = [...query.keywords, query.theme].filter(Boolean).slice(0, 3).join(" ");
      const regionCode = query.geo.toUpperCase().slice(0, 2);

      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("q", q);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", String(limit));
      searchUrl.searchParams.set("regionCode", regionCode);
      searchUrl.searchParams.set("relevanceLanguage", query.geo.slice(0, 2));
      searchUrl.searchParams.set("order", "relevance");
      searchUrl.searchParams.set("key", this.apiKey);

      const searchRes = await fetch(searchUrl.toString(), {
        headers: { "Accept": "application/json" },
        next: { revalidate: 0 },
      });

      if (!searchRes.ok) {
        console.warn("[YouTube] search failed:", searchRes.status, await searchRes.text());
        return [];
      }

      const searchData = await searchRes.json() as { items?: YtSearchItem[] };
      const items = searchData.items ?? [];
      const videoIds = items
        .map((i) => i.id.videoId)
        .filter(Boolean)
        .join(",");

      if (!videoIds) return [];

      // 2. Récupération des statistiques
      const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      statsUrl.searchParams.set("part", "statistics");
      statsUrl.searchParams.set("id", videoIds);
      statsUrl.searchParams.set("key", this.apiKey);

      const statsRes = await fetch(statsUrl.toString(), { next: { revalidate: 0 } });
      const statsData = statsRes.ok
        ? await statsRes.json() as { items?: YtVideoStats[] }
        : { items: [] };
      const statsMap = new Map<string, YtVideoStats["statistics"]>();
      for (const s of statsData.items ?? []) statsMap.set(s.id, s.statistics);

      // 3. Construction des CompetitorContent
      for (const item of items) {
        const videoId = item.id.videoId;
        if (!videoId) continue;

        const stats  = statsMap.get(videoId) ?? {};
        const views    = parseInt(stats.viewCount   ?? "0", 10);
        const likes    = parseInt(stats.likeCount   ?? "0", 10);
        const comments = parseInt(stats.commentCount ?? "0", 10);
        const er = views > 0 ? parseFloat(((likes + comments) / views).toFixed(4)) : 0;

        // Détermine si ce compte fait partie des compétiteurs ciblés
        const matchedCompetitor = query.competitors.find(
          (c) => c.network === "youtube" && (
            c.handle.includes(item.snippet.channelId) ||
            item.snippet.channelTitle.toLowerCase().includes(c.handle.toLowerCase().replace(/^@/, ""))
          )
        );

        contents.push({
          network: "youtube",
          handle: matchedCompetitor?.handle ?? `@${item.snippet.channelTitle}`,
          accountName: item.snippet.channelTitle,
          type: "video",
          url: `https://www.youtube.com/watch?v=${videoId}`,
          caption: item.snippet.title + (item.snippet.description ? ` — ${item.snippet.description.slice(0, 120)}` : ""),
          likes,
          comments,
          views,
          shares: 0,
          engagementRate: er,
          postedAt: item.snippet.publishedAt,
          thumbnailUrl: item.snippet.thumbnails?.medium?.url,
          simulated: false,
        });
      }
    } catch (err) {
      console.warn("[YouTube] collecte échouée, fallback simulé:", err);
      return [];
    }

    return contents;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Collecteur oEmbed (Instagram, LinkedIn, Twitter) — best-effort
   Ces plateformes bloquent le scraping non authentifié. oEmbed retourne
   uniquement des métadonnées basiques (titre, auteur) sans métriques.
   Utile pour valider qu'un handle existe et récupérer son nom d'affichage.
   NOTE: Sans métriques réelles, le simulateur complète les données.
───────────────────────────────────────────────────────────────────────────── */

const OEMBED_ENDPOINTS: Partial<Record<ScrapeNetwork, (url: string) => string>> = {
  // Instagram oEmbed (ne nécessite pas de clé pour les URLs publiques)
  instagram: (u) => `https://api.instagram.com/oembed?url=${encodeURIComponent(u)}&maxwidth=400`,
};

async function tryOEmbed(network: ScrapeNetwork, postUrl: string): Promise<{ authorName?: string } | null> {
  const endpoint = OEMBED_ENDPOINTS[network];
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint(postUrl), { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return { authorName: data.author_name ?? undefined };
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Factory : retourne le meilleur collecteur disponible pour chaque réseau
───────────────────────────────────────────────────────────────────────────── */

function getCollector(network: ScrapeNetwork): Collector {
  if (network === "youtube") {
    const ytKey = process.env.YOUTUBE_API_KEY;
    if (ytKey) return new YouTubeCollector(ytKey);
  }
  // Pour les autres réseaux (et YouTube sans clé) : simulateur déterministe
  return new SimulatedCollector(network);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Point d'entrée principal
───────────────────────────────────────────────────────────────────────────── */

export async function collectAll(query: ScrapeQuery): Promise<ScrapeResult> {
  const start = Date.now();

  // Détermine les réseaux à collecter
  const requestedNetworks = query.competitors.length > 0
    ? [...new Set(query.competitors.map((c) => c.network))]
    : (["youtube", "instagram", "tiktok", "linkedin"] as ScrapeNetwork[]);

  const realNetworks: ScrapeNetwork[] = [];
  const simulatedNetworks: ScrapeNetwork[] = [];
  const allContents: CompetitorContent[] = [];

  await Promise.allSettled(
    requestedNetworks.map(async (network) => {
      const collector = getCollector(network);
      try {
        const contents = await collector.collect(query);
        allContents.push(...contents);
        if (collector.isReal) {
          if (contents.length > 0) realNetworks.push(network);
          else simulatedNetworks.push(network); // API réelle mais aucun résultat
        } else {
          simulatedNetworks.push(network);
        }
      } catch (err) {
        console.warn(`[collectAll] ${network} failed:`, err);
        // Fallback simulé en cas d'erreur réseau
        const fallback = new SimulatedCollector(network);
        const sim = await fallback.collect(query);
        allContents.push(...sim);
        simulatedNetworks.push(network);
      }
    })
  );

  // Tri par engagement décroissant
  allContents.sort((a, b) => b.engagementRate - a.engagementRate);

  return {
    contents: allContents,
    realNetworks,
    simulatedNetworks,
    durationMs: Date.now() - start,
    collectedAt: new Date().toISOString(),
  };
}

// Export du try oEmbed pour usage externe potentiel
export { tryOEmbed };
