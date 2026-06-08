import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy d'image (même origine) — permet de composer une image distante (IA
// Replicate, Supabase Storage) sur un <canvas> sans le « tainter » (CORS), pour
// pouvoir exporter le rendu en PNG. Restreint aux hôtes connus + content-type image.
const ALLOWED = [/(^|\.)replicate\.delivery$/, /(^|\.)supabase\.co$/, /(^|\.)cloudinary\.com$/, /(^|\.)fbcdn\.net$/, /(^|\.)cdninstagram\.com$/];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/^https:\/\//i.test(url)) {
    return new NextResponse("bad url", { status: 400 });
  }
  let host: string;
  try { host = new URL(url).hostname; } catch { return new NextResponse("bad url", { status: 400 }); }
  if (!ALLOWED.some((re) => re.test(host))) {
    return new NextResponse("host not allowed", { status: 403 });
  }
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return new NextResponse("upstream error", { status: 502 });
    const ct = r.headers.get("content-type") ?? "image/png";
    if (!ct.startsWith("image/")) return new NextResponse("not an image", { status: 415 });
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 500 });
  }
}
