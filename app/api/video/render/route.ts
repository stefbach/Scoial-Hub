/**
 * POST /api/video/render
 * Body : { cut: PlatformCut, assets: MediaAsset[], captions?: CaptionSegment[] }
 * Soumet un rendu vidéo (Shotstack) et renvoie { id, status }.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { submitRender } from "@/lib/video/render";
import type { CaptionSegment, MediaAsset, PlatformCut } from "@/lib/video/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      cut?: PlatformCut;
      assets?: MediaAsset[];
      captions?: CaptionSegment[];
      logoUrl?: string;
      brandColors?: { text?: string; accent?: string };
    };
    if (!body.cut || !Array.isArray(body.assets)) {
      return NextResponse.json({ error: "cut et assets requis." }, { status: 400 });
    }
    const logoUrl = typeof body.logoUrl === "string" && /^https?:\/\//.test(body.logoUrl) ? body.logoUrl : undefined;
    const hex = (c?: string) => (typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : undefined);
    const brandColors = body.brandColors ? { text: hex(body.brandColors.text), accent: hex(body.brandColors.accent) } : undefined;
    const result = await submitRender(body.cut, body.assets, body.captions ?? [], logoUrl, brandColors);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, status: result.status }, { status: result.status === "unsupported" ? 422 : 400 });
    }
    return NextResponse.json({ id: result.id, status: result.status });
  } catch (err) {
    console.error("[POST /api/video/render]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
