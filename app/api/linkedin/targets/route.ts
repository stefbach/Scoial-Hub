import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getConnection } from "@/lib/repositories/channel-connections";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LI_V = "202405";

async function liGet(path: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://api.linkedin.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": LI_V,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// GET /api/linkedin/targets?companyId=...
// Liste les cibles de publication : le PROFIL membre + les PAGES (organisations)
// que le membre administre. Les Pages nécessitent les scopes « organisation »
// (Community Management) — sinon orgsAvailable=false avec une note.
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  try {
    const conn = await getConnection(await resolveCompanyUuid(companyId), "linkedin");
    const token = conn?.config?.access_token;
    if (!conn || !token) return NextResponse.json({ connected: false });

    const personUrn = conn.config.external_id ?? "";
    let personName = conn.config.account_name ?? "Mon profil";
    let personPicture: string | undefined;
    try {
      const u = await liGet("/v2/userinfo", token);
      if (u?.name) personName = String(u.name);
      if (u?.picture) personPicture = String(u.picture);
    } catch { /* ignore */ }

    // ── Organisations administrées (Pages) ──────────────────────────────────
    const organizations: { urn: string; name: string }[] = [];
    let orgsAvailable = true;
    const acl = await liGet(
      "/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=50",
      token
    );
    if (!acl) {
      // 403/erreur = scopes organisation non accordés (revue LinkedIn requise).
      orgsAvailable = false;
    } else {
      const elements = (acl.elements as Array<Record<string, unknown>>) ?? [];
      for (const el of elements) {
        const orgUrn = String(el.organizationalTarget ?? "");
        if (!orgUrn) continue;
        const id = orgUrn.split(":").pop();
        let name = orgUrn;
        const org = await liGet(`/v2/organizations/${id}`, token);
        if (org?.localizedName) name = String(org.localizedName);
        organizations.push({ urn: orgUrn, name });
      }
    }

    const selected = conn.config.publish_as || personUrn;

    return NextResponse.json({
      connected: true,
      person: { urn: personUrn, name: personName, picture: personPicture },
      organizations,
      orgsAvailable,
      selected,
    });
  } catch (e) {
    console.error("[GET /api/linkedin/targets]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/linkedin/targets { companyId, urn, name? }
// Mémorise la cible de publication choisie (profil ou Page).
export async function POST(req: NextRequest) {
  try {
    const { companyId, urn, name } = await req.json();
    if (!companyId || !urn) return NextResponse.json({ error: "companyId et urn requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const { upsertConnection } = await import("@/lib/repositories/channel-connections");
    await upsertConnection(
      await resolveCompanyUuid(companyId),
      "linkedin",
      { publish_as: String(urn), publish_as_name: name ? String(name) : "" },
      "connected"
    );
    return NextResponse.json({ ok: true, selected: urn });
  } catch (e) {
    console.error("[POST /api/linkedin/targets]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
