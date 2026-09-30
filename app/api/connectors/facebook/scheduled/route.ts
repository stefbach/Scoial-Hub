/**
 * app/api/connectors/facebook/scheduled/route.ts
 *
 * GET /api/connectors/facebook/scheduled?companyId=…
 *
 * Publications programmées NATIVEMENT sur la Page Facebook connectée (Meta
 * Business Suite, hors Social Hub) — retour client Rosiane #7,
 * BUGS-SocialHub35 : visibilité demandée sur ce calendrier depuis Social Hub,
 * à côté de nos propres publications programmées (sh_scheduled_posts).
 *
 * Lecture seule, jamais bloquant : sans connexion Facebook active ou sur
 * erreur Graph API, renvoie une liste vide plutôt qu'une erreur qui casserait
 * l'écran.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getConnection } from "@/lib/repositories/channel-connections";
import { listFacebookNativeScheduledPosts } from "@/lib/connectors/meta";
import { isConnectorAuthError } from "@/lib/connectors/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  }

  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
  }
  const uuid = guard.uuid ?? companyId;

  try {
    const conn = await getConnection(uuid, "facebook");
    if (!conn || conn.status !== "connected") {
      return NextResponse.json({ posts: [], connected: false });
    }
    const pageId = conn.config?.page_id ?? "";
    const accessToken = conn.config?.page_access_token ?? "";
    if (!pageId || !accessToken) {
      return NextResponse.json({ posts: [], connected: false });
    }

    const result = await listFacebookNativeScheduledPosts(pageId, accessToken);
    return NextResponse.json({ connected: true, posts: result.posts, error: result.error });
  } catch (err) {
    if (isConnectorAuthError(err)) {
      // Token rejeté : pas une erreur serveur, la Page a juste besoin d'être
      // reconnectée (déjà signalé ailleurs — ici on dégrade proprement).
      return NextResponse.json({ posts: [], connected: false, error: err.message });
    }
    console.error("[GET /api/connectors/facebook/scheduled] Erreur :", err);
    return NextResponse.json(
      { error: "Impossible de récupérer les publications programmées Facebook." },
      { status: 500 }
    );
  }
}
