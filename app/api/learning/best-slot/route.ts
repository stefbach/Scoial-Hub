// POST /api/learning/best-slot { companyId, platform }
//
// Meilleur créneau horaire PROUVÉ par le moteur d'apprentissage pour cette
// plateforme (dimension "time_slot"), alimenté par le cron
// app/api/cron/learning-sync depuis les métriques réelles des posts publiés.
// Distinct de lib/publishing/best-time.ts (moyenne simple, calculée côté
// client à partir de l'historique visible) : ceci lit l'état appris par le
// bandit bayésien, persistant et partagé entre toutes les sessions.
//
// Renvoie `{ slot: null }` tant qu'aucun créneau n'a atteint le seuil minimal
// de mesures — jamais une erreur, jamais une valeur inventée.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { bestLearnedArm } from "@/lib/learning-engine";
import { timeSlotPrefix, parseTimeSlotArmKey } from "@/lib/learning-engine/time-slot";
import type { Platform } from "@/lib/types";

const VALID_PLATFORMS: Platform[] = ["facebook", "instagram", "linkedin", "tiktok"];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string; platform?: string };
    const { companyId, platform } = body;
    if (!companyId || !platform) {
      return NextResponse.json({ error: "companyId et platform requis" }, { status: 400 });
    }
    if (!VALID_PLATFORMS.includes(platform as Platform)) {
      return NextResponse.json({ error: `plateforme inconnue : ${platform}` }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const best = await bestLearnedArm(companyId, "time_slot", timeSlotPrefix(platform as Platform));
    if (!best) return NextResponse.json({ slot: null });

    const parsed = parseTimeSlotArmKey(best.armKey);
    if (!parsed) return NextResponse.json({ slot: null });

    return NextResponse.json({
      slot: { day: parsed.day, hour: parsed.hour, confidence: best.confidence, sampleSize: best.sampleSize },
    });
  } catch (e) {
    console.error("[POST /api/learning/best-slot]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
