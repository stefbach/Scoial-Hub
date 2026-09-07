// POST /api/learning/outcome { companyId, dimension, armKey, reward, rawMetrics? }
//
// Enregistre un résultat RÉELLEMENT mesuré (reward dans [0,1], déjà normalisé
// via lib/learning-engine/reward.ts côté appelant) pour affiner le moteur
// d'apprentissage. Écrit à la fois l'état appris (sh_learning_arms) et le
// journal d'audit (sh_learning_events).

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { recordOutcome, type LearningDimension } from "@/lib/learning-engine";

const VALID_DIMENSIONS: LearningDimension[] = [
  "time_slot",
  "ad_campaign",
  "creative_format",
  "ad_audience",
  "ad_budget_tier",
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      dimension?: string;
      armKey?: string;
      reward?: number;
      rawMetrics?: Record<string, unknown>;
    };
    const { companyId, dimension, armKey, reward, rawMetrics } = body;
    if (!companyId || !dimension || !armKey || typeof reward !== "number" || !Number.isFinite(reward)) {
      return NextResponse.json(
        { error: "companyId, dimension, armKey et reward (nombre) requis" },
        { status: 400 }
      );
    }
    if (!VALID_DIMENSIONS.includes(dimension as LearningDimension)) {
      return NextResponse.json({ error: `dimension inconnue : ${dimension}` }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await recordOutcome(companyId, dimension as LearningDimension, armKey, reward, rawMetrics ?? {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/learning/outcome]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
