// POST /api/meta/ads/publish
// Crée une publicité Meta COMPLÈTE en PAUSE (aucune dépense). Body = PublishAdInput.
// La diffusion réelle nécessite ensuite /api/meta/ads/activate (action explicite).

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { publishAd, type PublishAdInput } from "@/lib/connectors/meta-ads";
import { requireCompanyAccess } from "@/lib/auth/guard";

// Localise (FR → EN) les messages d'erreur que NOUS produisons, quand l'UI est
// en anglais (#4). Le texte propre de Meta reste dans la langue du compte.
function localizeErr(msg: string, en: boolean): string {
  if (!en) return msg;
  return msg
    .replace("Conflit de budget : il est défini à la fois au niveau de la campagne (budget optimisé / Advantage) et au niveau de l'ensemble de publicités. Définissez le budget à UN seul niveau, ou désactivez le budget de campagne dans votre compte Meta.",
      "Budget conflict: it's set BOTH at the campaign level (Advantage/optimized budget) and the ad-set level. Set the budget at ONE level only, or disable the campaign budget in your Meta account.")
    .replace("Catégorie de publicité spéciale requise (logement, emploi, crédit, politique). À régler dans les paramètres de la campagne sur Meta.",
      "A special ad category is required (housing, employment, credit, politics). Set it in the campaign settings on Meta.")
    .replace("Budget trop bas pour ce ciblage : augmentez le budget quotidien ou à vie.",
      "Budget too low for this targeting: increase the daily or lifetime budget.")
    .replace("Erreur lors de la création de la publicité.", "Failed to create the ad.")
    .replace("champ concerné :", "field:");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let en = false;
  try {
    const body = (await req.json()) as Partial<PublishAdInput> & { language?: "fr" | "en" };
    en = body.language === "en";
    // En mode formulaire de prospects, le lien peut être l'URL de confidentialité.
    const effectiveLink = body.link || body.leadForm?.privacyUrl;
    if (!body.companyId || (!body.imageUrl && !body.videoUrl) || !effectiveLink || !body.primaryText || !body.name) {
      return NextResponse.json(
        { error: en
          ? "Required fields: companyId, name, a visual (image or video), primaryText, and a link (or the privacy URL in lead-form mode)."
          : "Champs requis : companyId, name, un visuel (image ou vidéo), primaryText, et un lien (ou l'URL de confidentialité en mode formulaire)." },
        { status: 400 }
      );
    }
    if (body.leadForm && !body.leadForm.privacyUrl?.trim()) {
      return NextResponse.json({ error: en ? "The lead form requires a privacy policy URL." : "Le formulaire de prospects exige une URL de politique de confidentialité." }, { status: 400 });
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
      excludedInterests: Array.isArray(body.excludedInterests) ? body.excludedInterests : undefined,
      excludedCustomAudiences: Array.isArray(body.excludedCustomAudiences) ? body.excludedCustomAudiences : undefined,
      excludedCountries: Array.isArray(body.excludedCountries) ? body.excludedCountries : undefined,
      excludedCities: Array.isArray(body.excludedCities) ? body.excludedCities : undefined,
      excludedRegions: Array.isArray(body.excludedRegions) ? body.excludedRegions : undefined,
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
    const raw = err instanceof Error ? err.message : "Erreur lors de la création de la publicité.";
    return NextResponse.json({ error: localizeErr(raw, en) }, { status: 500 });
  }
}
