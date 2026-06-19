// /api/mirofish/available — indique au client si le moteur premium MiroFish est
// branché (sans exposer l'URL/clé de l'instance). Route statique : prioritaire
// sur le proxy catch-all [...path].

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { isMirofishConfigured } from "@/lib/env";

export async function GET() {
  return NextResponse.json({ available: isMirofishConfigured });
}
