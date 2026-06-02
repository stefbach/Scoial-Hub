import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

// Diagnostic temporaire : exécute la requête companies et renvoie l'erreur brute.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ configured: isSupabaseConfigured, client: false });
  }
  const { data, error } = await supabase
    .from("companies")
    .select("id,code,name")
    .limit(5);
  return NextResponse.json({
    configured: isSupabaseConfigured,
    client: true,
    error: error ? { message: error.message, code: (error as { code?: string }).code, details: (error as { details?: string }).details, hint: (error as { hint?: string }).hint } : null,
    rowCount: data?.length ?? 0,
    rows: data ?? null,
  });
}
