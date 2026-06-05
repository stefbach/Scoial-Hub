import { NextRequest, NextResponse } from "next/server";
import { listCompanies, createCompany } from "@/lib/repositories/companies";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionUser, getMyOrgId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/companies[?orgId=...]
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId") ?? undefined;
    const companies = await listCompanies(orgId);
    return NextResponse.json(companies);
  } catch (err) {
    console.error("[GET /api/companies]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Génère un code court (2–6 car. alphanum. majuscules) à partir du nom. */
function codeFromName(name: string): string {
  const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return "BR" + Math.floor(Math.random() * 90 + 10);
  // Initiales des mots si plusieurs mots, sinon les 3 premières lettres.
  const words = name.trim().split(/\s+/).filter(Boolean);
  const base = words.length > 1
    ? words.map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "")
    : clean.slice(0, 3);
  return (base || clean).slice(0, 6).padEnd(2, "X");
}

/** S'assure que l'utilisateur a une organisation ; en crée une au besoin. */
async function ensureOrgForUser(userId: string, nameHint: string): Promise<string | null> {
  const existing = await getMyOrgId();
  if (existing) return existing;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: org } = await admin
    .from("sh_organizations")
    .insert({ name: nameHint ? `${nameHint} — espace` : "Mon espace" })
    .select("id")
    .single();
  if (!org?.id) return null;
  await admin.from("sh_memberships").insert({ org_id: org.id, user_id: userId, role: "owner" });
  return String(org.id);
}

// POST /api/companies
// Body: { orgId?, name, code?, brandVoice?, accent?, ... }
// - Admin (cookie) : peut fournir orgId explicitement (dépannage).
// - Client connecté : la société est créée dans SA propre organisation
//   (créée à la volée si nécessaire) — orgId du body ignoré par sécurité.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId: rawOrgId, ...input } = body;
    const bodyOrgId: string | undefined =
      typeof rawOrgId === "string" && rawOrgId.trim() ? rawOrgId.trim() : undefined;

    if (!input.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    let orgId = "local-dev";
    if (isSupabaseConfigured) {
      const isAdmin = verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
      if (isAdmin) {
        // Dépannage : l'admin peut créer une société dans n'importe quelle org.
        if (!bodyOrgId) {
          return NextResponse.json({ error: "orgId requis (admin)" }, { status: 400 });
        }
        orgId = bodyOrgId;
      } else {
        // Client : on impose SA propre organisation (jamais celle du body).
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        const resolved = await ensureOrgForUser(user.id, input.name);
        if (!resolved) {
          return NextResponse.json({ error: "Organisation introuvable" }, { status: 500 });
        }
        orgId = resolved;
      }
    }

    const code = (typeof input.code === "string" && input.code.trim())
      ? input.code.trim().toUpperCase().slice(0, 6)
      : codeFromName(input.name);

    const company = await createCompany(orgId, {
      name: input.name,
      code,
      brandVoice: input.brandVoice ?? "",
      accent: input.accent ?? "#2563eb",
      logoUrl: input.logoUrl,
      defaultPlatforms: input.defaultPlatforms,
      defaultPostingTime: input.defaultPostingTime,
      defaultNeedsReview: input.defaultNeedsReview ?? false,
    });

    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    console.error("[POST /api/companies]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
