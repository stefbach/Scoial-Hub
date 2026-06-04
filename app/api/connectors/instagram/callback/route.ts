/**
 * app/api/connectors/instagram/callback/route.ts
 *
 * GET /api/connectors/instagram/callback?code=…&state=…
 *
 * Callback OAuth Instagram (même flow que Facebook) : échange le code,
 * extrait le compte Instagram Business lié, enregistre en base (best-effort),
 * puis redirige vers /accounts.
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
    console.warn("[Instagram callback] Erreur OAuth :", desc);
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=oauth_denied&platform=instagram`
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=missing_code&platform=instagram`
    );
  }

  try {
    const connector = getConnector("instagram");
    const tokenSet = await connector.exchangeCode(code);

    // Enregistrement best-effort dans social_accounts.
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();

      if (supabase && tokenSet.externalId) {
        await supabase.from("sh_social_accounts").upsert(
          {
            platform: "instagram",
            external_id: tokenSet.externalId,
            account_name: tokenSet.accountName ?? "Instagram",
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
      console.warn("[Instagram callback] Impossible d'enregistrer le compte :", dbErr);
    }

    // Sélectionne la Page (et son compte IG Business) et enregistre les
    // connexions Facebook + Instagram avec les bons identifiants/token de Page.
    const { companyId, ret } = parseState(request.nextUrl.searchParams.get("state"));
    if (companyId) {
      try {
        const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
        const { fetchMetaPages, pickPageForCompany, getCompanyName, storeMetaConnections } =
          await import("@/lib/connectors/meta-pages");
        const uuid = await resolveCompanyUuid(companyId);
        const name = await getCompanyName(uuid);
        const pages = await fetchMetaPages(tokenSet.accessToken);
        const page = pickPageForCompany(pages, name);
        if (page) await storeMetaConnections(companyId, page, tokenSet.accessToken);
      } catch (e) {
        console.warn("[Instagram callback] channel_connection:", e);
      }
    }

    const dest = ret || "/accounts";
    return NextResponse.redirect(`${REDIRECT_BASE}${dest}?connected=instagram`);
  } catch (err) {
    console.error("[Instagram callback] Erreur lors de l'échange du code :", err);
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=exchange_failed&platform=instagram`
    );
  }
}
