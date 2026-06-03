/**
 * POST /api/video/image
 * Body : { cut: PlatformCut, assets: MediaAsset[] }
 * → Génère les images finales (Cloudinary) pour un livrable statique. { images: string[] }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { buildImagesForCut, isCloudinaryConfigured } from "@/lib/video/cloudinary";
import type { MediaAsset, PlatformCut } from "@/lib/video/types";

export async function POST(req: NextRequest) {
  try {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Cloudinary non configuré (ajoutez CLOUDINARY_CLOUD_NAME ou CLOUDINARY_URL)." },
        { status: 400 }
      );
    }
    const body = (await req.json()) as { cut?: PlatformCut; assets?: MediaAsset[] };
    if (!body.cut || !Array.isArray(body.assets)) {
      return NextResponse.json({ error: "cut et assets requis." }, { status: 400 });
    }
    const images = buildImagesForCut(body.cut, body.assets);
    if (images.length === 0) {
      return NextResponse.json({ error: "Aucune image source à composer." }, { status: 422 });
    }
    return NextResponse.json({ images });
  } catch (err) {
    console.error("[POST /api/video/image]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
