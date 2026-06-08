// POST /api/media/persist
// Télécharge un média depuis une URL éphémère (Replicate / Shotstack) et le
// stocke durablement sur Supabase Storage. Renvoie l'URL publique permanente.
// Body : { companyId, url, kind?: "video" | "image" }

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { persistRemoteMedia } from "@/lib/repositories/media";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { companyId?: string; url?: string; kind?: "video" | "image" };
  const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  const url = (body.url ?? "").trim();
  if (!url) return NextResponse.json({ error: "url requise" }, { status: 400 });

  const persisted = await persistRemoteMedia(body.companyId!, url, body.kind === "image" ? "image" : "video");
  return NextResponse.json({ url: persisted });
}
