/**
 * Analytiques RÉELLES d'une société : séries quotidiennes reconstruites à partir
 * des publications Meta effectivement diffusées et des dépenses du compte
 * publicitaire. Server-only (les tokens de Page ne quittent pas le serveur).
 *
 * CE QUI EST MESURÉ, ET COMMENT
 * - Publications : nombre de posts Facebook + médias Instagram publiés ce
 *   jour-là (date de publication renvoyée par Graph).
 * - Engagement  : interactions portées par ces publications (réactions +
 *   commentaires + partages côté Facebook ; likes + commentaires côté
 *   Instagram), rattachées au jour de PUBLICATION. Graph n'expose pas
 *   l'horodatage de chaque interaction : imputer l'engagement au jour du post
 *   est la seule lecture exacte possible, et c'est celle de Business Suite.
 * - Dépenses    : `spend` du compte publicitaire avec `time_increment=1`, en
 *   unités MINEURES entières (centimes) — jamais de flottant sur de la monnaie.
 * - Conversions : actions de conversion du même appel (leads, achats,
 *   inscriptions). Les autres `actions` (clics, vues) n'en sont pas.
 *
 * Rien n'est extrapolé ni lissé : un jour sans activité vaut zéro, une source
 * non connectée est signalée « non mesurée » plutôt que remplie de zéros.
 */

import { withAppSecretProof } from "@/lib/connectors/meta-appsecret";
import { getMetaContext, type MetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

/** Un jour de la fenêtre observée. */
export interface AnalyticsPoint {
  /** Jour UTC, format yyyy-MM-dd. */
  date: string;
  postsPublished: number;
  engagement: number;
  /** Détail par réseau du même engagement (permet de filtrer par période). */
  engagementFacebook: number;
  engagementInstagram: number;
  /** Dépense publicitaire en unités MINEURES (centimes) — entier. */
  adSpendCents: number;
  conversions: number;
}

export interface CompanyAnalytics {
  companyId: string;
  /** Une Page Meta est connectée et son token répond. */
  connected: boolean;
  /** Un compte publicitaire lisible a répondu (sinon dépenses non mesurées). */
  adsMeasured: boolean;
  currency: string;
  days: number;
  series: AnalyticsPoint[];
  followers: number;
  /** Portée et vues du compte sur 28 j (Meta ne les sert pas par jour ici). */
  reach?: number;
  views?: number;
}

// ── Helpers purs (testés par scripts/verify-analytics-real.ts) ───────────────

/** Jour UTC (yyyy-MM-dd) d'une date ISO/Graph, ou null si illisible. */
export function dayKey(iso: unknown): string | null {
  if (iso == null || iso === "") return null;
  const t = Date.parse(String(iso));
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

const MONEY_PATTERN = /^(-?)(\d+)(?:[.,](\d+))?$/;

/**
 * Convertit un montant Graph (« 12.34 », « 12,3 », 5) en unités mineures
 * ENTIÈRES. Aucune arithmétique flottante n'est appliquée à la monnaie : les
 * centimes sont lus dans la chaîne, les décimales au-delà du centime sont
 * tronquées (Meta n'en renvoie jamais plus de deux).
 */
export function parseMoneyToCents(value: unknown): number {
  const parts = String(value ?? "").trim().match(MONEY_PATTERN);
  if (!parts) return 0;
  const cents = Number(parts[2]) * 100 + Number((parts[3] ?? "").padEnd(2, "0").slice(0, 2));
  return parts[1] === "-" ? -cents : cents;
}

/**
 * Types d'action Meta comptés comme CONVERSION. Les clics, vues de page et
 * autres actions d'engagement sont volontairement exclus : les agréger
 * gonflerait le chiffre sans qu'il veuille dire quoi que ce soit.
 */
const CONVERSION_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "complete_registration",
  "offsite_conversion.fb_pixel_complete_registration",
  "onsite_conversion.purchase",
]);

/** Somme des actions de conversion d'une ligne d'insights publicitaires. */
export function countConversions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let n = 0;
  for (const a of actions as Array<{ action_type?: string; value?: unknown }>) {
    if (a?.action_type && CONVERSION_ACTIONS.has(a.action_type)) {
      n += Math.trunc(Number(a.value ?? 0)) || 0;
    }
  }
  return n;
}

/** Fenêtre de `days` jours se terminant AUJOURD'HUI (UTC), tous compteurs à zéro. */
export function emptySeries(days: number, now: Date = new Date()): AnalyticsPoint[] {
  const out: AnalyticsPoint[] = [];
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    out.push({
      date: new Date(end - i * 86_400_000).toISOString().slice(0, 10),
      postsPublished: 0,
      engagement: 0,
      engagementFacebook: 0,
      engagementInstagram: 0,
      adSpendCents: 0,
      conversions: 0,
    });
  }
  return out;
}

/** Index date → point, pour imputer une valeur au bon jour de la fenêtre. */
function indexByDate(series: AnalyticsPoint[]): Map<string, AnalyticsPoint> {
  return new Map(series.map((p) => [p.date, p]));
}

// ── Accès Graph ──────────────────────────────────────────────────────────────

async function gget(path: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      withAppSecretProof(`https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`),
      { cache: "no-store" }
    );
    const json = (await res.json()) as Record<string, unknown>;
    const err = (json as { error?: { message?: string } }).error;
    if (err) {
      console.error("[analytics] Graph refuse", path.split("?")[0], "→", err.message);
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

/** Suit `paging.next` jusqu'à `maxPages` et renvoie les lignes concaténées. */
async function gpaged(path: string, token: string, maxPages = 3): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let page = await gget(path, token);
  let guard = 0;
  while (page && guard < maxPages) {
    const data = (page.data as Array<Record<string, unknown>>) ?? [];
    out.push(...data);
    const next = (page.paging as { next?: string })?.next;
    if (!next || data.length === 0) break;
    guard++;
    try {
      const res = await fetch(withAppSecretProof(next), { cache: "no-store" });
      page = (await res.json()) as Record<string, unknown>;
      if ((page as { error?: unknown }).error) break;
    } catch {
      break;
    }
  }
  return out;
}

// ── Lecture ──────────────────────────────────────────────────────────────────

/**
 * Séries quotidiennes réelles d'une société sur `days` jours.
 * Ne throw jamais : une source injoignable laisse ses compteurs à zéro et
 * baisse le drapeau correspondant (`connected`, `adsMeasured`).
 */
export async function fetchCompanyAnalytics(
  companyUuid: string,
  days: number,
  now: Date = new Date()
): Promise<CompanyAnalytics> {
  const series = emptySeries(days, now);
  const byDate = indexByDate(series);
  const first = series[0].date;
  const last = series[series.length - 1].date;
  const sinceSec = Math.floor(Date.parse(`${first}T00:00:00Z`) / 1000);
  const untilSec = Math.floor(Date.parse(`${last}T23:59:59Z`) / 1000);

  const out: CompanyAnalytics = {
    companyId: companyUuid,
    connected: false,
    adsMeasured: false,
    currency: "EUR",
    days,
    series,
    followers: 0,
  };

  let ctx: MetaContext;
  try {
    ctx = await getMetaContext(companyUuid);
  } catch {
    return out;
  }
  const token = ctx.pageToken;
  if (!token) return out;
  out.connected = true;

  /** Impute une publication et son engagement au jour de sa parution. */
  const addPost = (iso: unknown, engagement: number, network: "facebook" | "instagram"): void => {
    const key = dayKey(iso);
    if (!key) return;
    const point = byDate.get(key);
    if (!point) return; // hors fenêtre
    point.postsPublished += 1;
    point.engagement += engagement;
    if (network === "facebook") point.engagementFacebook += engagement;
    else point.engagementInstagram += engagement;
  };

  const jobs: Array<Promise<void>> = [];

  // ── Facebook : publications de la fenêtre ─────────────────────────────────
  if (ctx.pageId) {
    jobs.push(
      (async () => {
        const profile = await gget(`${ctx.pageId}?fields=followers_count,fan_count`, token);
        if (profile) out.followers += Number(profile.followers_count ?? profile.fan_count ?? 0);
      })(),
      (async () => {
        const posts = await gpaged(
          `${ctx.pageId}/posts?fields=created_time,shares,reactions.summary(total_count),` +
            `comments.summary(total_count)&since=${sinceSec}&until=${untilSec}&limit=100`,
          token
        );
        for (const p of posts) {
          const reactions = (p.reactions as { summary?: { total_count?: number } } | undefined)?.summary?.total_count ?? 0;
          const comments = (p.comments as { summary?: { total_count?: number } } | undefined)?.summary?.total_count ?? 0;
          const shares = (p.shares as { count?: number } | undefined)?.count ?? 0;
          addPost(p.created_time, Number(reactions) + Number(comments) + Number(shares), "facebook");
        }
      })(),
      (async () => {
        // Portée et vues : servies par Meta au niveau du COMPTE sur 28 jours,
        // pas par publication — affichées telles quelles, sans être découpées.
        const pi = await gget(
          `${ctx.pageId}/insights?metric=page_impressions_unique,page_impressions&period=days_28`,
          token
        );
        for (const m of (pi?.data as Array<Record<string, unknown>>) ?? []) {
          const values = (m.values as Array<{ value?: number }>) ?? [];
          const v = Number(values[values.length - 1]?.value ?? 0);
          if (m.name === "page_impressions_unique") out.reach = (out.reach ?? 0) + v;
          else if (m.name === "page_impressions") out.views = (out.views ?? 0) + v;
        }
      })()
    );
  }

  // ── Instagram : médias de la fenêtre ──────────────────────────────────────
  if (ctx.igId) {
    jobs.push(
      (async () => {
        const profile = await gget(`${ctx.igId}?fields=followers_count`, token);
        if (profile) out.followers += Number(profile.followers_count ?? 0);
      })(),
      (async () => {
        const media = await gpaged(
          `${ctx.igId}/media?fields=timestamp,like_count,comments_count&since=${sinceSec}&until=${untilSec}&limit=100`,
          token
        );
        for (const m of media) {
          addPost(m.timestamp, Number(m.like_count ?? 0) + Number(m.comments_count ?? 0), "instagram");
        }
      })()
    );
  }

  // ── Publicités : dépense et conversions, jour par jour ────────────────────
  const adsToken = ctx.adsToken ?? ctx.userToken;
  if (ctx.adAccountId && adsToken) {
    const act = ctx.adAccountId.startsWith("act_") ? ctx.adAccountId : `act_${ctx.adAccountId}`;
    jobs.push(
      (async () => {
        const timeRange = encodeURIComponent(JSON.stringify({ since: first, until: last }));
        const rows = await gpaged(
          `${act}/insights?level=account&time_increment=1&time_range=${timeRange}` +
            `&fields=date_start,spend,actions,account_currency&limit=100`,
          adsToken
        );
        if (rows.length === 0) return;
        out.adsMeasured = true;
        for (const r of rows) {
          if (r.account_currency) out.currency = String(r.account_currency);
          const point = byDate.get(String(r.date_start ?? ""));
          if (!point) continue;
          point.adSpendCents += parseMoneyToCents(r.spend);
          point.conversions += countConversions(r.actions);
        }
      })()
    );
  }

  await Promise.all(jobs);
  return out;
}
