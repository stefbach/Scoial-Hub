// /api/team — gestion de l'équipe par l'ADMIN DU COMPTE (owner/admin).
//  GET    → membres + invitations + sociétés de l'org (pour la matrice d'accès)
//  POST   → ajoute/invite un membre { email, role, access:[{companyId,mode}] }
//  PATCH  → met à jour un membre { userId, role, access }
//  DELETE → retire un membre (?userId=) ou révoque une invitation (?invitationId=)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAccountAdmin } from "@/lib/auth/guard";
import { listCompanies } from "@/lib/repositories/companies";
import {
  listTeam,
  addOrInviteMember,
  updateMember,
  removeMember,
  revokeInvitation,
} from "@/lib/repositories/access";
import { CompanyAccessGrant, OrgRole } from "@/lib/rbac/types";

function coerceAccess(v: unknown): CompanyAccessGrant[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const companyId = typeof o.companyId === "string" ? o.companyId : "";
      const mode = o.mode === "edit" ? "edit" : "view";
      return companyId ? { companyId, mode: mode as "edit" | "view" } : null;
    })
    .filter((x): x is CompanyAccessGrant => Boolean(x));
}

function coerceRole(v: unknown): OrgRole {
  return v === "admin" || v === "owner" ? (v as OrgRole) : "member";
}

export async function GET() {
  const g = await requireAccountAdmin();
  if (!g.ok || !g.orgId) return NextResponse.json({ error: g.error }, { status: g.status ?? 403 });
  const [{ members, invitations }, companies] = await Promise.all([
    listTeam(g.orgId),
    listCompanies(g.orgId),
  ]);
  return NextResponse.json({
    members,
    invitations,
    companies: companies.map((c) => ({ id: c.id, name: c.name, code: c.code })),
  });
}

export async function POST(req: NextRequest) {
  const g = await requireAccountAdmin();
  if (!g.ok || !g.orgId) return NextResponse.json({ error: g.error }, { status: g.status ?? 403 });
  const body = (await req.json()) as { email?: string; role?: string; access?: unknown };
  const email = (body.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });
  const res = await addOrInviteMember(g.orgId, email, coerceRole(body.role), coerceAccess(body.access), g.userId);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}

export async function PATCH(req: NextRequest) {
  const g = await requireAccountAdmin();
  if (!g.ok || !g.orgId) return NextResponse.json({ error: g.error }, { status: g.status ?? 403 });
  const body = (await req.json()) as { userId?: string; role?: string; access?: unknown };
  if (!body.userId) return NextResponse.json({ error: "userId requis" }, { status: 400 });
  const res = await updateMember(g.orgId, body.userId, coerceRole(body.role), coerceAccess(body.access), g.userId);
  return NextResponse.json(res);
}

export async function DELETE(req: NextRequest) {
  const g = await requireAccountAdmin();
  if (!g.ok || !g.orgId) return NextResponse.json({ error: g.error }, { status: g.status ?? 403 });
  const userId = req.nextUrl.searchParams.get("userId");
  const invitationId = req.nextUrl.searchParams.get("invitationId");
  if (invitationId) return NextResponse.json(await revokeInvitation(g.orgId, invitationId));
  if (userId) return NextResponse.json(await removeMember(g.orgId, userId));
  return NextResponse.json({ error: "userId ou invitationId requis" }, { status: 400 });
}
