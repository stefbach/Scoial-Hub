"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";

// Client Supabase côté navigateur. Retourne `null` si non configuré pour
// permettre aux appelants de retomber proprement sur les données mock.
export function createClient() {
  if (!isSupabaseConfigured) return null;
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey, {
  });
}
