/**
 * GET /api/connectors/linkedin/auth?companyId=…&return=…
 * Connexion automatique (OAuth) LinkedIn.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import { isLinkedInConfigured } from "@/lib/connectors/linkedin";
import { upsertConnection } from "@/lib/repositories/channel-connections";
import { buildState } from "@/lib/connectors/oauth-state";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { env } from "@/lib/env";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  const ret = req.nextUrl.searchParams.get("return") ?? "/parametres-connecteurs";
  try {
    if (!isLinkedInConfigured) {
      if (companyId) {
        await upsertConnection(await resolveCompanyUuid(companyId), "linkedin", { connected_via: "oauth_demo", account_name: "LinkedIn (démo)" }, "connected");
      }
      return NextResponse.redirect(`${env.appUrl}${ret}?connected=linkedin&simulated=1`);
    }
    return NextResponse.redirect(getConnector("linkedin").getAuthUrl(buildState(companyId, ret)));
  } catch (err) {
    console.error("[linkedin/auth]", err);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=oauth_init&platform=linkedin`);
  }
}
