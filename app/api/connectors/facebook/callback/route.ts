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
import { parseState } from "@/lib/connectors/oauth-state";

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

    // Marque le connecteur comme connecté (pour la page Connecteurs).
    // IMPORTANT : le token OAuth est un token UTILISATEUR. On liste les Pages,
    // on choisit celle qui correspond à la société, et on enregistre l'ID + le
    // token de PAGE (et le compte Instagram lié) — sinon la publication échoue.
    // `parseState` valide le format du state (anti-CSRF) et garantit que `ret`
    // est un chemin interne sûr (anti open-redirect → fallback interne sinon).
    const { companyId, ret } = parseState(request.nextUrl.searchParams.get("state"));
    if (companyId) {
      try {
        const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
        const { fetchMetaPages, pickPageForCompany, getCompanyName, storeMetaConnections } =
          await import("@/lib/connectors/meta-pages");

        const uuid = await resolveCompanyUuid(companyId);
        const name = await getCompanyName(uuid);
        const pages = await fetchMetaPages(tokenSet.accessToken);
        // Page déjà connectée : préférée en cas d'homonymes, et conservée si
        // le matching de nom échoue (jamais de bascule aveugle vers une autre
        // Page — cf. pickPageForCompany).
        const { getMetaContext } = await import("@/lib/connectors/meta-pages");
        const prev = (await getMetaContext(companyId)).pageId;
        const page = pickPageForCompany(pages, name, prev);

        if (page) {
          await storeMetaConnections(companyId, page, tokenSet.accessToken);
        } else {
          const { upsertConnection } = await import("@/lib/repositories/channel-connections");
          await upsertConnection(
            uuid,
            "facebook",
            { page_access_token: tokenSet.accessToken, account_name: tokenSet.accountName ?? "Facebook", connected_via: "oauth", no_page: "1" },
            "pending"
          );
        }
      } catch (e) {
        console.warn("[Facebook callback] channel_connection:", e);
      }
    }

    return NextResponse.redirect(`${REDIRECT_BASE}${ret}?connected=facebook`);
  } catch (err) {
    console.error("[Facebook callback] Erreur lors de l'échange du code :", err);
    return NextResponse.redirect(
      `${REDIRECT_BASE}/accounts?error=exchange_failed&platform=facebook`
    );
  }
}
