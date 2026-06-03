/**
 * GET /api/connectors/instagram/auth?companyId=…&return=…
 * Connexion automatique (OAuth) Instagram (via Meta).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import { isMetaConfigured } from "@/lib/connectors/meta";
import { upsertConnection } from "@/lib/repositories/channel-connections";
import { buildState } from "@/lib/connectors/oauth-state";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { env } from "@/lib/env";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  const ret = req.nextUrl.searchParams.get("return") ?? "/parametres-connecteurs";
  try {
    if (!isMetaConfigured) {
      if (companyId) {
        await upsertConnection(await resolveCompanyUuid(companyId), "instagram", { connected_via: "oauth_demo", account_name: "Instagram (démo)" }, "connected");
      }
      return NextResponse.redirect(`${env.appUrl}${ret}?connected=instagram&simulated=1`);
    }
    return NextResponse.redirect(getConnector("instagram").getAuthUrl(buildState(companyId, ret)));
  } catch (err) {
    console.error("[instagram/auth]", err);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=oauth_init&platform=instagram`);
  }
}
