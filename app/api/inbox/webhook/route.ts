// Webhook Meta (temps réel) : reçoit les commentaires Facebook/Instagram et les
// messages privés (Messenger/IG DM) poussés par Meta, et les insère dans la
// messagerie. Non authentifié par session (c'est Meta qui appelle) : sécurisé par
//  (1) le token de vérification au handshake (GET),
//  (2) la signature X-Hub-Signature-256 (HMAC app secret) sur les events (POST).
//
// Configuration côté Meta :
//   URL de rappel        : https://<domaine>/api/inbox/webhook
//   Token de vérification: la valeur de META_WEBHOOK_VERIFY_TOKEN (Vercel)
//   Champs à abonner     : feed (commentaires Page), messages (DM), + côté IG :
//                          comments, messages.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { ingestMessage } from "@/lib/repositories/inbox";
import { graphTimeToIso } from "@/lib/inbox/meta-sync";
import type { InboxChannel } from "@/lib/inbox/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "axon-verify-dev";
const APP_SECRET = (process.env.META_APP_SECRET ?? "").split("|")[0].trim();

// ── 1) Handshake de vérification (GET) ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");
  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── Résolution Page/IG → société ─────────────────────────────────────────────
async function companyForMeta(channel: "facebook" | "instagram", metaId: string): Promise<string | null> {
  const sb = createAdminClient();
  if (!sb) return null;
  const key = channel === "instagram" ? "ig_business_account_id" : "page_id";
  const { data } = await sb
    .from("sh_channel_connections")
    .select("company_id")
    .eq("channel", channel)
    .eq(`config->>${key}`, metaId)
    .maybeSingle();
  return data?.company_id ? String(data.company_id) : null;
}

// ── Vérification de signature ─────────────────────────────────────────────────
function validSignature(raw: string, header: string | null): boolean {
  if (!APP_SECRET) return true; // dev/démo : pas de secret → on ne bloque pas
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── 2) Réception des événements (POST) ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: { object?: string; entry?: Array<Record<string, unknown>> };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // toujours 200 pour éviter les retries
  }

  const object = body.object; // "page" | "instagram"
  try {
    for (const entry of body.entry ?? []) {
      const entryId = String(entry.id ?? "");

      // — Commentaires (Page feed / IG comments) —
      for (const change of (entry.changes as Array<Record<string, unknown>>) ?? []) {
        const field = String(change.field ?? "");
        const value = (change.value as Record<string, unknown>) ?? {};

        // Facebook : field "feed", item "comment", verb "add"
        if (object === "page" && field === "feed" && value.item === "comment" && value.verb === "add") {
          const companyId = await companyForMeta("facebook", entryId);
          if (!companyId) continue;
          const from = value.from as { name?: string; id?: string } | undefined;
          await ingestMessage(companyId, {
            channel: "facebook",
            externalId: String(value.comment_id ?? ""),
            kind: "comment",
            text: String(value.message ?? ""),
            authorName: from?.name ?? "Utilisateur Facebook",
            authorHandle: from?.id,
            receivedAt: graphTimeToIso(value.created_time ?? entry.time),
            raw: value,
          });
        }

        // Instagram : field "comments"
        if (object === "instagram" && field === "comments") {
          const companyId = await companyForMeta("instagram", entryId);
          if (!companyId) continue;
          const from = value.from as { username?: string; id?: string } | undefined;
          await ingestMessage(companyId, {
            channel: "instagram",
            externalId: String(value.id ?? ""),
            kind: "comment",
            text: String(value.text ?? ""),
            authorName: from?.username ? `@${from.username}` : "Utilisateur Instagram",
            authorHandle: from?.username ?? from?.id,
            receivedAt: graphTimeToIso(value.timestamp ?? entry.time),
            raw: value,
          });
        }
      }

      // — Messages privés (Messenger / IG DM) —
      for (const m of (entry.messaging as Array<Record<string, unknown>>) ?? []) {
        const message = m.message as { text?: string; mid?: string; is_echo?: boolean } | undefined;
        if (!message?.text || message.is_echo) continue; // ignore les échos (nos propres envois)
        const sender = m.sender as { id?: string } | undefined;
        const channel: InboxChannel = object === "instagram" ? "instagram" : "facebook";
        const companyId = await companyForMeta(channel === "instagram" ? "instagram" : "facebook", entryId);
        if (!companyId) continue;
        await ingestMessage(companyId, {
          channel,
          externalId: String(message.mid ?? ""),
          kind: "dm",
          text: String(message.text),
          authorName: channel === "instagram" ? "DM Instagram" : "DM Messenger",
          authorHandle: sender?.id,
          receivedAt: graphTimeToIso(m.timestamp),
          raw: m,
        });
      }
    }
  } catch (e) {
    console.error("[inbox/webhook] processing error:", e);
  }

  // Meta exige un 200 rapide, sinon il réessaie (l'ingestion est idempotente).
  return NextResponse.json({ ok: true });
}
