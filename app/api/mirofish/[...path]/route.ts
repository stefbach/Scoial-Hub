// /api/mirofish/[...path] — Proxy sécurisé vers l'instance MiroFish (premium).
//
// Le navigateur ne parle jamais directement à MiroFish : tout transite par ce
// proxy qui (1) garde l'URL et la clé de l'instance côté serveur, (2) exige un
// accès en édition à la société, (3) n'autorise que les préfixes de l'API
// MiroFish (graph / simulation / report), (4) relaie méthode, query et corps
// (JSON ou multipart) tels quels. Inerte tant que MIROFISH_BASE_URL n'est pas
// configuré (moteur premium non activé).

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { env, isMirofishConfigured } from "@/lib/env";

// Préfixes autorisés (les 3 blueprints Flask de MiroFish).
const ALLOWED_PREFIXES = ["api/graph", "api/simulation", "api/report"];

async function forward(req: NextRequest, ctx: { params: { path?: string[] } }) {
  if (!isMirofishConfigured) {
    return NextResponse.json({ error: "Moteur premium (MiroFish) non configuré." }, { status: 503 });
  }

  // Garde d'accès : la société est passée via l'en-tête x-company-id.
  const companyId = req.headers.get("x-company-id") ?? undefined;
  const guard = await requireCompanyAccess(companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  const path = (ctx.params.path ?? []).join("/");
  if (!ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return NextResponse.json({ error: "Chemin non autorisé." }, { status: 403 });
  }

  const base = env.mirofishBaseUrl.replace(/\/$/, "");
  const search = req.nextUrl.search; // conserve la query telle quelle
  const target = `${base}/${path}${search}`;

  // En-têtes relayés : content-type d'origine + auth optionnelle de l'instance.
  const headers: Record<string, string> = {};
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  if (env.mirofishApiKey) headers["authorization"] = `Bearer ${env.mirofishApiKey}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);
  try {
    const r = await fetch(target, { method, headers, body, signal: controller.signal });
    const buf = Buffer.from(await r.arrayBuffer());
    const resHeaders: Record<string, string> = {};
    const rct = r.headers.get("content-type");
    if (rct) resHeaders["content-type"] = rct;
    const cd = r.headers.get("content-disposition");
    if (cd) resHeaders["content-disposition"] = cd;
    return new NextResponse(buf, { status: r.status, headers: resHeaders });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "MiroFish : délai dépassé." : "MiroFish injoignable." },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export { forward as GET, forward as POST, forward as DELETE };
