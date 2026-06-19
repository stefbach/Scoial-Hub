// Proxy serveur vers l'instance MiroFish.
// Le navigateur appelle /api/mf/<chemin MiroFish> ; on relaie vers MIROFISH_BASE_URL
// (gardée côté serveur), en n'autorisant que les préfixes de l'API MiroFish.
// Évite les soucis de CORS et garde l'URL/clé hors du navigateur.

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";

const ALLOWED = ["api/graph", "api/simulation", "api/report"];
const BASE = (process.env.MIROFISH_BASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.MIROFISH_API_KEY ?? "";

async function forward(req: NextRequest, ctx: { params: { path?: string[] } }) {
  if (!/^https?:\/\//.test(BASE)) {
    return NextResponse.json({ error: "MIROFISH_BASE_URL non configurée." }, { status: 503 });
  }
  const path = (ctx.params.path ?? []).join("/");
  if (!ALLOWED.some((p) => path === p || path.startsWith(`${p}/`))) {
    return NextResponse.json({ error: "Chemin non autorisé." }, { status: 403 });
  }

  const target = `${BASE}/${path}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  if (KEY) headers["authorization"] = `Bearer ${KEY}`;

  const method = req.method.toUpperCase();
  const body = method !== "GET" && method !== "HEAD" ? Buffer.from(await req.arrayBuffer()) : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  try {
    const r = await fetch(target, { method, headers, body, signal: controller.signal });
    const buf = Buffer.from(await r.arrayBuffer());
    const resHeaders: Record<string, string> = {};
    const rct = r.headers.get("content-type");
    if (rct) resHeaders["content-type"] = rct;
    return new NextResponse(buf, { status: r.status, headers: resHeaders });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "MiroFish : délai dépassé." : "MiroFish injoignable." },
      { status: 504 }
    );
  } finally {
    clearTimeout(timer);
  }
}

export { forward as GET, forward as POST, forward as DELETE };
