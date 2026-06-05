import { NextRequest, NextResponse } from "next/server";
import { listMessages, ingestMessage } from "@/lib/repositories/inbox";
import { requireCompanyAccess } from "@/lib/auth/guard";
import type { InboxChannel, InboxMessageStatus } from "@/lib/inbox/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/inbox/messages?companyId=...&status=pending&channel=facebook
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
  try {
    const status = (req.nextUrl.searchParams.get("status") as InboxMessageStatus) || undefined;
    const channel = (req.nextUrl.searchParams.get("channel") as InboxChannel) || undefined;
    const messages = await listMessages(companyId, { status, channel });
    return NextResponse.json(messages);
  } catch (e) {
    console.error("[GET /api/inbox/messages]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/inbox/messages  — ingestion d'un message (webhook ou simulation démo)
// { companyId, channel, text, authorName?, externalId?, kind?, permalink? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, ...input } = body;
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!input.channel || !input.text) {
      return NextResponse.json({ error: "channel et text requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    const msg = await ingestMessage(companyId, input);
    if (!msg) return NextResponse.json({ duplicate: true }, { status: 200 });
    return NextResponse.json(msg, { status: 201 });
  } catch (e) {
    console.error("[POST /api/inbox/messages]", e);
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
