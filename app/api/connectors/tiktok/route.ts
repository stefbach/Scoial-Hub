/**
 * app/api/connectors/tiktok/route.ts
 *
 * DELETE /api/connectors/tiktok?companyId=…
 *
 * Déconnexion DÉDIÉE à TikTok — vide sh_tiktok_connections (Brique 2, table
 * isolée) au lieu de sh_channel_connections. Coexiste avec [platform]/route
 * (générique, inchangée, sert tous les autres réseaux) grâce à la priorité
 * Next.js des segments statiques.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { disconnectTikTokConnection } from "@/lib/repositories/tiktok-connection";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  }

  const guard = await requireCompanyAccess(companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  try {
    await disconnectTikTokConnection(guard.uuid ?? companyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/connectors/tiktok] Erreur :", err);
    return NextResponse.json({ error: "Échec de la déconnexion." }, { status: 500 });
  }
}
