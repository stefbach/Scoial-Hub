import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { sendEmail, buildAccountCreatedEmail } from "@/lib/email";

export const runtime = "nodejs";

function requireAdmin(): boolean {
  return verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
}

// GET /api/admin/users — liste les utilisateurs (admin uniquement)
export async function GET() {
  if (!requireAdmin()) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ users: [], configured: false });
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    const users = (data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      orgName: (u.user_metadata as { org_name?: string } | undefined)?.org_name ?? null,
    }));
    return NextResponse.json({ users, configured: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/admin/users — crée un utilisateur { email, password, orgName?, companyId? }
export async function POST(req: NextRequest) {
  if (!requireAdmin()) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase service role non configuré" }, { status: 400 });
  try {
    const { email, password, orgName, companyId } = await req.json();
    if (!email || !password || String(password).length < 8) {
      return NextResponse.json({ error: "Email et mot de passe (8+ caractères) requis" }, { status: 400 });
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { org_name: orgName ?? null, company_id: companyId ?? null },
    });
    if (error) throw error;

    // Rattache l'utilisateur à une organisation (best-effort)
    try {
      const userId = data.user?.id;
      if (userId) {
        let orgId: string | null = null;
        if (companyId) {
          const { data: comp } = await supabase.from("sh_companies").select("org_id").eq("id", companyId).single();
          orgId = (comp as { org_id?: string } | null)?.org_id ?? null;
        }
        if (!orgId) {
          const { data: org } = await supabase.from("sh_organizations").insert({ name: orgName ?? email }).select("id").single();
          orgId = (org as { id?: string } | null)?.id ?? null;
        }
        if (orgId) {
          await supabase.from("sh_memberships").insert({ org_id: orgId, user_id: userId, role: "owner" });
        }
      }
    } catch { /* non bloquant */ }

    // E-mail d'accès au propriétaire du compte : lien sécurisé pour définir
    // son mot de passe (généré via Supabase) + adresse de connexion. Sans
    // service e-mail configuré, emailSent reste false et l'UI indique à
    // l'admin de communiquer les identifiants lui-même.
    let emailSent = false;
    try {
      let setPasswordUrl: string | undefined;
      try {
        const { data: link } = await supabase.auth.admin.generateLink({ type: "recovery", email });
        setPasswordUrl = link?.properties?.action_link ?? undefined;
      } catch {
        /* lien facultatif : l'e-mail reste utile sans lui */
      }
      const loginUrl = `${env.appUrl.replace(/\/$/, "")}/login`;
      const { subject, text } = buildAccountCreatedEmail({ email, loginUrl, setPasswordUrl });
      emailSent = await sendEmail({ to: email, subject, text });
    } catch {
      /* l'échec d'e-mail ne doit pas annuler la création du compte */
    }

    return NextResponse.json({ ok: true, id: data.user?.id, emailSent }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
