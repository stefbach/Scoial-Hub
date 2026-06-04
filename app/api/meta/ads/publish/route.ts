// POST /api/meta/ads/publish
// Crée une publicité Meta COMPLÈTE en PAUSE (aucune dépense). Body = PublishAdInput.
// La diffusion réelle nécessite ensuite /api/meta/ads/activate (action explicite).

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { publishAd, type PublishAdInput } from "@/lib/connectors/meta-ads";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<PublishAdInput>;
    if (!body.companyId || !body.imageUrl || !body.link || !body.primaryText || !body.name) {
      return NextResponse.json(
        { error: "Champs requis : companyId, name, imageUrl, link, primaryText." },
        { status: 400 }
      );
    }
    const result = await publishAd({
      companyId: body.companyId,
      name: body.name,
      objective: body.objective ?? "trafic",
      dailyBudgetCents: Number(body.dailyBudgetCents ?? 0),
      countries: Array.isArray(body.countries) ? body.countries : [],
      ageMin: body.ageMin,
      ageMax: body.ageMax,
      imageUrl: body.imageUrl,
      primaryText: body.primaryText,
      headline: body.headline,
      link: body.link,
      cta: body.cta,
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
