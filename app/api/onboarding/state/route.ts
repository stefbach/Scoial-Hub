// Route API : GET & PUT /api/onboarding/state
// Lit et met à jour l'état du parcours d'onboarding (étape courante, choix, …).

import { NextRequest, NextResponse } from "next/server";
import { getOnboardingState, saveOnboardingState, getBrandProfile } from "@/lib/repositories/onboarding";
import { requireCompanyAccess } from "@/lib/auth/guard";

// Route dynamique (utilise les query params / la session) — pas de pré-rendu statique.
export const dynamic = "force-dynamic";

// GET /api/onboarding/state?companyId=…
// Retourne l'état courant et le profil de marque (peut être null).
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId est requis" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    // Chargement en parallèle pour minimiser la latence
    const [state, profile] = await Promise.all([
      getOnboardingState(companyId),
      getBrandProfile(companyId),
    ]);

    return NextResponse.json({ state, profile });
  } catch (err) {
    console.error("[GET /api/onboarding/state]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/onboarding/state
// Body : { companyId, ...patchPartiel }
// Applique un patch partiel sur l'état et retourne l'état fusionné.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, ...patch } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId est requis" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const state = await saveOnboardingState(companyId, patch);

    return NextResponse.json({ state });
  } catch (err) {
    console.error("[PUT /api/onboarding/state]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
