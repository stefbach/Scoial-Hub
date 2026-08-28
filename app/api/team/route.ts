// /api/team — gestion de l'équipe par l'ADMIN DU COMPTE (owner/admin).
//  GET    → membres + invitations + sociétés de l'org (pour la matrice d'accès)
//  POST   → ajoute/invite un membre { email, role, access:[{companyId,mode}] }
//  PATCH  → met à jour un membre { userId, role, access }
//  DELETE → retire un membre (?userId=) ou révoque une invitation (?invitationId=)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAccountAdmin } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { sendEmail, isEmailConfigured, buildInvitationEmail, buildAddedToTeamEmail } from "@/lib/email";
import { listCompanies } from "@/lib/repositories/companies";
import {
  listTeam,
  addOrInviteMember,
  updateMember,
  removeMember,
  revokeInvitation,
} from "@/lib/repositories/access";
import { CompanyAccessGrant, OrgRole } from "@/lib/rbac/types";
import { checkSeatAvailable } from "@/lib/quota/seats";

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
    // L'écran doit dire AVANT d'inviter si l'envoi automatique est possible :
    // découvrir après coup qu'aucun e-mail n'est parti est le pire moment.
    emailConfigured: isEmailConfigured(),
  });
}

export async function POST(req: NextRequest) {
  const g = await requireAccountAdmin();
  if (!g.ok || !g.orgId) return NextResponse.json({ error: g.error }, { status: g.status ?? 403 });
  const body = (await req.json()) as { email?: string; role?: string; access?: unknown };
  const email = (body.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

  // Plafond de sièges de la formule. Contrôlé AVANT l'ajout : les invitations
  // en attente comptent, sinon le plafond se contournerait en invitant sans
  // limite et serait dépassé au fil des acceptations, sans jamais rien bloquer.
  const seats = await checkSeatAvailable(g.orgId);
  if (!seats.allowed) {
    return NextResponse.json(
      { error: seats.reason, seats: { used: seats.used, limit: seats.limit } },
      { status: 402 }
    );
  }

  const res = await addOrInviteMember(g.orgId, email, coerceRole(body.role), coerceAccess(body.access), g.userId);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });

  // #12 — Si l'invitation n'est pas partie via Supabase Auth (SMTP absent),
  // on tente l'envoi via le service e-mail applicatif (lib/email.ts, Resend).
  // emailSent ne passe à true QUE si un e-mail est réellement accepté — sinon
  // le repli honnête (lien d'invitation copiable) reste affiché côté UI.
  if ((res.invited && !res.emailSent) || res.added) {
    let inviterEmail: string | undefined;
    try {
      const sb = createClient();
      inviterEmail = (await sb?.auth.getUser())?.data.user?.email ?? undefined;
    } catch { /* inviteur anonyme : l'e-mail reste valide sans lui */ }
    const base = env.appUrl.replace(/\/$/, "");
    // Utilisateur déjà inscrit : Supabase Auth n'envoie RIEN dans ce cas (pas
    // d'inscription à faire) — on le prévient nous-mêmes de ses nouveaux accès
    // (#QA bug 10). Sinon, repli applicatif de l'invitation (SMTP absent).
    const { subject, text } = res.added
      ? buildAddedToTeamEmail({ email, loginUrl: `${base}/login`, inviterEmail })
      : buildInvitationEmail({ email, signupUrl: `${base}/signup`, inviterEmail });
    const sent = await sendEmail({ to: email, subject, text });
    res.emailSent = sent.ok;
    // Cause exacte de l'échec : « service absent » et « envoi refusé » ne se
    // corrigent pas de la même façon, et l'admin doit savoir laquelle il subit.
    if (!sent.ok) res.emailFailure = sent.failure;
  }
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
