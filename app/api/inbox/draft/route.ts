import { NextRequest, NextResponse } from "next/server";
import {
  getMessage,
  listAgents,
  pickAgentForChannel,
  createReply,
  setMessageStatus,
  setMessageSentiment,
} from "@/lib/repositories/inbox";
import { draftReply } from "@/lib/inbox/respond";
import { deliverMetaReply } from "@/lib/inbox/meta-sync";
import { requireCompanyAccess } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/inbox/draft  { companyId, messageId }
// Génère (et envoie si l'agent est autonome + confiant) une réponse.
export async function POST(req: NextRequest) {
  try {
    const { companyId, messageId } = await req.json();
    if (!companyId || !messageId) {
      return NextResponse.json({ error: "companyId et messageId requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const message = await getMessage(messageId);
    if (!message) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    const agents = await listAgents(companyId);
    const agent = pickAgentForChannel(agents, message.channel);

    const draft = await draftReply(companyId, message, agent);
    if (draft.sentiment) await setMessageSentiment(messageId, draft.sentiment);

    // Auto-envoi : seulement si un agent autonome est confiant ET aucune escalade.
    const canAuto = agent?.autonomy === "auto" && !draft.needsHuman;
    let delivered = false;
    let deliveryError: string | undefined;

    if (canAuto) {
      const res = await deliverMetaReply(
        companyId,
        { channel: message.channel, kind: message.kind, externalId: message.externalId, authorHandle: message.authorHandle },
        draft.body
      );
      delivered = res.delivered;
      deliveryError = res.error;
    }

    const reply = await createReply(companyId, {
      messageId,
      agentId: agent?.id ?? null,
      body: draft.body,
      generatedBy: "ai",
      confidence: draft.confidence,
      needsHuman: draft.needsHuman,
      reason: draft.reason,
      status: delivered ? "sent" : "suggested",
      sentAt: delivered ? new Date().toISOString() : null,
    });

    // Statut du message.
    if (delivered) await setMessageStatus(messageId, "answered");
    else if (draft.needsHuman) await setMessageStatus(messageId, "needs_human");
    // sinon : reste 'pending' avec une suggestion à valider.

    return NextResponse.json({
      reply,
      agent: agent ? { id: agent.id, name: agent.name, autonomy: agent.autonomy } : null,
      delivered,
      autoSent: delivered,
      deliveryError,
    });
  } catch (e) {
    console.error("[POST /api/inbox/draft]", e);
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
