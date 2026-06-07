// POST /api/media/persist
// Télécharge un média depuis une URL éphémère (Replicate / Shotstack) et le
// stocke durablement sur Supabase Storage. Renvoie l'URL publique permanente.
// Body : { companyId, url, kind?: "video" | "image" }

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { companyId?: string; url?: string; kind?: "video" | "image" };
  const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  const url = (body.url ?? "").trim();
  if (!url) return NextResponse.json({ error: "url requise" }, { status: 400 });

  try {
    const sb = createAdminClient();
    if (!sb || !guard.uuid) return NextResponse.json({ url });
    const resp = await fetch(url);
    if (!resp.ok) return NextResponse.json({ url });
    const contentType = resp.headers.get("content-type") || (body.kind === "image" ? "image/png" : "video/mp4");
    const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg"
      : contentType.includes("webp") ? "webp" : contentType.startsWith("video") ? "mp4" : (body.kind === "image" ? "png" : "mp4");
    const buf = Buffer.from(await resp.arrayBuffer());
    const path = `${guard.uuid}/persist/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from("sh-videos").upload(path, buf, { contentType, upsert: true });
    if (upErr) return NextResponse.json({ url });
    const { data } = sb.storage.from("sh-videos").getPublicUrl(path);
    return NextResponse.json({ url: data?.publicUrl || url });
  } catch {
    return NextResponse.json({ url });
  }
}
