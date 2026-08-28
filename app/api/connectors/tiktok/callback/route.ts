/**
 * app/api/connectors/tiktok/callback/route.ts
 *
 * GET /api/connectors/tiktok/callback?code=…&state=…
 *
 * Callback OAuth DÉDIÉ à TikTok — enregistre le token dans sh_tiktok_connections
 * (Brique 2, table isolée) au lieu de sh_channel_connections/sh_social_accounts.
 * Coexiste avec [platform]/callback (générique, inchangée, sert tous les autres
 * réseaux) grâce à la priorité Next.js des segments statiques.
 */

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import { parseState } from "@/lib/connectors/oauth-state";
import { upsertTikTokConnection } from "@/lib/repositories/tiktok-connection";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { env } from "@/lib/env";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const { companyId, ret } = parseState(searchParams.get("state"));

  const oauthError = searchParams.get("error");
  if (oauthError) {
    const desc = searchParams.get("error_description") ?? oauthError;
    console.warn("[tiktok callback] Erreur OAuth :", desc);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=oauth_denied&platform=tiktok`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${env.appUrl}${ret}?error=missing_code&platform=tiktok`);
  }

  try {
    const connector = getConnector("tiktok");
    const tokenSet = await connector.exchangeCode(code, searchParams.get("state") ?? undefined);

    if (companyId) {
      try {
        await upsertTikTokConnection(
          await resolveCompanyUuid(companyId),
          {
            accountName: tokenSet.accountName ?? "tiktok",
            externalId: tokenSet.externalId ?? "",
            accessToken: tokenSet.accessToken,
            ...(tokenSet.refreshToken ? { refreshToken: tokenSet.refreshToken } : {}),
            ...(tokenSet.expiresAt ? { tokenExpiresAt: new Date(tokenSet.expiresAt * 1000).toISOString() } : {}),
          },
          "connected"
        );
      } catch (e) {
        console.warn("[tiktok callback] tiktok_connection:", e);
      }
    }

    return NextResponse.redirect(`${env.appUrl}${ret}?connected=tiktok`);
  } catch (err) {
    console.error("[tiktok callback] Échange du code échoué :", err);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=exchange_failed&platform=tiktok`);
  }
}
