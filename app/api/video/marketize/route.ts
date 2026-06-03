/**
 * POST /api/video/marketize
 * Body : { sourceUrl, objective?, platforms[], brandVoice?, lang?, durationHintSec?, companyId? }
 * Retourne un paquet marketing professionnel multi-réseaux pour une vidéo brute.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { marketizeVideo } from "@/lib/video/marketer";
import type { MarketizeInput, VideoPlatform } from "@/lib/video/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<MarketizeInput> & { companyId?: string };

    if (!body.sourceUrl || !body.sourceUrl.trim()) {
      return NextResponse.json({ error: "sourceUrl requis (URL de la vidéo)." }, { status: 400 });
    }
    const platforms = (body.platforms ?? []) as VideoPlatform[];
    if (platforms.length === 0) {
      return NextResponse.json({ error: "Au moins un réseau cible requis." }, { status: 400 });
    }

    const pkg = await marketizeVideo({
      sourceUrl: body.sourceUrl.trim(),
      objective: body.objective ?? "",
      platforms,
      brandVoice: body.brandVoice ?? "professionnel, dynamique",
      lang: body.lang === "en" ? "en" : "fr",
      durationHintSec: body.durationHintSec,
    });

    return NextResponse.json(pkg);
  } catch (err) {
    console.error("[POST /api/video/marketize]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
