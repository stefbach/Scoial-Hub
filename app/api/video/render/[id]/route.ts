/**
 * GET /api/video/render/<id> → état du rendu Shotstack { status, url? }
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRenderStatus } from "@/lib/video/render";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const status = await getRenderStatus(params.id);
  return NextResponse.json(status);
}
