/**
 * GET /api/avatar-proxy?url=<glb>
 *
 * Récupère un modèle 3D (.glb) côté serveur pour contourner les restrictions
 * CORS de certains CDN (ex. models.readyplayer.me) qui empêchent le chargement
 * direct dans le navigateur ("Failed to fetch").
 *
 * Sécurité : liste blanche d'hôtes (anti-SSRF).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_SUFFIXES = [
  "readyplayer.me",
  "readyplayerme.github.io",
  "githubusercontent.com",
  "github.io",
  "threejs.org",
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url requise" }, { status: 400 });

  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error("https only");
    host = u.host;
  } catch {
    return NextResponse.json({ error: "url invalide" }, { status: 400 });
  }
  const allowed = ALLOWED_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  if (!allowed) return NextResponse.json({ error: "hôte non autorisé" }, { status: 403 });

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "model/gltf-binary,application/octet-stream,*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      console.warn("[avatar-proxy] upstream", res.status, url);
      return NextResponse.json({ error: `source ${res.status}` }, { status: res.status });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "model/gltf-binary",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[avatar-proxy] fetch threw for", url, "→", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch error" },
      { status: 502 }
    );
  }
}
