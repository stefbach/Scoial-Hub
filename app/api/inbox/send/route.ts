import { NextRequest, NextResponse } from "next/server";
import {
  getMessage,
  createReply,
  updateReply,
  setMessageStatus,
} from "@/lib/repositories/inbox";
import { deliverMetaReply } from "@/lib/inbox/meta-sync";
import { requireCompanyAccess } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/inbox/send  { companyId, messageId, body, replyId?, agentId?, visibility? }
// Valide/édite une réponse et la publie sur la plateforme (best-effort).
// visibility "private" sur un commentaire : répond en MESSAGE PRIVÉ à l'auteur.
export async function POST(req: NextRequest) {
  try {
    const { companyId, messageId, body, replyId, agentId, visibility } = await req.json();
    if (!companyId || !messageId || !body?.trim()) {
      return NextResponse.json({ error: "companyId, messageId et body requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const message = await getMessage(messageId);
    if (!message) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    // Tentative d'envoi réel vers la plateforme.
    const delivery = await deliverMetaReply(
      companyId,
      {
        channel: message.channel,
        kind: message.kind,
        externalId: message.externalId,
        authorHandle: message.authorHandle,
        visibility: visibility === "private" ? "private" : "public",
      },
      body.trim()
    );
    const now = new Date().toISOString();

    // Enregistre/maj la réponse. Un envoi humain est tracé generatedBy='human'.
    let reply;
    if (replyId) {
      reply = await updateReply(replyId, {
        body: body.trim(),
        status: "sent",
        sentAt: now,
        generatedBy: "human",
      });
    } else {
      reply = await createReply(companyId, {
        messageId,
        agentId: agentId ?? null,
        body: body.trim(),
        generatedBy: "human",
        needsHuman: false,
        status: "sent",
        sentAt: now,
      });
    }

    await setMessageStatus(messageId, "answered");

    return NextResponse.json({
      reply,
      delivered: delivery.delivered,
      // Honnête : si non publié (Page non connectée…), on le signale.
      deliveryError: delivery.delivered ? undefined : delivery.error,
    });
  } catch (e) {
    console.error("[POST /api/inbox/send]", e);
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
