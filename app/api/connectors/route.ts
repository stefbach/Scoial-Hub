/**
 * app/api/connectors/route.ts
 *
 * GET /api/connectors?companyId=…
 *
 * Avec `companyId` : statut RÉEL par plateforme, dérivé de
 * sh_channel_connections (la source de vérité des connexions). Sans
 * `companyId` : statut global basé sur l'env (rétro-compatible).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { listConnectorStatus } from "@/lib/connectors/index";
import { listConnections } from "@/lib/repositories/channel-connections";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import type { ConnectorStatus } from "@/lib/connectors/types";
import type { Platform } from "@/lib/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");

    if (companyId) {
      const rows = await listConnections(await resolveCompanyUuid(companyId));
      const byChannel = new Map(rows.map((r) => [r.channel, r]));
      const platforms: Platform[] = ["facebook", "instagram", "linkedin"];
      const statuses: ConnectorStatus[] = platforms.map((p) => {
        const r = byChannel.get(p);
        const connected = r?.status === "connected";
        return {
          platform: p,
          configured: true,
          connectedAccounts: connected ? 1 : 0,
          accounts: connected
            ? [
                {
                  id: r!.id,
                  accountName: r!.config?.account_name || p,
                  status: "active" as const,
                },
              ]
            : [],
        };
      });
      return NextResponse.json(statuses);
    }

    const statuses = await listConnectorStatus();
    return NextResponse.json(statuses);
  } catch (err) {
    console.error("[GET /api/connectors] Erreur :", err);
    return NextResponse.json(
      { error: "Impossible de récupérer le statut des connecteurs." },
      { status: 500 }
    );
  }
}
