"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client pinned to the `sh` schema. Session is stored
// in cookies so it's shared with the Next.js server (middleware + RSC).
//
// Note: we intentionally don't pass a typed Database generic here. The schema
// generic in @supabase/ssr is strict about Insert/Update shapes for tables we
// haven't fully typed yet; we cast at the row level in callers instead. When
// we generate full database types in a later phase, we can re-introduce the
// generic.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "sh" },
    }
  );
}
