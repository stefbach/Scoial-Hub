/**
 * GET /api/analytics?companyId=…&days=30
 *
 * Séries quotidiennes RÉELLES d'une société (publications, engagement,
 * dépenses publicitaires, conversions). L'écran Analytiques appelait jusqu'ici
 * un jeu de données de démonstration : pour une vraie société il ne trouvait
 * aucune série et affichait « Pas encore de données » alors que Meta montrait
 * de l'activité.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { fetchCompanyAnalytics } from "@/lib/analytics-live";
import { cached } from "@/lib/cache/ttl-cache";

/** Fenêtres autorisées (jours). Borne haute : 365. */
function parseDays(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  return Math.min(365, Math.max(1, Math.trunc(n)));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

  const guard = await requireCompanyAccess(companyId, { mode: "view" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  const days = parseDays(req.nextUrl.searchParams.get("days"));

  try {
    const uuid = await resolveCompanyUuid(companyId);
    // TTL 5 min : les compteurs Meta évoluent lentement et l'écran est
    // re-rendu à chaque changement de portée ou de période.
    const payload = await cached(`analytics:${uuid}:${days}`, 300_000, () =>
      fetchCompanyAnalytics(uuid, days)
    );
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[GET /api/analytics]", e);
    // Jamais fatal : l'écran doit s'afficher même si un réseau est injoignable.
    return NextResponse.json({ error: "Analytiques indisponibles." }, { status: 200 });
  }
}
