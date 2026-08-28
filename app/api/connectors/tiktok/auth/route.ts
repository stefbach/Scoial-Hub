/**
 * app/api/connectors/tiktok/auth/route.ts
 *
 * GET /api/connectors/tiktok/auth?companyId=…&return=…
 *
 * Route OAuth DÉDIÉE à TikTok — écrit dans sh_tiktok_connections (Brique 2,
 * table isolée) au lieu de sh_channel_connections/sh_social_accounts que
 * partage la route générique [platform]/auth. Priorité de résolution Next.js :
 * ce segment statique l'emporte sur [platform]/auth pour platform="tiktok",
 * exactement comme Facebook/Instagram/LinkedIn le font déjà pour leurs flux
 * spécifiques — la route générique reste inchangée et continue de servir tous
 * les autres réseaux.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import { upsertTikTokConnection } from "@/lib/repositories/tiktok-connection";
import { buildState } from "@/lib/connectors/oauth-state";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { env } from "@/lib/env";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ret = req.nextUrl.searchParams.get("return") ?? "/parametres-connecteurs";
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";

  if (companyId) {
    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) {
      return NextResponse.redirect(`${env.appUrl}${ret}?error=forbidden&platform=tiktok`);
    }
  }

  try {
    const connector = getConnector("tiktok");

    if (!connector.isConfigured()) {
      if (companyId) {
        await upsertTikTokConnection(await resolveCompanyUuid(companyId), { accountName: "TikTok (démo)" }, "connected");
      }
      return NextResponse.redirect(`${env.appUrl}${ret}?connected=tiktok&simulated=1`);
    }

    return NextResponse.redirect(connector.getAuthUrl(buildState(companyId, ret)));
  } catch (err) {
    console.error("[tiktok/auth]", err);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=oauth_init&platform=tiktok`);
  }
}
