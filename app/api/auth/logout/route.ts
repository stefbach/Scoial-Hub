// POST /api/auth/logout — déconnexion FIABLE côté serveur : invalide la session
// et efface les cookies d'auth (ce que le client navigateur ne fait pas toujours
// de façon fiable). Le front fait ensuite un rechargement complet vers /login.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = createClient();
    if (supabase) {
      // scope global : révoque la session côté Supabase + efface les cookies.
      await supabase.auth.signOut();
    }
  } catch {
    // best-effort : on renvoie ok quand même, le client redirige.
  }
  return NextResponse.json({ ok: true });
}
