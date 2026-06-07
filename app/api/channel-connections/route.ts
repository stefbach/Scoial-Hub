// GET  /api/channel-connections?companyId=<uuid>
// POST /api/channel-connections  { companyId, channel, config, status? }
//
// Sécurité : les champs `secret` ne sont jamais retournés en clair dans le GET.
// À la place, chaque clé secrète est remplacée par un booléen `__filled__<key>`
// pour que l'UI sache si la valeur est déjà renseignée.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { listConnections, upsertConnection } from "@/lib/repositories/channel-connections";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { channelById, CHANNELS } from "@/lib/channels";
import type { ConnectionStatus } from "@/lib/repositories/channel-connections";
import { requireCompanyAccess } from "@/lib/auth/guard";

// ── Utilitaire masquage des secrets ───────────────────────────────────────────

/**
 * Transforme le `config` brut en version sûre pour le client HTTP :
 * - Les clés marquées `secret` dans la définition du canal sont remplacées
 *   par `{ "<key>": "__secret__" }` si remplies, ou absentes si vides.
 * - Les clés non secrètes sont retournées telles quelles.
 */
function sanitizeConfig(
  channel: string,
  config: Record<string, string>
): Record<string, string> {
  const def = channelById(channel);
  if (!def) return {}; // canal inconnu → rien

  const result: Record<string, string> = {};

  for (const field of def.fields) {
    const value = config[field.key];
    if (field.secret) {
      // Retourne une sentinelle lisible par l'UI pour afficher "•••"
      if (value) result[field.key] = "__secret__";
      // Si vide : la clé est absente → l'UI sait qu'il n'y a rien
    } else {
      if (value !== undefined) result[field.key] = value;
    }
  }

  return result;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const rows = await listConnections(await resolveCompanyUuid(companyId));

    // Enrichit avec les canaux manquants (status "disconnected") pour que le
    // client ait toujours un objet par canal défini dans CHANNELS.
    const existingChannels = new Set(rows.map((r) => r.channel));
    const allChannels = CHANNELS.map((ch) => {
      const existing = rows.find((r) => r.channel === ch.id);
      if (existing) {
        return {
          ...existing,
          config: sanitizeConfig(ch.id, existing.config),
        };
      }
      return {
        id: `synthetic-${ch.id}`,
        company_id: companyId,
        channel: ch.id,
        status: "disconnected" as ConnectionStatus,
        config: {},
        connected_at: null,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    });

    void existingChannels; // utilisé implicitement via rows

    return NextResponse.json(allChannels);
  } catch (err) {
    console.error("[GET /api/channel-connections]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      channel?: string;
      config?: Record<string, string>;
      status?: ConnectionStatus;
    };

    const { companyId, channel, config, status } = body;

    if (!companyId || !channel) {
      return NextResponse.json(
        { error: "companyId et channel sont requis" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    if (!channelById(channel)) {
      return NextResponse.json(
        { error: `Canal inconnu : ${channel}` },
        { status: 400 }
      );
    }

    const result = await upsertConnection(
      await resolveCompanyUuid(companyId),
      channel,
      config ?? {},
      status ?? "pending"
    );

    if (!result) {
      return NextResponse.json({ error: "Échec de l'enregistrement" }, { status: 500 });
    }

    // La réponse POST ne retourne pas non plus les secrets en clair
    return NextResponse.json({
      ...result,
      config: sanitizeConfig(channel, result.config),
    });
  } catch (err) {
    console.error("[POST /api/channel-connections]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
