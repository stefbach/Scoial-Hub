/**
 * lib/reputation/scan.ts
 *
 * Veille de réputation : cherche les mentions publiques de la marque, les classe
 * par sentiment, et les dépose dans la MESSAGERIE existante.
 *
 * Choix d'architecture : aucune table nouvelle. Le type `InboxMessageKind`
 * comportait déjà « mention », et `ingestMessage` est idempotent sur
 * `externalId` — l'URL de la page fait donc office de clé de déduplication. Les
 * mentions arrivent ainsi dans l'écran Messagerie, alimentent la barre d'humeur
 * et le filtre par sentiment déjà en place, et bénéficient du traitement
 * habituel (à traiter / répondu / pour un humain). Une table dédiée aurait
 * imposé une migration et un second écran pour un gain nul.
 *
 * Server-only.
 */

import { searchMentions, isSearchConfigured, searchProvider, type SearchHit } from "@/lib/reputation/search";
import { ingestMessage, setMessageSentiment, listMessages } from "@/lib/repositories/inbox";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";
import type { InboxSentiment } from "@/lib/inbox/types";

/** Délai minimal entre deux balayages d'une même société, en heures. */
const SCAN_COOLDOWN_HOURS = 20;

/** Domaines ignorés : agrégateurs et annuaires sans valeur de réputation. */
const NOISE_DOMAINS = [
  "facebook.com", "instagram.com", "linkedin.com", "x.com", "twitter.com",
  "pinterest.com", "youtube.com", "tiktok.com",
];

export interface ScanResult {
  /** Faux si aucun fournisseur de recherche n'est configuré. */
  configured: boolean;
  provider: string;
  /** Vrai si le balayage a été sauté (trop récent). */
  skipped?: boolean;
  found: number;
  ingested: number;
  classified: number;
}

/**
 * Vrai si la société a déjà été balayée récemment. Sans table dédiée, on lit la
 * date de la mention la plus récente déjà en messagerie : c'est exactement la
 * trace qu'écrit ce balayage.
 */
async function scannedRecently(companyId: string, now: Date): Promise<boolean> {
  try {
    const recent = await listMessages(companyId, { channel: "web", limit: 50 });
    const mentions = recent.filter((m) => m.kind === "mention");
    if (mentions.length === 0) return false;
    const newest = Math.max(...mentions.map((m) => new Date(m.receivedAt).getTime()));
    if (Number.isNaN(newest)) return false;
    return now.getTime() - newest < SCAN_COOLDOWN_HOURS * 3_600_000;
  } catch {
    return false;
  }
}

/** Requêtes construites autour du nom de marque. */
function buildQueries(brand: string, site?: string): string[] {
  const b = brand.trim();
  if (!b) return [];
  const queries = [`"${b}"`, `"${b}" avis`, `"${b}" actualité`];
  // On exclut le site de la marque : ses propres pages ne sont pas des mentions.
  if (site) {
    const host = site.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (host) return queries.map((q) => `${q} -site:${host}`);
  }
  return queries;
}

/**
 * Vrai si l'hôte EST le domaine indésirable ou l'un de ses sous-domaines.
 * `endsWith` seul ne suffit pas : « monfacebook.com » se termine par
 * « facebook.com » sans avoir aucun rapport, et serait écarté à tort.
 */
export function isNoiseHost(host: string, domains: string[] = NOISE_DOMAINS): boolean {
  const h = host.toLowerCase();
  return domains.some((d) => h === d || h.endsWith(`.${d}`));
}

/** Écarte les résultats sans valeur : réseaux sociaux, doublons d'URL. */
function keepUseful(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (!h.url || seen.has(h.url)) return false;
    if (isNoiseHost(h.source)) return false;
    seen.add(h.url);
    return true;
  });
}

/**
 * Classe le sentiment de plusieurs mentions en UN SEUL appel au modèle.
 * Une requête par mention multiplierait le coût sans rien apporter.
 * Renvoie un tableau aligné sur l'entrée ; « neutral » en cas d'échec.
 */
async function classify(items: { title: string; snippet: string }[]): Promise<InboxSentiment[]> {
  const fallback = (): InboxSentiment[] => items.map(() => "neutral");
  if (!isAiConfigured || items.length === 0) return fallback();

  const list = items
    .map((it, i) => `${i + 1}. ${it.title} — ${it.snippet}`.slice(0, 400))
    .join("\n");

  try {
    const res = await callClaudeJSON<{ sentiments?: string[] }>(list, {
      system:
        "Tu classes le sentiment de mentions publiques d'une marque. " +
        "Pour chaque élément numéroté, réponds positive, neutral, negative ou question. " +
        "Réponds UNIQUEMENT en JSON : {\"sentiments\":[\"neutral\", ...]} " +
        "avec exactement autant d'entrées que d'éléments, dans le même ordre.",
      maxTokens: 400,
    });
    const arr = Array.isArray(res?.sentiments) ? res.sentiments : [];
    const valid: InboxSentiment[] = ["positive", "neutral", "negative", "question"];
    return items.map((_, i) => {
      const v = String(arr[i] ?? "").toLowerCase();
      return (valid as string[]).includes(v) ? (v as InboxSentiment) : "neutral";
    });
  } catch {
    return fallback();
  }
}

/**
 * Balaie les mentions d'une marque et les dépose en messagerie.
 * Ne throw jamais — la veille ne doit jamais faire échouer son appelant.
 */
export async function scanReputation(
  companyId: string,
  brand: string,
  opts: { site?: string; force?: boolean; now?: Date } = {}
): Promise<ScanResult> {
  const now = opts.now ?? new Date();
  const provider = searchProvider();

  if (!isSearchConfigured()) {
    return { configured: false, provider, found: 0, ingested: 0, classified: 0 };
  }
  if (!opts.force && (await scannedRecently(companyId, now))) {
    return { configured: true, provider, skipped: true, found: 0, ingested: 0, classified: 0 };
  }

  const queries = buildQueries(brand, opts.site);
  const batches = await Promise.all(queries.map((q) => searchMentions(q, 8)));
  const hits = keepUseful(batches.flat());
  if (hits.length === 0) {
    return { configured: true, provider, found: 0, ingested: 0, classified: 0 };
  }

  const sentiments = await classify(hits.map((h) => ({ title: h.title, snippet: h.snippet })));

  let ingested = 0;
  let classified = 0;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const msg = await ingestMessage(companyId, {
      channel: "web",
      // L'URL sert de clé : une même page relevée deux fois n'entre qu'une fois.
      externalId: h.url,
      kind: "mention",
      authorName: h.source || "Web",
      text: [h.title, h.snippet].filter(Boolean).join(" — ").slice(0, 2000),
      permalink: h.url,
      receivedAt: now.toISOString(),
      raw: { source: h.source, publishedAt: h.publishedAt ?? null, provider },
    });
    if (!msg) continue; // doublon
    ingested += 1;
    try {
      await setMessageSentiment(msg.id, sentiments[i] ?? "neutral");
      classified += 1;
    } catch {
      /* le sentiment est un enrichissement, jamais bloquant */
    }
  }

  return { configured: true, provider, found: hits.length, ingested, classified };
}
