/**
 * app/api/connectors/linkedin/callback/route.ts
 *
 * GET /api/connectors/linkedin/callback?code=…&state=…
 *
 * Callback OAuth LinkedIn : échange le code, extrait le profil,
 * enregistre le compte dans social_hub.social_accounts (best-effort),
 * puis redirige vers /accounts.
 *
 * En cas d'erreur (paramètre `error`), redirige vers /accounts?error=oauth_denied.
 */

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import { parseState } from "@/lib/connectors/oauth-state";

const REDIRECT_BASE =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;

  const oauthError = searchParams.get("error");
  if (oauthError) {
    const desc = searchParams.get("error_description") ?? oauthError;
    console.warn("[LinkedIn callback] Erreur OAuth :", desc);
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=oauth_denied&platform=linkedin`
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=missing_code&platform=linkedin`
    );
  }

  try {
    const connector = getConnector("linkedin");
    const tokenSet = await connector.exchangeCode(code);

    // Enregistrement best-effort dans social_accounts.
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();

      if (supabase && tokenSet.externalId) {
        await supabase.from("sh_social_accounts").upsert(
          {
            platform: "linkedin",
            external_id: tokenSet.externalId,
            account_name: tokenSet.accountName ?? "LinkedIn",
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
      console.warn("[LinkedIn callback] Impossible d'enregistrer le compte :", dbErr);
    }

    // `parseState` valide le format du state (anti-CSRF) et garantit que `ret`
    // est un chemin interne sûr (anti open-redirect → fallback interne sinon).
    const { ret } = parseState(request.nextUrl.searchParams.get("state"));

    const params = new URLSearchParams({
      connected: "true",
      platform: "linkedin",
      account: tokenSet.accountName ?? "LinkedIn",
    });
    if (tokenSet.raw?.simulated) params.set("simulated", "true");

    return NextResponse.redirect(`${REDIRECT_BASE}${ret}?${params.toString()}`);
  } catch (err) {
    console.error("[LinkedIn callback] Erreur lors de l'échange du code :", err);
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=exchange_failed&platform=linkedin`
    );
  }
}
