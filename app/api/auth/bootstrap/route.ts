/**
 * POST /api/auth/bootstrap
 *
 * Pour l'utilisateur connecté, crée son organisation de démo + membership
 * + 3 companies (OCC/Tibok/CVMI) + ad_safety s'il n'en a pas encore.
 *
 * Idempotent : si l'organisation existe déjà, ne fait rien.
 * Best-effort : ne lève jamais d'exception vers le client.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

interface BootstrapBody {
  orgName?: string;
}

const DEMO_COMPANIES = [
  {
    code: "OCC",
    name: "Obesity Care Clinic",
    brand_voice: "warm, professional, evidence-based",
    accent: "#60a5fa",
    default_platforms: ["facebook", "instagram"],
    default_posting_time: "09:00",
    default_needs_review: false,
    ad_safety: {
      monthly_cap: 5000,
      require_budget_cap: true,
      confirm_ai_spend: true,
      double_confirm_threshold: 500,
      daily_digest: true,
    },
  },
  {
    code: "TI",
    name: "Tibok",
    brand_voice: "friendly, modern, accessible",
    accent: "#d62976",
    default_platforms: ["facebook", "instagram"],
    default_posting_time: "10:00",
    default_needs_review: false,
    ad_safety: {
      monthly_cap: 4000,
      require_budget_cap: true,
      confirm_ai_spend: true,
      double_confirm_threshold: 400,
      daily_digest: true,
    },
  },
  {
    code: "CV",
    name: "Cabo Verde Medical International",
    brand_voice: "authoritative, international, medical",
    accent: "#16a34a",
    default_platforms: ["facebook"],
    default_posting_time: "12:00",
    default_needs_review: false,
    ad_safety: {
      monthly_cap: 3000,
      require_budget_cap: true,
      confirm_ai_spend: true,
      double_confirm_threshold: 500,
      daily_digest: false,
    },
  },
];

export async function POST(req: NextRequest) {
  // Mode démo : rien à faire
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  try {
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 503 });
    }

    // Récupère l'utilisateur connecté depuis la session courante
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    // Vérifie si l'utilisateur a déjà une organisation (idempotence)
    const { data: existingMembership } = await supabase
      .from("sh_memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (existingMembership?.org_id) {
      return NextResponse.json({ ok: true, orgId: existingMembership.org_id, created: false });
    }

    // Invitations en attente : l'utilisateur REJOINT l'org de l'admin qui l'a
    // invité (équipe), avec ses accès par société — il ne crée pas sa propre org.
    try {
      const { consumeInvitations } = await import("@/lib/repositories/access");
      const joined = await consumeInvitations(user.id, user.email ?? "");
      if (joined > 0) {
        const { data: m } = await supabase
          .from("sh_memberships")
          .select("org_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();
        return NextResponse.json({ ok: true, orgId: m?.org_id ?? null, created: false, joinedTeam: true });
      }
    } catch (e) {
      console.error("[bootstrap] consumeInvitations:", e);
    }

    // Utilise le client admin pour créer l'organisation (bypass RLS pour l'insert initial)
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "admin_unavailable" }, { status: 503 });
    }

    // Récupère le nom d'organisation depuis le body (optionnel)
    let orgName = "Mon Organisation";
    let seedDemo = false;
    try {
      const body: BootstrapBody & { seedDemo?: boolean } = await req.json();
      if (body.orgName) orgName = body.orgName.trim() || orgName;
      if (body.seedDemo) seedDemo = true;
    } catch {
      // body vide, on garde le nom par défaut
    }

    // 1. Crée l'organisation
    const { data: org, error: orgError } = await admin
      .from("sh_organizations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgError || !org) {
      console.error("[bootstrap] Erreur création org:", orgError);
      return NextResponse.json({ ok: false, error: "org_creation_failed" }, { status: 500 });
    }

    const orgId = org.id as string;

    // 2. Crée le membership owner
    const { error: membershipError } = await admin
      .from("sh_memberships")
      .insert({ org_id: orgId, user_id: user.id, role: "owner" });

    if (membershipError) {
      console.error("[bootstrap] Erreur création membership:", membershipError);
      // On continue quand même pour les companies
    }

    // 3. Companies : en production l'espace démarre VIERGE (le client crée ses
    //    propres sociétés). Les sociétés de démo ne sont créées que si demandé.
    for (const company of seedDemo ? DEMO_COMPANIES : []) {
      const { ad_safety: adSafetyDefaults, ...companyData } = company;

      const { data: createdCompany, error: companyError } = await admin
        .from("sh_companies")
        .insert({ ...companyData, org_id: orgId })
        .select("id")
        .single();

      if (companyError || !createdCompany) {
        console.error("[bootstrap] Erreur création company:", companyError);
        continue;
      }

      const companyId = createdCompany.id as string;

      // 4. Crée ad_safety pour chaque company
      const { error: adSafetyError } = await admin
        .from("sh_ad_safety")
        .insert({
          company_id: companyId,
          used_this_month: 0,
          ...adSafetyDefaults,
        });

      if (adSafetyError) {
        console.error("[bootstrap] Erreur création ad_safety:", adSafetyError);
        // Non bloquant
      }
    }

    return NextResponse.json({ ok: true, orgId, created: true });
  } catch (err) {
    // Best-effort : on log mais on ne plante pas
    console.error("[bootstrap] Erreur inattendue:", err);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
