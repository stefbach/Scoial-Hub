// POST /api/learning/recommend { companyId, dimension, candidates: [{armKey, meta?}] }
//
// Interroge le moteur d'apprentissage (Thompson Sampling bayésien) pour
// choisir le meilleur bras parmi des candidats, sur une dimension donnée
// (ex. "ad_campaign"). Voir lib/learning-engine/index.ts.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { recommend, type LearningDimension, type RecommendationCandidate } from "@/lib/learning-engine";

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
      candidates?: RecommendationCandidate[];
    };
    const { companyId, dimension, candidates } = body;
    if (!companyId || !dimension || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { error: "companyId, dimension et candidates (non vide) requis" },
        { status: 400 }
      );
    }
    if (!VALID_DIMENSIONS.includes(dimension as LearningDimension)) {
      return NextResponse.json({ error: `dimension inconnue : ${dimension}` }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const cleanCandidates = candidates
      .filter((c) => c && typeof c.armKey === "string" && c.armKey.trim())
      .map((c) => ({ armKey: c.armKey, meta: c.meta }));
    if (cleanCandidates.length === 0) {
      return NextResponse.json({ error: "candidates invalides" }, { status: 400 });
    }

    const result = await recommend(companyId, dimension as LearningDimension, cleanCandidates);
    return NextResponse.json({ recommendation: result });
  } catch (e) {
    console.error("[POST /api/learning/recommend]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
