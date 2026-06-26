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
import { requireCompanyAccess } from "@/lib/auth/guard";
import type { ConnectorStatus } from "@/lib/connectors/types";
import type { Platform } from "@/lib/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");

    if (companyId) {
      const guard = await requireCompanyAccess(companyId);
      if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

      const rows = await listConnections(await resolveCompanyUuid(companyId));
      const byChannel = new Map(rows.map((r) => [r.channel, r]));
      const platforms: Platform[] = ["facebook", "instagram", "linkedin"];
      const statuses: ConnectorStatus[] = platforms.map((p) => {
        const r = byChannel.get(p);
        const connected = r?.status === "connected";
        // URL de destination RÉELLE si la config en contient une (jamais fabriquée).
        let url: string | undefined;
        if (connected && r?.config) {
          const c = r.config as Record<string, string>;
          const direct = c.url || c.link || c.profile_url || c.page_url || c.website;
          const handle = c.username || c.ig_username;
          if (direct && /^https?:\/\//i.test(direct)) url = direct;
          else if (p === "facebook" && c.page_id) url = `https://facebook.com/${c.page_id}`;          // Page FB connectée (réelle)
          else if (p === "instagram" && handle) url = `https://instagram.com/${handle}`;
          else if (p === "facebook" && handle) url = `https://facebook.com/${handle}`;
        }
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
                  url,
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
