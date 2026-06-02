/**
 * GET /api/agents
 * Retourne le roster complet des 7 agents définis dans lib/agents/roster.ts.
 */

import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents/roster";

export async function GET() {
  return NextResponse.json(AGENTS);
}
