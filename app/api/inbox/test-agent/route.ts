import { NextRequest, NextResponse } from "next/server";
import { draftReply } from "@/lib/inbox/respond";
import { requireCompanyAccess } from "@/lib/auth/guard";
import type { InboxAgent, InboxMessage } from "@/lib/inbox/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/inbox/test-agent  { companyId, message, agent }
// Essaie la config COURANTE d'un agent (non persistée) sur un message d'exemple.
// Ne persiste RIEN : sert d'aperçu « à quoi ressemblerait la réponse ? ».
export async function POST(req: NextRequest) {
  try {
    const { companyId, message, agent } = await req.json();
    if (!companyId || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "companyId et message requis" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    }

    // Message transitoire : un commentaire Facebook fictif, jamais enregistré.
    const transientMessage: InboxMessage = {
      id: "test",
      companyId,
      channel: "facebook",
      kind: "comment",
      authorName: "Test",
      text: message.trim(),
      status: "pending",
      receivedAt: new Date().toISOString(),
    };

    // Agent transitoire reconstruit depuis le formulaire courant (non persisté).
    const a = (agent ?? {}) as Partial<InboxAgent>;
    const transientAgent: InboxAgent = {
      id: "test",
      companyId,
      name: typeof a.name === "string" ? a.name : "Test",
      scope: a.scope === "channel" ? "channel" : "all",
      channels: Array.isArray(a.channels) ? a.channels : [],
      enabled: true,
      autonomy: a.autonomy === "auto" ? "auto" : "suggest",
      persona: typeof a.persona === "string" ? a.persona : "",
      language: a.language === "fr" || a.language === "en" ? a.language : "auto",
      confidenceThreshold:
        typeof a.confidenceThreshold === "number" ? a.confidenceThreshold : 0.7,
      escalationKeywords: Array.isArray(a.escalationKeywords) ? a.escalationKeywords : [],
      signature: typeof a.signature === "string" ? a.signature : "",
    };

    const draft = await draftReply(companyId, transientMessage, transientAgent);

    return NextResponse.json({
      body: draft.body,
      confidence: draft.confidence,
      needsHuman: draft.needsHuman,
      reason: draft.reason,
      sentiment: draft.sentiment,
    });
  } catch (e) {
    console.error("[POST /api/inbox/test-agent]", e);
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
