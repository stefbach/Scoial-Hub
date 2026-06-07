// /api/companies/[id] — édition / suppression d'une société par l'ADMIN DU COMPTE.
//  PATCH  { name?, brandVoice?, accent?, logoUrl?, defaultPlatforms? }
//  DELETE → supprime la société (et, par cascade, ses accès)

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAccountAdmin } from "@/lib/auth/guard";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { updateCompany } from "@/lib/repositories/companies";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Company } from "@/lib/types";

/** Vérifie que la société appartient bien à l'org de l'admin courant. */
async function assertOwnership(companyId: string): Promise<{ ok: boolean; uuid?: string; status?: number; error?: string }> {
  const g = await requireAccountAdmin();
  if (!g.ok || !g.orgId) return { ok: false, status: g.status ?? 403, error: g.error };
  const uuid = await resolveCompanyUuid(companyId);
  if (!isSupabaseConfigured) return { ok: true, uuid };
  const sb = createAdminClient();
  if (!sb) return { ok: true, uuid };
  const { data } = await sb.from("sh_companies").select("org_id").eq("id", uuid).maybeSingle();
  if (!data) return { ok: false, status: 404, error: "Société introuvable" };
  if (String(data.org_id) !== g.orgId) return { ok: false, status: 403, error: "Société hors de votre organisation" };
  return { ok: true, uuid };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const own = await assertOwnership(params.id);
  if (!own.ok || !own.uuid) return NextResponse.json({ error: own.error }, { status: own.status ?? 403 });
  try {
    const body = (await req.json()) as Partial<Company>;
    const patch: Partial<Omit<Company, "id">> = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.brandVoice === "string") patch.brandVoice = body.brandVoice;
    if (typeof body.accent === "string") patch.accent = body.accent;
    if (typeof body.logoUrl === "string") patch.logoUrl = body.logoUrl;
    if (Array.isArray(body.defaultPlatforms)) patch.defaultPlatforms = body.defaultPlatforms;
    const company = await updateCompany(own.uuid, patch);
    return NextResponse.json({ company });
  } catch (e) {
    console.error("[PATCH /api/companies/[id]]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const own = await assertOwnership(params.id);
  if (!own.ok || !own.uuid) return NextResponse.json({ error: own.error }, { status: own.status ?? 403 });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true });
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ ok: true });
  const { error } = await sb.from("sh_companies").delete().eq("id", own.uuid);
  if (error) {
    console.error("[DELETE /api/companies/[id]]", error);
    return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
