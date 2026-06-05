import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getConnection } from "@/lib/repositories/channel-connections";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/linkedin/account?companyId=...
// Statut de connexion LinkedIn de la société + profil live (nom, photo).
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  try {
    const conn = await getConnection(await resolveCompanyUuid(companyId), "linkedin");
    const token = conn?.config?.access_token;
    if (!conn || !token) {
      return NextResponse.json({ connected: false });
    }

    const urn = conn.config.external_id ?? "";
    let name = conn.config.account_name ?? "LinkedIn";
    let picture: string | undefined;

    // Profil live (OpenID userinfo) — best effort.
    try {
      const r = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) {
        const u = (await r.json()) as { name?: string; picture?: string };
        if (u.name) name = u.name;
        if (u.picture) picture = u.picture;
      }
    } catch {
      /* token peut-être expiré — on garde les valeurs stockées */
    }

    return NextResponse.json({
      connected: true,
      accountName: name,
      urn,
      picture,
      isOrganization: urn.startsWith("urn:li:organization:"),
    });
  } catch (e) {
    console.error("[GET /api/linkedin/account]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
