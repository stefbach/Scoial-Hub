/**
 * POST /api/video/marketize
 * Body : {
 *   assets?: [{ url, kind: "image"|"video", name? }],
 *   sourceUrl?: string,            // hérité : équivaut à un asset vidéo unique
 *   assembly?: AssemblyMode,
 *   objective?, platforms[], brandVoice?, lang?, durationHintSec?, companyId?
 * }
 * Retourne un paquet marketing professionnel multi-réseaux (images ET vidéos).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { marketizeVideo } from "@/lib/video/marketer";
import type { AssemblyMode, MediaAsset, VideoPlatform } from "@/lib/video/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      assets?: MediaAsset[];
      sourceUrl?: string;
      assembly?: AssemblyMode;
      objective?: string;
      platforms?: VideoPlatform[];
      brandVoice?: string;
      lang?: string;
      durationHintSec?: number;
      companyId?: string;
    };

    // Normalise les médias : assets[] prioritaires, sinon sourceUrl (vidéo).
    let assets: MediaAsset[] = Array.isArray(body.assets) ? body.assets.filter((a) => a?.url) : [];
    if (assets.length === 0 && body.sourceUrl?.trim()) {
      assets = [{ url: body.sourceUrl.trim(), kind: "video" }];
    }
    if (assets.length === 0) {
      return NextResponse.json({ error: "Au moins un média (image ou vidéo) est requis." }, { status: 400 });
    }

    const platforms = (body.platforms ?? []) as VideoPlatform[];
    if (platforms.length === 0) {
      return NextResponse.json({ error: "Au moins un réseau cible requis." }, { status: 400 });
    }

    const pkg = await marketizeVideo({
      assets,
      assembly: (body.assembly ?? "auto") as AssemblyMode,
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
