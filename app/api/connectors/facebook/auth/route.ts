/**
 * GET /api/connectors/facebook/auth?companyId=…&return=…
 * Connexion automatique (OAuth) Facebook. En mode démo (META_APP_ID absent),
 * marque directement le connecteur comme connecté et revient à la page.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import { isMetaConfigured } from "@/lib/connectors/meta";
import { upsertConnection } from "@/lib/repositories/channel-connections";
import { buildState } from "@/lib/connectors/oauth-state";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { env } from "@/lib/env";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  const ret = req.nextUrl.searchParams.get("return") ?? "/parametres-connecteurs";
  // Empêche de rattacher un compte à une société dont on n'a pas l'accès (édition).
  if (companyId) {
    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.redirect(`${env.appUrl}${ret}?error=forbidden&platform=facebook`);
  }
  try {
    if (!isMetaConfigured) {
      if (companyId) {
        await upsertConnection(await resolveCompanyUuid(companyId), "facebook", { connected_via: "oauth_demo", account_name: "Facebook (démo)" }, "connected");
      }
      return NextResponse.redirect(`${env.appUrl}${ret}?connected=facebook&simulated=1`);
    }
    return NextResponse.redirect(getConnector("facebook").getAuthUrl(buildState(companyId, ret)));
  } catch (err) {
    console.error("[facebook/auth]", err);
    return NextResponse.redirect(`${env.appUrl}${ret}?error=oauth_init&platform=facebook`);
  }
}
