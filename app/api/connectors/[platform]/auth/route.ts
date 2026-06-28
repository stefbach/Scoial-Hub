/**
 * app/api/connectors/[platform]/auth/route.ts
 *
 * GET /api/connectors/{platform}/auth?companyId=…&return=…
 *
 * Route OAuth GÉNÉRIQUE : lance le flux de connexion pour N'IMPORTE QUEL
 * réseau enregistré dans le registre (lib/connectors). Ajouter un réseau
 * n'exige donc AUCUNE nouvelle route — uniquement un objet de config.
 *
 * Les réseaux à flux spécifique (Facebook/Instagram avec sélection de Page,
 * LinkedIn) gardent leurs routes statiques dédiées qui ont la priorité dans
 * le routeur Next.js. Cette route dynamique sert tous les autres.
 *
 * En mode démo (credentials absents), marque directement le connecteur comme
 * connecté (mock) et revient à la page — cohérent avec les routes historiques.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnector, isSupportedPlatform } from "@/lib/connectors/index";
import { upsertConnection } from "@/lib/repositories/channel-connections";
import { buildState } from "@/lib/connectors/oauth-state";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { env } from "@/lib/env";

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
): Promise<NextResponse> {
  const platform = params.platform;
  const ret = req.nextUrl.searchParams.get("return") ?? "/parametres-connecteurs";
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";

  if (!isSupportedPlatform(platform)) {
    return NextResponse.redirect(`${env.appUrl}${ret}?error=unknown_platform&platform=${encodeURIComponent(platform)}`);
  }

  // Empêche de rattacher un compte à une société dont on n'a pas l'accès (édition).
  if (companyId) {
    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) {
      return NextResponse.redirect(`${env.appUrl}${ret}?error=forbidden&platform=${platform}`);
    }
  }

  try {
    const connector = getConnector(platform);

    if (!connector.isConfigured()) {
      if (companyId) {
        await upsertConnection(
          await resolveCompanyUuid(companyId),
          platform,
          { connected_via: "oauth_demo", account_name: `${platform} (démo)` },
          "connected"
        );
      }
      return NextResponse.redirect(`${env.appUrl}${ret}?connected=${platform}&simulated=1`);
    }

    return NextResponse.redirect(connector.getAuthUrl(buildState(companyId, ret)));
  } catch (err) {
    console.error(`[${platform}/auth]`, err);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=oauth_init&platform=${platform}`);
  }
}
