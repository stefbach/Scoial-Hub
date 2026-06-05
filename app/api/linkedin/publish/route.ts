import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getConnection } from "@/lib/repositories/channel-connections";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getConnector } from "@/lib/connectors/index";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/linkedin/publish  { companyId, text, link?, imageUrl?, linkTitle?, linkDescription? }
export async function POST(req: NextRequest) {
  try {
    const { companyId, text, link, imageUrl, linkTitle, linkDescription } = await req.json();
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!text?.trim()) return NextResponse.json({ error: "Texte requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const uuid = await resolveCompanyUuid(companyId);
    const conn = await getConnection(uuid, "linkedin");
    const token = conn?.config?.access_token;
    const urn = conn?.config?.external_id;
    if (!conn || !token || !urn) {
      return NextResponse.json({ connected: false, error: "LinkedIn non connecté." });
    }

    const result = await getConnector("linkedin").publishPost({
      externalAccountId: urn,
      accessToken: token,
      text: text.trim(),
      link: link || undefined,
      linkTitle: linkTitle || undefined,
      linkDescription: linkDescription || undefined,
      media: imageUrl ? { url: imageUrl } : undefined,
    });

    // Trace dans l'Historique (vérifiable) si réellement publié.
    if (!result.simulated) {
      try {
        const sb = createAdminClient();
        if (sb) {
          await sb.from("sh_history_items").insert({
            company_id: uuid,
            platform: "linkedin",
            body: text.trim().slice(0, 280),
            full_body: text.trim(),
            external_url: result.url ?? null,
            published_at: new Date().toISOString(),
            source: "manual",
            status: "published",
          });
        }
      } catch {
        /* non bloquant */
      }
    }

    return NextResponse.json({ connected: true, ...result });
  } catch (e) {
    console.error("[POST /api/linkedin/publish]", e);
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
