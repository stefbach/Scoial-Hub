/**
 * GET /api/video/render/<id> → état du rendu Shotstack { status, url? }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRenderStatus } from "@/lib/video/render";
import { requireUser } from "@/lib/auth/guard";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 401 });
  const status = await getRenderStatus(params.id);
  return NextResponse.json(status);
}
