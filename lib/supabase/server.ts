import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, isSupabaseConfigured } from "@/lib/env";

// Client Supabase côté serveur (API routes, Server Components, Server Actions).
// Retourne `null` si non configuré → l'appelant retombe sur le mock.
export function createClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    db: { schema: "social_hub" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll appelé depuis un Server Component — ignorable si le
          // refresh de session est géré par le middleware.
        }
      },
    },
  });
}

// Client "admin" (service_role) — bypass RLS, SERVEUR UNIQUEMENT.
// À n'utiliser que pour des tâches de fond / agents IA dûment autorisés.
export function createAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return createServerClient(env.supabaseUrl, env.supabaseServiceKey, {
    db: { schema: "social_hub" },
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
