/**
 * lib/publishing/publish-scheduled.ts
 *
 * Logique partagée de publication RÉELLE d'un post programmé sur le réseau
 * connecté. Utilisée par :
 *   - POST /api/scheduled-posts/[id]/publish  (« Publier maintenant », session utilisateur)
 *   - GET  /api/cron/publish-due              (publication automatique des posts arrivés à échéance)
 *
 * En mode cron, aucune session utilisateur n'existe : on passe `admin: true`
 * pour lire la connexion et marquer le post via le client service_role
 * (bypass RLS, serveur uniquement).
 */

import {
  getConnection,
  getConnectionAdmin,
} from "@/lib/repositories/channel-connections";
import { updateScheduledPost } from "@/lib/repositories/scheduled-posts";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getConnector } from "@/lib/connectors/index";
import { createAdminClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { COMPANY_DATA } from "@/lib/mock-data";
import type { PublishInput } from "@/lib/connectors/types";
import type { Platform, ScheduledPost } from "@/lib/types";
import type { DbScheduledPost } from "@/lib/supabase/db-types";

/**
 * Exprime un instant comme heure « murale » (date + HH:MM) dans un fuseau IANA
 * donné, via Intl (aucune dépendance). Sert à comparer l'heure programmée
 * (saisie dans ce fuseau) à l'heure courante DANS LE MÊME fuseau, quel que soit
 * le fuseau du serveur (UTC sur Vercel).
 */
export function wallClockInZone(now: Date, timeZone: string): { date: string; key: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(now);
  } catch {
    // Fuseau invalide → repli UTC (jamais de crash du cron).
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  // Intl peut renvoyer "24" à minuit selon l'environnement → normaliser en "00".
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date, key: `${date}T${hour}:${get("minute")}` };
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  twitter: "Twitter/X",
};

/** Identifiant de compte + token requis par le connecteur, selon la plateforme. */
export function resolveCreds(
  platform: Platform,
  cfg: Record<string, string>
): { externalAccountId: string; accessToken: string } {
  switch (platform) {
    case "facebook":
      return { externalAccountId: cfg.page_id ?? "", accessToken: cfg.page_access_token ?? "" };
    case "instagram":
      return { externalAccountId: cfg.ig_business_account_id ?? "", accessToken: cfg.page_access_token ?? "" };
    case "linkedin":
      // Cible de publication : la Page/profil choisi (publish_as) en priorité,
      // sinon le profil par défaut — comme la publication immédiate
      // (/api/linkedin/publish). Sans cela, un post programmé pour une Page
      // entreprise partait en réalité sur le profil personnel.
      return { externalAccountId: cfg.publish_as || cfg.external_id || "", accessToken: cfg.access_token ?? "" };
    case "tiktok":
    case "twitter":
      // Connecteurs déclaratifs (OAuth2) : compte + token stockés tels quels
      // (sh_social_accounts.access_token / external_id).
      return { externalAccountId: cfg.external_id ?? "", accessToken: cfg.access_token ?? "" };
    default:
      return { externalAccountId: "", accessToken: "" };
  }
}

export interface PublishOutcome {
  ok: boolean;
  /** Statut HTTP suggéré (200 si ok, sinon 400/409/422/502). */
  status: number;
  error?: string;
  simulated?: boolean;
  externalId?: string;
  url?: string;
  platform: Platform;
}

/** Marque le post comme publié via le client admin (cron — pas de session). */
async function markPublishedAdmin(id: string, publishedAt: string): Promise<void> {
  if (!isSupabaseConfigured) {
    await updateScheduledPost(id, { status: "published", publishedAt }).catch(() => {});
    return;
  }
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase
    .from("sh_scheduled_posts")
    .update({ status: "published", published_at: publishedAt })
    .eq("id", id);
}

/**
 * Publie réellement un post programmé sur la plateforme connectée, puis le
 * marque comme publié. Ne throw jamais — retourne un PublishOutcome.
 *
 * @param post              Le post à publier (body/title, media…).
 * @param companyIdOrUuid   Id, code ou UUID de la société.
 * @param opts.admin        Vrai en contexte cron : lecture connexion + update
 *                          du statut via le client service_role (bypass RLS).
 */
export async function publishScheduledPostNow(
  post: ScheduledPost,
  companyIdOrUuid: string,
  opts: { admin?: boolean } = {}
): Promise<PublishOutcome> {
  const platform = post.platform;
  const label = PLATFORM_LABEL[platform] ?? platform;

  const text = (post.body || post.title || "").trim();
  if (!text) {
    return { ok: false, status: 400, error: "La publication est vide.", platform };
  }

  // Compte connecté = source de vérité pour les tokens (page_access_token…).
  const uuid = await resolveCompanyUuid(companyIdOrUuid);
  const conn = opts.admin
    ? await getConnectionAdmin(uuid, platform)
    : await getConnection(uuid, platform);
  if (!conn || conn.status !== "connected") {
    return {
      ok: false,
      status: 409,
      error: `Le compte ${label} n'est pas connecté. Connectez-le dans Connecteurs avant de publier.`,
      platform,
    };
  }

  const { externalAccountId, accessToken } = resolveCreds(platform, conn.config ?? {});
  if (!externalAccountId || !accessToken) {
    return {
      ok: false,
      status: 409,
      error: `La connexion ${label} est incomplète (Page/token manquant). Reconnectez le compte.`,
      platform,
    };
  }

  // Média attaché (URL) — requis par Instagram (pas de post texte seul),
  // optionnel mais pris en compte pour Facebook/LinkedIn.
  const mediaUrl = post.media?.url;
  if (platform === "instagram" && !mediaUrl) {
    return {
      ok: false,
      status: 422,
      error: "Instagram exige un visuel (image ou vidéo). Ajoutez un média à la publication avant de publier.",
      platform,
    };
  }

  const input: PublishInput = {
    externalAccountId,
    accessToken,
    text,
    media: mediaUrl
      ? { url: mediaUrl, mimeType: post.media?.kind === "video" ? "video/mp4" : "image/jpeg" }
      : undefined,
  };

  let result;
  try {
    const connector = getConnector(platform);
    result = await connector.publishPost(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error(`[publish-scheduled] ${platform} (post ${post.id}):`, message);
    return {
      ok: false,
      status: 502,
      error: `Échec de la publication sur ${label} : ${message}`,
      platform,
    };
  }

  // Publication effectuée → on marque le post comme publié.
  const publishedAt = new Date().toISOString();
  if (opts.admin) {
    await markPublishedAdmin(post.id, publishedAt).catch(() => {});
  } else {
    await updateScheduledPost(post.id, { status: "published", publishedAt }).catch(() => {});
  }

  return {
    ok: true,
    status: 200,
    simulated: result.simulated ?? false,
    externalId: result.externalId,
    url: result.url,
    platform,
  };
}

// ── Verrou anti double-publication (cron concurrent) ─────────────────────────

/**
 * « Réserve » atomiquement un post pour publication : passe son statut de
 * `scheduled` à `publishing` SI et seulement s'il est encore `scheduled`.
 * Renvoie true si ce process a obtenu le verrou (un seul gagnant), false si un
 * autre passage l'a déjà pris → évite qu'un même post parte deux fois.
 */
export async function claimDueScheduledPost(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true; // mock : pas de concurrence
  const supabase = createAdminClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("sh_scheduled_posts")
    .update({ status: "publishing", claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled") // compare-and-set atomique
    .is("published_at", null) // jamais re-publier un post déjà parti une fois
    .select("id");
  return !error && Array.isArray(data) && data.length === 1;
}

/**
 * Après un échec : un échec PERMANENT (config manquante, contenu invalide…)
 * passe le post en `failed` (visible par l'utilisateur, on arrête de réessayer) ;
 * un échec TRANSITOIRE (réseau/5xx) le remet en `scheduled` pour un nouvel essai.
 */
export async function finalizeFailedScheduledPost(id: string, permanent: boolean): Promise<void> {
  const next: ScheduledPost["status"] = permanent ? "failed" : "scheduled";
  if (!isSupabaseConfigured) {
    await updateScheduledPost(id, { status: next }).catch(() => {});
    return;
  }
  const supabase = createAdminClient();
  if (!supabase) return;
  try {
    // CAS : ne repasse en scheduled/failed QUE depuis `publishing`. Sans cette
    // garde, l'échec d'un passage concurrent écrasait le statut `published`
    // posé par le passage gagnant → le post repartait à chaque run (doublons).
    await supabase
      .from("sh_scheduled_posts")
      .update({ status: next })
      .eq("id", id)
      .eq("status", "publishing");
  } catch { /* non bloquant */ }
}

/** Codes considérés comme erreurs PERMANENTES (inutile de réessayer). */
export function isPermanentPublishError(status: number): boolean {
  return status === 400 || status === 409 || status === 422;
}

/**
 * Remet en `scheduled` les posts restés bloqués en `publishing` (ex. crash /
 * timeout d'un passage cron précédent) — UNIQUEMENT si leur réservation est
 * périmée (claimed_at plus vieux que STALE_CLAIM_MINUTES, ou absent : verrou
 * hérité d'avant l'horodatage).
 *
 * ATTENTION : les passages du cron PEUVENT se chevaucher (cron Vercel + workflow
 * GitHub Actions, tous deux toutes les 10 min, non synchronisés). L'ancienne
 * version libérait TOUS les `publishing` au début de chaque passage : elle
 * volait le verrou d'un passage concurrent en pleine publication → le post
 * partait deux fois sur le réseau. Le seuil ferme cette course : une exécution
 * dure ≤ 60 s (maxDuration), donc un verrou de plus de 10 min est orphelin.
 */
const STALE_CLAIM_MINUTES = 10;

export async function reclaimStalePublishing(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = createAdminClient();
  if (!supabase) return 0;
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase
    .from("sh_scheduled_posts")
    .update({ status: "scheduled", claimed_at: null })
    .eq("status", "publishing")
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
    .select("id");
  if (error || !Array.isArray(data)) return 0;
  return data.length;
}

// ── Posts arrivés à échéance (cron) ──────────────────────────────────────────

export interface DueScheduledPost {
  post: ScheduledPost;
  /** UUID (Supabase) ou id mock de la société propriétaire. */
  companyId: string;
}

function rowToPost(row: DbScheduledPost): ScheduledPost {
  return {
    id: row.id,
    platform: row.platform as Platform,
    title: row.title,
    date: row.date ?? "",
    time: row.time ?? "",
    source: row.source as ScheduledPost["source"],
    status: (row.status as ScheduledPost["status"]) ?? "scheduled",
    body: row.body ?? undefined,
    media: row.media ?? undefined,
    publishedAt: row.published_at ?? undefined,
  };
}

/**
 * Liste les posts programmés dont l'échéance (date + heure) est dépassée,
 * toutes sociétés confondues, pour les plateformes demandées.
 *
 * Les dates/heures sont stockées sans fuseau ("yyyy-MM-dd" + "HH:mm") : la
 * comparaison se fait sur l'horloge du serveur (UTC sur Vercel). Une heure
 * absente vaut "00:00" (le post part dès le premier passage du jour J).
 */
export async function listDueScheduledPosts(
  platforms: Platform[],
  now: Date = new Date(),
  limit = 100
): Promise<DueScheduledPost[]> {
  // Heure courante exprimée comme heure « murale » dans le fuseau de référence
  // (env.scheduleTimezone). Sans ça, le cron (UTC sur Vercel) comparait l'heure
  // saisie « 09:00 » à l'heure UTC → publication décalée du fuseau (ex. +4h à
  // Maurice). On compare désormais dans le MÊME fuseau que la saisie.
  const { date: todayStr, key: nowKey } = wallClockInZone(now, env.scheduleTimezone);
  const isDue = (p: ScheduledPost) =>
    Boolean(p.date) && `${p.date}T${p.time || "00:00"}` <= nowKey;

  // Mode mock — parcourt COMPANY_DATA.
  if (!isSupabaseConfigured) {
    const out: DueScheduledPost[] = [];
    for (const [companyId, data] of Object.entries(COMPANY_DATA)) {
      for (const p of data.scheduled) {
        if ((p.status ?? "scheduled") !== "scheduled") continue;
        if (p.publishedAt) continue; // déjà parti une fois — jamais re-publier
        if (!platforms.includes(p.platform)) continue;
        if (isDue(p)) out.push({ post: p, companyId });
      }
    }
    return out.slice(0, limit);
  }

  const supabase = createAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("sh_scheduled_posts")
    .select("*")
    .eq("status", "scheduled")
    // Garde-fou anti-doublon : un post portant déjà un published_at a été
    // publié au moins une fois (statut écrasé par une course passée) — on ne
    // le remet JAMAIS dans le circuit automatique.
    .is("published_at", null)
    .in("platform", platforms)
    .not("date", "is", null)
    .lte("date", todayStr)
    .order("date", { ascending: true })
    .limit(200);

  if (error || !data) {
    console.error("[publish-scheduled] listDueScheduledPosts error:", error);
    return [];
  }

  return (data as DbScheduledPost[])
    .map((row) => ({ post: rowToPost(row), companyId: row.company_id }))
    .filter(({ post }) => isDue(post))
    .slice(0, limit);
}
