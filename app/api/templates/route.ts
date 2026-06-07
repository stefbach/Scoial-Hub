// POST /api/templates  { companyId, platform, body?, tags?, mediaUrl?, mediaKind?, status? }
// Ajoute un visuel à la bibliothèque (sh_templates).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      platform?: string;
      body?: string;
      tags?: string[];
      mediaUrl?: string;
      mediaKind?: "image" | "video";
      status?: string;
    };
    if (!body.companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const platform =["facebook", "instagram", "linkedin", "tiktok"].includes(body.platform ?? "")
      ? body.platform!
      : "instagram";
    const media = body.mediaUrl
      ? { kind: body.mediaKind ?? "image", ready: true, url: body.mediaUrl }
      : { kind: "none", ready: false };

    if (!isSupabaseConfigured) {
      return NextResponse.json({ ok: true, simulated: true });
    }
    const supabase = createClient();
    if (!supabase) return NextResponse.json({ ok: true, simulated: true });

    const { data, error } = await supabase
      .from("sh_templates")
      .insert({
        company_id: await resolveCompanyUuid(body.companyId),
        platform,
        tags: body.tags ?? ["studio"],
        body: body.body ?? "",
        status: body.status ?? "unused",
        media,
        added_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/templates]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, template: data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/templates]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
