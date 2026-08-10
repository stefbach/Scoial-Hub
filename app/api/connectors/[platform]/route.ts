/**
 * app/api/connectors/[platform]/route.ts
 *
 * DELETE /api/connectors/{platform}?companyId=…
 *
 * Déconnexion GÉNÉRIQUE d'un réseau pour une société (bouton « Déconnecter »
 * de /accounts) : vide la connexion (sh_channel_connections) et repasse son
 * statut à `disconnected`. Ne touche à aucune autre route existante — la
 * connexion (/auth), le callback OAuth et la publication restent inchangés.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isSupportedPlatform } from "@/lib/connectors/index";
import { disconnectConnection } from "@/lib/repositories/channel-connections";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { platform: string } }
): Promise<NextResponse> {
  const platform = params.platform;
  const companyId = req.nextUrl.searchParams.get("companyId");

  if (!isSupportedPlatform(platform)) {
    return NextResponse.json({ error: `Plateforme inconnue : ${platform}` }, { status: 404 });
  }
  if (!companyId) {
    return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  }

  const guard = await requireCompanyAccess(companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  try {
    await disconnectConnection(guard.uuid ?? companyId, platform);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[DELETE /api/connectors/${platform}] Erreur :`, err);
    return NextResponse.json({ error: "Échec de la déconnexion." }, { status: 500 });
  }
}
