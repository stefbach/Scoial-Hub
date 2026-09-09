// GET /api/content/pilot?companyId=…  → « Pilote Contenu » : équivalent
// organique du Pilote Pub. Lit les indicateurs organiques réels et les posts
// programmés à venir, et propose des actions concrètes :
//  - "reschedule" : un post à venir est déjà le bon JOUR (appris par le
//    moteur d'apprentissage, lib/learning-engine) mais pas la bonne HEURE —
//    décaler l'heure. Application réelle via /api/content/apply (PATCH sur
//    le post, même mécanisme que la page /scheduled).
//  - "compose" : un réseau connecté est en silence éditorial ou en perte
//    d'engagement (mêmes règles que lib/pilotage-live.ts) — ouvrir Composer.
// Aucune action n'engage de dépense (contrairement au Pilote Pub) : toutes
// sont taguées impact="safe".

export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { fetchLiveKpis, alertsFromLiveKpis } from "@/lib/pilotage-live";
import { listScheduledPosts } from "@/lib/repositories/scheduled-posts";
import { bestLearnedArm } from "@/lib/learning-engine";
import { timeSlotPrefix, parseTimeSlotArmKey, weekdayOfCalendarDate } from "@/lib/learning-engine/time-slot";
import type { Platform } from "@/lib/types";

type Lang = "fr" | "en";

export interface PilotContentAction {
  type: "reschedule" | "compose";
  postId?: string;
  postTitle?: string;
  platform?: Platform;
  currentTime?: string; // HH:mm
  newTime?: string; // HH:mm, pour type="reschedule"
  reason: string;
  impact: "safe"; // le contenu organique n'engage jamais de dépense
}

const VALID_PLATFORMS: Platform[] = ["facebook", "instagram", "linkedin", "tiktok"];
const NET_LABEL: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", tiktok: "TikTok" };

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const companyId = sp.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const lang: Lang = sp.get("language") === "en" ? "en" : "fr";
    const tr = (fr: string, en: string) => (lang === "en" ? en : fr);
    const actions: PilotContentAction[] = [];

    // 1) Alertes réelles (silence éditorial, engagement faible) → CTA Composer.
    const kpis = await fetchLiveKpis(companyId);
    const alerts = alertsFromLiveKpis(kpis);
    for (const a of alerts) {
      if (a.id === "no-network") continue; // rien à composer sans réseau connecté
      const network = a.id.split("-")[1] as Platform | undefined;
      actions.push({
        type: "compose",
        platform: network && VALID_PLATFORMS.includes(network) ? network : undefined,
        reason: `${a.title} — ${a.detail}`,
        impact: "safe",
      });
    }

    // 2) Posts à venir déjà programmés le bon JOUR mais pas la bonne HEURE,
    // selon le créneau prouvé par le moteur d'apprentissage. Best-effort :
    // une erreur ici ne doit jamais empêcher les alertes ci-dessus.
    try {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = (await listScheduledPosts(companyId))
        .filter((p) => (p.status ?? "scheduled") === "scheduled" && p.date >= today && /^\d{2}:\d{2}$/.test(p.time || ""))
        .slice(0, 50);

      const learnedByPlatform = new Map<Platform, Awaited<ReturnType<typeof bestLearnedArm>>>();
      for (const platform of VALID_PLATFORMS) {
        if (!upcoming.some((p) => p.platform === platform)) continue;
        learnedByPlatform.set(platform, await bestLearnedArm(companyId, "time_slot", timeSlotPrefix(platform)));
      }

      for (const post of upcoming) {
        if (actions.filter((a) => a.type === "reschedule").length >= 4) break;
        const best = learnedByPlatform.get(post.platform);
        if (!best) continue;
        const learned = parseTimeSlotArmKey(best.armKey);
        if (!learned) continue;
        const postDay = weekdayOfCalendarDate(post.date);
        const postHour = Number(post.time.slice(0, 2));
        if (postDay !== learned.day) continue; // on ne déplace jamais la date, seulement l'heure
        if (Math.abs(postHour - learned.hour) < 2) continue; // déjà assez proche
        const newTime = `${String(learned.hour).padStart(2, "0")}:00`;
        actions.push({
          type: "reschedule",
          postId: post.id,
          postTitle: post.title,
          platform: post.platform,
          currentTime: post.time,
          newTime,
          reason: tr(
            `« ${post.title} » est déjà programmé le bon jour pour ${NET_LABEL[post.platform]}, mais à ${post.time} au lieu du créneau prouvé ${newTime} (confiance ${Math.round(best.confidence * 100)}%, ${best.sampleSize} mesures).`,
            `"${post.title}" is already scheduled on the right day for ${NET_LABEL[post.platform]}, but at ${post.time} instead of the proven slot ${newTime} (confidence ${Math.round(best.confidence * 100)}%, ${best.sampleSize} samples).`
          ),
          impact: "safe",
        });
      }
    } catch (err) {
      console.error("[content/pilot] recommandations de créneau non bloquantes:", err);
    }

    return NextResponse.json({ actions: actions.slice(0, 8), measuredCount: kpis.filter((k) => k.measured).length });
  } catch (e) {
    console.error("[GET /api/content/pilot]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
