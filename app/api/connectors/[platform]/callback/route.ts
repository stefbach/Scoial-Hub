/**
 * app/api/connectors/[platform]/callback/route.ts
 *
 * GET /api/connectors/{platform}/callback?code=…&state=…
 *
 * Callback OAuth GÉNÉRIQUE pour tout réseau enregistré : échange le code,
 * enregistre (best-effort) le compte dans sh_social_accounts + la connexion
 * de canal dans sh_channel_connections, puis redirige vers la page de retour
 * portée par le `state` (anti-CSRF + anti open-redirect).
 *
 * Les flux spécifiques (Meta page-selection, LinkedIn) restent gérés par leurs
 * routes statiques dédiées, prioritaires dans le routeur Next.js.
 */

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getConnector, isSupportedPlatform } from "@/lib/connectors/index";
import { parseState } from "@/lib/connectors/oauth-state";
import { env } from "@/lib/env";

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
): Promise<NextResponse> {
  const platform = params.platform;
  const { searchParams } = request.nextUrl;
  const { companyId, ret } = parseState(searchParams.get("state"));

  if (!isSupportedPlatform(platform)) {
    return NextResponse.redirect(`${env.appUrl}${ret}?error=unknown_platform&platform=${encodeURIComponent(platform)}`);
  }

  // Erreur OAuth renvoyée par le provider (refus d'autorisation, etc.).
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const desc = searchParams.get("error_description") ?? oauthError;
    console.warn(`[${platform} callback] Erreur OAuth :`, desc);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=oauth_denied&platform=${platform}`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${env.appUrl}${ret}?error=missing_code&platform=${platform}`);
  }

  try {
    const connector = getConnector(platform);
    const tokenSet = await connector.exchangeCode(code, searchParams.get("state") ?? undefined);

    // ── Enregistrement best-effort dans sh_social_accounts ───────────────────
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();
      if (supabase && tokenSet.externalId) {
        await supabase.from("sh_social_accounts").upsert(
          {
            platform,
            external_id: tokenSet.externalId,
            account_name: tokenSet.accountName ?? platform,
            status: "active",
            access_token: tokenSet.accessToken,
            refresh_token: tokenSet.refreshToken ?? null,
            token_expires_at: tokenSet.expiresAt
              ? new Date(tokenSet.expiresAt * 1000).toISOString()
              : null,
          },
          { onConflict: "platform,external_id" }
        );
      }
    } catch (dbErr) {
      console.warn(`[${platform} callback] Impossible d'enregistrer le compte :`, dbErr);
    }

    // ── Connexion de canal rattachée à la société (si présente dans le state) ─
    if (companyId) {
      try {
        const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
        const { upsertConnection } = await import("@/lib/repositories/channel-connections");
        await upsertConnection(
          await resolveCompanyUuid(companyId),
          platform,
          {
            connected_via: "oauth",
            account_name: tokenSet.accountName ?? platform,
            external_id: tokenSet.externalId ?? "",
            access_token: tokenSet.accessToken,
            ...(tokenSet.refreshToken ? { refresh_token: tokenSet.refreshToken } : {}),
          },
          "connected"
        );
      } catch (e) {
        console.warn(`[${platform} callback] channel_connection:`, e);
      }
    }

    return NextResponse.redirect(`${env.appUrl}${ret}?connected=${platform}`);
  } catch (err) {
    console.error(`[${platform} callback] Échange du code échoué :`, err);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=exchange_failed&platform=${platform}`);
  }
}
