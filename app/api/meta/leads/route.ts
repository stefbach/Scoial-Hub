// GET /api/meta/leads?companyId=…&formId=…  → derniers prospects d'un formulaire.
// Nécessite le token de Page + permission leads_retrieval sur la Page.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    const formId = req.nextUrl.searchParams.get("formId");
    if (!companyId || !formId) return NextResponse.json({ error: "companyId et formId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    const token = ctx.pageToken || ctx.userToken;
    if (!token) return NextResponse.json({ leads: [], connected: false });

    const url = `https://graph.facebook.com/${V}/${encodeURIComponent(formId)}/leads?fields=created_time,field_data&limit=50&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>>; error?: { message?: string } };
    if (json.error) return NextResponse.json({ leads: [], error: json.error.message }, { status: 502 });

    const leads = (json.data ?? []).map((l) => {
      const fields: Record<string, string> = {};
      for (const f of (l.field_data as Array<{ name?: string; values?: string[] }>) ?? []) {
        if (f.name) fields[f.name] = (f.values ?? []).join(", ");
      }
      return { createdTime: String(l.created_time ?? ""), fields };
    });
    return NextResponse.json({ leads });
  } catch (e) {
    console.error("[GET /api/meta/leads]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
