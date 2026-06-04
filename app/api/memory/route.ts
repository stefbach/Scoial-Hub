// GET  /api/memory?companyId=…        → { brief, memory }
// POST /api/memory { companyId, entries[] } → ajoute des entrées à la mémoire

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { appendMemory, listMemory, getBrief, type MemoryEntry } from "@/lib/memory";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const [brief, memory] = await Promise.all([getBrief(companyId), listMemory(companyId, { limit: 60 })]);
    return NextResponse.json({ brief, memory });
  } catch (err) {
    console.error("[GET /api/memory]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { companyId, entries } = (await req.json()) as { companyId?: string; entries?: MemoryEntry[] };
    if (!companyId || !Array.isArray(entries)) {
      return NextResponse.json({ error: "companyId et entries[] requis" }, { status: 400 });
    }
    const added = await appendMemory(companyId, entries);
    return NextResponse.json({ added });
  } catch (err) {
    console.error("[POST /api/memory]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
