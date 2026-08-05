import { NextRequest, NextResponse } from "next/server";
import { listCompanies, createCompany } from "@/lib/repositories/companies";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionUser, getMyOrgId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin";
import { chooseOrgSource } from "@/lib/auth/org-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/companies
// Sécurité multi-tenant : la liste est déterminée par la SESSION serveur, jamais
// par un paramètre client.
//  - Admin (cookie)   : peut filtrer par ?orgId=, sinon voit tout (console admin).
//  - Client connecté  : UNIQUEMENT les sociétés de SA propre organisation.
//  - Non authentifié  : 401 (aucune donnée).
//  - Mode démo (no DB): données mock.
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(await listCompanies());
    }

    const isAdmin = verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
    if (isAdmin) {
      const orgId = req.nextUrl.searchParams.get("orgId") ?? undefined;
      return NextResponse.json(await listCompanies(orgId));
    }

    // Client : on impose l'organisation issue de la session (param ignoré).
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const orgId = await getMyOrgId();
    if (!orgId) return NextResponse.json([]); // pas d'org → aucune société
    return NextResponse.json(await listCompanies(orgId));
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
// - Admin (cookie) AVEC orgId : crée dans l'organisation désignée (dépannage).
// - Sinon : la société est créée dans l'organisation de l'utilisateur connecté
//   (créée à la volée si nécessaire) — orgId du body ignoré par sécurité.
//
// Le cookie admin ne doit JAMAIS empêcher une création ordinaire : il survit à
// une visite de la console admin dans le même navigateur, et aucun écran de
// création (modale client, assistant admin) n'envoie d'orgId. Exiger orgId dès
// que ce cookie existe rendait donc « Nouvelle société » impossible pour un
// utilisateur ayant ouvert /admin une fois (« orgId requis (admin) »).
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
      const fromBody = chooseOrgSource(isAdmin, bodyOrgId) === "body" ? bodyOrgId : undefined;
      if (fromBody) {
        // Dépannage : l'admin peut créer une société dans n'importe quelle org.
        orgId = fromBody;
      } else {
        // Cas courant : on impose l'organisation de la SESSION (jamais celle du
        // body) — y compris pour un admin qui crée sa propre société.
        const user = await getSessionUser();
        if (!user) {
          return NextResponse.json(
            {
              error: isAdmin
                ? "orgId requis : aucune session utilisateur pour déduire l'organisation."
                : "Non authentifié",
            },
            { status: isAdmin ? 400 : 401 }
          );
        }
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
      accent: input.accent ?? "#60a5fa",
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
