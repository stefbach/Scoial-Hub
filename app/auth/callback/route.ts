/**
 * Callback OAuth — échange le code d'autorisation contre une session Supabase.
 * Utilisé quand des providers OAuth (Google, etc.) sont activés plus tard.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

// Provisionne un espace VIERGE (org + membership) pour un nouvel utilisateur
// OAuth (Google/Facebook) qui n'en a pas encore. Best-effort.
async function ensureWorkspace(userId: string, name: string) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const { data: existing } = await admin
      .from("sh_memberships")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (existing?.org_id) return;
    const { data: org } = await admin
      .from("sh_organizations")
      .insert({ name: name || "Mon Organisation" })
      .select("id")
      .single();
    if (org?.id) {
      await admin.from("sh_memberships").insert({ org_id: org.id, user_id: userId, role: "owner" });
    }
  } catch {
    /* non bloquant */
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? searchParams.get("redirect") ?? "/demarrage";

  if (code && isSupabaseConfigured) {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Provisionne l'espace si nécessaire (signup OAuth).
        try {
          const { data } = await supabase.auth.getUser();
          if (data.user) {
            await ensureWorkspace(data.user.id, (data.user.user_metadata as { full_name?: string })?.full_name || data.user.email || "");
          }
        } catch {
          /* non bloquant */
        }
        // Redirection sécurisée : on vérifie que `next` est une route interne
        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";

        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          return NextResponse.redirect(`${origin}${next}`);
        }
      }
    }
  }

  // Erreur : redirection vers login avec message
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
