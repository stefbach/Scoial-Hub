// POST /api/meta/ads/publish
// Crée une publicité Meta COMPLÈTE en PAUSE (aucune dépense). Body = PublishAdInput.
// La diffusion réelle nécessite ensuite /api/meta/ads/activate (action explicite).

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { publishAd, type PublishAdInput } from "@/lib/connectors/meta-ads";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<PublishAdInput>;
    // En mode formulaire de prospects, le lien peut être l'URL de confidentialité.
    const effectiveLink = body.link || body.leadForm?.privacyUrl;
    if (!body.companyId || (!body.imageUrl && !body.videoUrl) || !effectiveLink || !body.primaryText || !body.name) {
      return NextResponse.json(
        { error: "Champs requis : companyId, name, un visuel (image ou vidéo), primaryText, et un lien (ou l'URL de confidentialité en mode formulaire)." },
        { status: 400 }
      );
    }
    if (body.leadForm && !body.leadForm.privacyUrl?.trim()) {
      return NextResponse.json({ error: "Le formulaire de prospects exige une URL de politique de confidentialité." }, { status: 400 });
    }

    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const result = await publishAd({
      companyId: body.companyId,
      name: body.name,
      objective: body.objective ?? "trafic",
      dailyBudgetCents: Number(body.dailyBudgetCents ?? 0),
      budgetType: body.budgetType,
      lifetimeBudgetCents: body.lifetimeBudgetCents ? Number(body.lifetimeBudgetCents) : undefined,
      startTime: body.startTime,
      endTime: body.endTime,
      countries: Array.isArray(body.countries) ? body.countries : [],
      cities: Array.isArray(body.cities) ? body.cities : undefined,
      regions: Array.isArray(body.regions) ? body.regions : undefined,
      locales: Array.isArray(body.locales) ? body.locales : undefined,
      ageMin: body.ageMin,
      ageMax: body.ageMax,
      gender: body.gender,
      interests: Array.isArray(body.interests) ? body.interests : undefined,
      placement: body.placement,
      publisherPlatforms: body.publisherPlatforms,
      facebookPositions: body.facebookPositions,
      instagramPositions: body.instagramPositions,
      imageUrl: body.imageUrl ?? "",
      images: Array.isArray(body.images) ? body.images : undefined,
      videoUrl: body.videoUrl,
      videoThumbUrl: body.videoThumbUrl,
      primaryText: body.primaryText,
      headline: body.headline,
      link: effectiveLink as string,
      cta: body.cta,
      leadForm: body.leadForm,
      pixelId: body.pixelId,
      conversionEvent: body.conversionEvent,
      customAudiences: Array.isArray(body.customAudiences) ? body.customAudiences : undefined,
      variants: Array.isArray(body.variants) ? body.variants : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/meta/ads/publish]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors de la création de la publicité." },
      { status: 500 }
    );
  }
}
