/**
 * app/api/connectors/facebook/callback/route.ts
 *
 * GET /api/connectors/facebook/callback?code=…&state=…
 *
 * Callback OAuth Facebook : échange le code d'autorisation contre un token,
 * enregistre (best-effort) le compte dans social_hub.social_accounts,
 * puis redirige vers /accounts.
 *
 * En cas d'erreur OAuth (paramètre `error` dans la query), redirige vers
 * /accounts?error=oauth_denied.
 */

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";

/** URL de redirection après succès ou échec. */
const REDIRECT_BASE =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;

  // Vérification des erreurs OAuth renvoyées par Facebook.
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const desc = searchParams.get("error_description") ?? oauthError;
    console.warn("[Facebook callback] Erreur OAuth :", desc);
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=oauth_denied&platform=facebook`
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=missing_code&platform=facebook`
    );
  }

  try {
    const connector = getConnector("facebook");
    const tokenSet = await connector.exchangeCode(code);

    // Enregistrement best-effort dans social_accounts.
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();

      if (supabase && tokenSet.externalId) {
        await supabase.from("sh_social_accounts").upsert(
          {
            platform: "facebook",
            external_id: tokenSet.externalId,
            account_name: tokenSet.accountName ?? "Facebook",
            status: "active",
            access_token: tokenSet.accessToken,
            refresh_token: tokenSet.refreshToken ?? null,
            token_expires_at: tokenSet.expiresAt
              ? new Date(tokenSet.expiresAt * 1000).toISOString()
              : null,
          },
          {
            onConflict: "platform,external_id",
          }
        );
      }
    } catch (dbErr) {
      // L'enregistrement en base est best-effort : une erreur ici ne doit pas
      // bloquer la redirection utilisateur.
      console.warn("[Facebook callback] Impossible d'enregistrer le compte :", dbErr);
    }

    // Redirection vers /accounts avec confirmation.
    const params = new URLSearchParams({
      connected: "true",
      platform: "facebook",
      account: tokenSet.accountName ?? "Facebook",
    });
    if (tokenSet.raw?.simulated) params.set("simulated", "true");

    return NextResponse.redirect(`${REDIRECT_BASE}/accounts?${params.toString()}`);
  } catch (err) {
    console.error("[Facebook callback] Erreur lors de l'échange du code :", err);
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=exchange_failed&platform=facebook`
    );
  }
}
