// Route API : POST /api/onboarding/analyze
// Déclenche l'analyse IA d'une marque et persiste le profil résultant.
// Temps de réponse potentiellement long → runtime node + maxDuration étendu.

import { NextRequest, NextResponse } from "next/server";
import { analyzeBrand } from "@/lib/onboarding/analyze";
import { saveBrandProfile } from "@/lib/repositories/onboarding";
import { requireCompanyAccess } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/onboarding/analyze
// Body : { companyId, website?, handles?, companyName? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, website, handles, companyName, description } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId est requis" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    // Appel à l'analyse IA (Claude) — peut prendre plusieurs secondes
    const profile = await analyzeBrand({ companyId, website, handles, companyName, description });

    // Persistance du profil
    await saveBrandProfile(profile);

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("[POST /api/onboarding/analyze]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
