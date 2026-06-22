// GET /api/media/download?url=…&name=…
// Proxy de téléchargement (même origine) : récupère un média (image ou vidéo)
// hébergé sur un hôte connu et le renvoie avec « Content-Disposition: attachment »
// pour forcer un VRAI téléchargement dans le navigateur — y compris en cross-origin
// (où l'attribut HTML `download` est ignoré par les navigateurs).

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hôtes autorisés (anti-SSRF) — nos sources de médias.
const ALLOWED = [
  /(^|\.)replicate\.delivery$/,
  /(^|\.)supabase\.co$/,
  /(^|\.)cloudinary\.com$/,
  /(^|\.)shotstack(-api)?\.io$/,
  /(^|\.)fbcdn\.net$/,
  /(^|\.)cdninstagram\.com$/,
];

function extFromCt(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("mp4")) return "mp4";
  if (ct.includes("webm")) return "webm";
  if (ct.includes("quicktime")) return "mov";
  return "bin";
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const nameParam = req.nextUrl.searchParams.get("name");
  if (!url || !/^https:\/\//i.test(url)) return new NextResponse("bad url", { status: 400 });

  let host: string;
  try { host = new URL(url).hostname; } catch { return new NextResponse("bad url", { status: 400 }); }
  if (!ALLOWED.some((re) => re.test(host))) return new NextResponse("host not allowed", { status: 403 });

  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok || !r.body) return new NextResponse("upstream error", { status: 502 });
    const ct = r.headers.get("content-type") ?? "application/octet-stream";
    // Nom de fichier sûr (sans chemin) + extension cohérente avec le content-type.
    const base = (nameParam || `media-${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 80);
    const fileName = /\.[a-z0-9]{2,4}$/i.test(base) ? base : `${base}.${extFromCt(ct)}`;
    return new NextResponse(r.body, {
      headers: {
        "Content-Type": ct,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 500 });
  }
}
