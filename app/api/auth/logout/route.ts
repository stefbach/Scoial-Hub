// /api/auth/logout — déconnexion FIABLE côté serveur.
//  POST → invalide la session + efface les cookies, renvoie { ok }
//         (appelé par le bouton « Se déconnecter », suivi d'un reload).
//  GET  → même chose puis REDIRIGE vers /login. Porte de secours : il suffit de
//         visiter /api/auth/logout dans la barre d'adresse pour se déconnecter.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function endSession() {
  try {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
  } catch {
    /* best-effort : on efface les cookies de toute façon ci-dessous */
  }
}

/** Efface explicitement TOUS les cookies d'auth Supabase (filet de sécurité). */
function clearAuthCookies(res: NextResponse) {
  for (const c of cookies().getAll()) {
    if (c.name.startsWith("sb-")) {
      res.cookies.set(c.name, "", { maxAge: 0, path: "/" });
    }
  }
}

export async function POST() {
  await endSession();
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}

export async function GET(req: NextRequest) {
  await endSession();
  const res = NextResponse.redirect(new URL("/login", req.url));
  clearAuthCookies(res);
  return res;
}
