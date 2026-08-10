/**
 * app/api/connectors/tiktok/creator-info/route.ts
 *
 * GET /api/connectors/tiktok/creator-info?companyId=…
 *
 * Expose côté client les infos créateur TikTok (options de confidentialité,
 * interactions verrouillées par le créateur) exigées par les guidelines
 * TikTok pour construire le menu déroulant de confidentialité et les cases
 * Duet/Stitch/Commentaire de /compose — SANS jamais exposer le token d'accès
 * au navigateur (l'appel à creator_info reste entièrement côté serveur).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/repositories/channel-connections";
import { fetchTikTokCreatorInfo } from "@/lib/connectors/providers/tiktok";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const conn = await getConnection(guard.uuid ?? companyId, "tiktok");
    const accessToken = conn?.config?.access_token;
    if (!conn || conn.status !== "connected" || !accessToken) {
      return NextResponse.json(
        { error: "Compte TikTok non connecté. Connectez-le dans Comptes & connexions." },
        { status: 409 }
      );
    }

    const info = await fetchTikTokCreatorInfo(accessToken);
    return NextResponse.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[GET /api/connectors/tiktok/creator-info] Erreur :", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
