// /api/admin/orgs — ADMIN GÉNÉRALE / PILOTAGE (console opérateur de la plateforme).
//  GET  → liste des organisations (comptes clients) avec statut, plan et compteurs
//  POST → valide / suspend / réactive une organisation { orgId, action }
// Réservé à l'opérateur de la plateforme (cookie admin).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

function ensureAdmin(): boolean {
  return verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
}

export async function GET() {
  if (!ensureAdmin()) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!isSupabaseConfigured) return NextResponse.json({ orgs: [] });
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ orgs: [] });

  const { data: orgs } = await sb
    .from("sh_organizations")
    .select("id, name, status, plan, approved_at, created_at")
    .order("created_at", { ascending: false });

  // Compteurs (membres + sociétés) par org.
  const [{ data: members }, { data: companies }] = await Promise.all([
    sb.from("sh_memberships").select("org_id"),
    sb.from("sh_companies").select("org_id"),
  ]);
  const countBy = (rows: { org_id: unknown }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(String(r.org_id), (m.get(String(r.org_id)) ?? 0) + 1);
    return m;
  };
  const mc = countBy(members);
  const cc = countBy(companies);

  return NextResponse.json({
    orgs: (orgs ?? []).map((o) => ({
      id: String(o.id),
      name: String(o.name ?? ""),
      status: (o.status as string) ?? "approved",
      plan: (o.plan as string) ?? "trial",
      approvedAt: o.approved_at ? String(o.approved_at) : null,
      createdAt: o.created_at ? String(o.created_at) : null,
      members: mc.get(String(o.id)) ?? 0,
      companies: cc.get(String(o.id)) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!ensureAdmin()) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = (await req.json()) as { orgId?: string; action?: string; plan?: string };
  if (!body.orgId) return NextResponse.json({ error: "orgId requis" }, { status: 400 });
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true });
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ ok: true });

  const patch: Record<string, unknown> = {};
  switch (body.action) {
    case "approve":
      patch.status = "approved";
      patch.approved_at = new Date().toISOString();
      break;
    case "suspend":
      patch.status = "suspended";
      break;
    case "reactivate":
      patch.status = "approved";
      break;
    case "plan":
      if (body.plan) patch.plan = body.plan;
      break;
    default:
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }
  const { error } = await sb.from("sh_organizations").update(patch).eq("id", body.orgId);
  if (error) return NextResponse.json({ error: "Échec" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
