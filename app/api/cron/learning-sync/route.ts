/**
 * GET /api/cron/learning-sync
 *
 * Alimente le moteur d'apprentissage (dimension "time_slot", cf.
 * lib/learning-engine) avec les métriques RÉELLES des posts organiques
 * publiés récemment — LinkedIn, Facebook, Instagram, TikTok.
 *
 * Pour chaque post "published" pas encore synchronisé, publié il y a au moins
 * MIN_AGE_HOURS (le temps que l'engagement se stabilise) et pas plus de
 * MAX_AGE_HOURS (au-delà, on abandonne plutôt que de retenter indéfiniment) :
 *   1. Résout les identifiants du compte propriétaire (mêmes chemins que la
 *      publication, cf. lib/publishing/publish-scheduled.ts).
 *   2. Appelle connector.getMetrics(externalId, accessToken) — retourne des
 *      métriques SIMULÉES (`simulated: true`) si le compte est déconnecté ou
 *      si la plateforme n'expose pas encore d'API d'insights (TikTok
 *      aujourd'hui) : on ne nourrit JAMAIS l'apprentissage avec du simulé.
 *   3. Sur métriques réelles : reward = engagementReward(...), puis
 *      recordOutcome(companyId, "time_slot", "<jour>-<heure>", reward, …).
 *
 * Le créneau est calculé dans le fuseau de référence de l'app
 * (env.scheduleTimezone), pas le fuseau du serveur cron — cohérent avec la
 * saisie utilisateur (cf. wallClockInZone dans publish-scheduled.ts).
 *
 * Sécurité : valide le header `Authorization: Bearer <CRON_SECRET>`, comme
 * les autres crons. Jamais fatal — toute erreur par post est isolée.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, env } from "@/lib/env";
import { getConnectionAdmin } from "@/lib/repositories/channel-connections";
import { getTikTokConnectionAdmin } from "@/lib/repositories/tiktok-connection";
import { resolveCreds } from "@/lib/publishing/publish-scheduled";
import { getConnector } from "@/lib/connectors/index";
import { recordOutcome, engagementReward } from "@/lib/learning-engine";
import type { Platform } from "@/lib/types";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Dev local : pas de secret configuré → libre
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// Laisse l'engagement organique se stabiliser avant de considérer une mesure
// comme définitive (un post publié il y a 1h n'a pas fini d'être vu).
const MIN_AGE_HOURS = 24;
// Au-delà, on abandonne plutôt que de retenter indéfiniment un vieux post
// (même logique bornée que reclaimStalePublishing / isPastRetryWindow).
const MAX_AGE_HOURS = 24 * 7;
const BATCH_LIMIT = 50;

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Créneau "<jour>-<heure>" d'un instant ISO, dans le fuseau de référence de l'app. */
function slotKeyFor(iso: string, timeZone: string): string {
  const d = new Date(iso);
  let weekday = "sun";
  let hour = "00";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const w = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3);
    if (w && (WEEKDAY_KEYS as readonly string[]).includes(w)) weekday = w;
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h) hour = (h === "24" ? "00" : h).padStart(2, "0");
  } catch {
    // Fuseau invalide → repli sur le créneau par défaut ci-dessus.
  }
  return `${weekday}-${hour}`;
}

interface DueRow {
  id: string;
  company_id: string;
  platform: Platform;
  external_id: string | null;
  published_at: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ processed: 0, learned: 0, note: "Supabase non configuré" });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ processed: 0, learned: 0, note: "Supabase non configuré" });

  const now = Date.now();
  const notBefore = new Date(now - MAX_AGE_HOURS * 3_600_000).toISOString();
  const notAfter = new Date(now - MIN_AGE_HOURS * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from("sh_scheduled_posts")
    .select("id, company_id, platform, external_id, published_at")
    .eq("status", "published")
    .is("learning_synced_at", null)
    .not("external_id", "is", null)
    .not("published_at", "is", null)
    .gte("published_at", notBefore)
    .lte("published_at", notAfter)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[cron/learning-sync] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as DueRow[];
  let processed = 0;
  let learned = 0;
  // Un jeu de creds par (société, plateforme) suffit pour tout le lot.
  const credsCache = new Map<string, { externalAccountId: string; accessToken: string } | null>();

  async function credsFor(companyId: string, platform: Platform) {
    const key = `${companyId}:${platform}`;
    if (credsCache.has(key)) return credsCache.get(key)!;

    let creds: { externalAccountId: string; accessToken: string } | null = null;
    if (platform === "tiktok") {
      const conn = await getTikTokConnectionAdmin(companyId);
      if (conn?.status === "connected" && conn.external_id && conn.access_token) {
        creds = { externalAccountId: conn.external_id, accessToken: conn.access_token };
      }
    } else {
      const conn = await getConnectionAdmin(companyId, platform);
      if (conn?.status === "connected") {
        const resolved = resolveCreds(platform, conn.config ?? {});
        if (resolved.externalAccountId && resolved.accessToken) creds = resolved;
      }
    }
    credsCache.set(key, creds);
    return creds;
  }

  for (const row of rows) {
    if (!row.external_id || !row.published_at) continue;
    processed++;
    try {
      const creds = await credsFor(row.company_id, row.platform);
      if (!creds) continue; // compte déconnecté → on retentera au prochain passage (fenêtre bornée)

      const connector = getConnector(row.platform);
      const metrics = await connector.getMetrics(row.external_id, creds.accessToken);

      if (!metrics.simulated) {
        const reward = engagementReward(metrics);
        const slotKey = slotKeyFor(row.published_at, env.scheduleTimezone);
        await recordOutcome(row.company_id, "time_slot", slotKey, reward, {
          postId: row.id,
          platform: row.platform,
          ...metrics,
        });
        learned++;
      }

      // Marqué "synchronisé" dans tous les cas où on a pu tenter la lecture
      // (compte connecté) : un résultat simulé malgré un compte connecté
      // signifie que la plateforme n'expose pas (encore) d'insights pour ce
      // post — retenter ne changerait rien.
      await supabase.from("sh_scheduled_posts").update({ learning_synced_at: new Date().toISOString() }).eq("id", row.id);
    } catch (err) {
      console.error(`[cron/learning-sync] post ${row.id} (${row.platform}):`, err);
    }
  }

  return NextResponse.json({ processed, learned, skipped: processed - learned });
}
