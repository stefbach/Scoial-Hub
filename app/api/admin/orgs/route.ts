// /api/admin/orgs — ADMIN GÉNÉRALE / PILOTAGE (console opérateur de la plateforme).
//  GET  → liste des COMPTES CLIENTS (organisations) avec leur admin (utilisateur),
//         statut, plan et compteurs (sociétés / membres).
//  POST → { action }
//         • "create"     { name, adminEmail, password } → crée le compte client :
//                         organisation (validée) + utilisateur admin + membership owner.
//         • "approve" | "suspend" | "reactivate" | "plan" { orgId, plan? }
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

/** email ↔ id de tous les utilisateurs (une page suffit pour l'échelle visée). */
async function allUsers(sb: NonNullable<ReturnType<typeof createAdminClient>>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.id && u.email) map.set(u.id, u.email);
  } catch { /* ignore */ }
  return map;
}

export async function GET() {
  if (!ensureAdmin()) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!isSupabaseConfigured) return NextResponse.json({ orgs: [] });
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ orgs: [] });

  const [{ data: orgs }, { data: members }, { data: companies }, emails] = await Promise.all([
    sb.from("sh_organizations").select("id, name, status, plan, approved_at, created_at").order("created_at", { ascending: false }),
    sb.from("sh_memberships").select("org_id, user_id, role"),
    sb.from("sh_companies").select("org_id"),
    allUsers(createAdminClient()!),
  ]);

  const countBy = (rows: { org_id: unknown }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(String(r.org_id), (m.get(String(r.org_id)) ?? 0) + 1);
    return m;
  };
  const mc = countBy(members);
  const cc = countBy(companies);

  // Admin (owner en priorité, sinon admin) de chaque organisation = le lien utilisateur.
  const adminByOrg = new Map<string, { email: string; userId: string }>();
  for (const m of members ?? []) {
    const orgId = String(m.org_id);
    const role = String(m.role);
    const existing = adminByOrg.get(orgId);
    if (role === "owner" || (role === "admin" && !existing)) {
      const email = emails.get(String(m.user_id));
      if (email) adminByOrg.set(orgId, { email, userId: String(m.user_id) });
    }
  }

  return NextResponse.json({
    orgs: (orgs ?? []).map((o) => {
      const admin = adminByOrg.get(String(o.id));
      return {
        id: String(o.id),
        name: String(o.name ?? ""),
        status: (o.status as string) ?? "approved",
        plan: (o.plan as string) ?? "trial",
        approvedAt: o.approved_at ? String(o.approved_at) : null,
        createdAt: o.created_at ? String(o.created_at) : null,
        members: mc.get(String(o.id)) ?? 0,
        companies: cc.get(String(o.id)) ?? 0,
        adminEmail: admin?.email ?? null,
        adminUserId: admin?.userId ?? null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  if (!ensureAdmin()) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = (await req.json()) as {
    action?: string;
    orgId?: string;
    plan?: string;
    name?: string;
    adminEmail?: string;
    password?: string;
  };
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true });
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: "Service role non configuré" }, { status: 400 });

  // ── Création d'un COMPTE CLIENT : organisation + utilisateur admin ───────────
  if (body.action === "create") {
    const name = (body.name ?? "").trim();
    const email = (body.adminEmail ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!name) return NextResponse.json({ error: "Nom du compte requis" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email de l'admin requis" }, { status: 400 });

    // Crée l'organisation (validée d'emblée puisque créée par l'opérateur).
    const { data: org, error: orgErr } = await sb
      .from("sh_organizations")
      .insert({ name, status: "approved", approved_at: new Date().toISOString() })
      .select("id")
      .single();
    if (orgErr || !org) return NextResponse.json({ error: "Création de l'organisation impossible" }, { status: 500 });
    const orgId = String(org.id);

    // Trouve l'utilisateur s'il existe déjà, sinon le crée (mot de passe requis).
    const emails = await allUsers(sb);
    let userId: string | null = null;
    for (const [id, e] of emails) if (e.toLowerCase() === email) { userId = id; break; }

    if (!userId) {
      if (password.length < 8) {
        return NextResponse.json({ error: "Mot de passe (8+ caractères) requis pour un nouvel admin" }, { status: 400 });
      }
      const { data: created, error: userErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (userErr || !created.user) {
        return NextResponse.json({ error: userErr?.message ?? "Création de l'utilisateur impossible" }, { status: 500 });
      }
      userId = created.user.id;
    }

    // Rattache l'utilisateur comme ADMIN (owner) du compte.
    await sb.from("sh_memberships").upsert(
      { org_id: orgId, user_id: userId, role: "owner", status: "active" },
      { onConflict: "org_id,user_id" }
    );

    return NextResponse.json({ ok: true, orgId, userId }, { status: 201 });
  }

  // ── Cycle de vie d'un compte (validation / suspension / plan) ────────────────
  if (!body.orgId) return NextResponse.json({ error: "orgId requis" }, { status: 400 });
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
