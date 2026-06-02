/**
 * app/api/connectors/linkedin/publish/route.ts
 *
 * POST /api/connectors/linkedin/publish
 *
 * Corps JSON attendu :
 * {
 *   companyId:          string,   // identifiant de la marque
 *   accountId:          string,   // id dans social_accounts
 *   externalAccountId?: string,   // URN LinkedIn (urn:li:person:… ou urn:li:organization:…)
 *   accessToken?:       string,   // token d'accès
 *   text:               string,   // texte du post
 *   link?:              string,   // URL optionnelle à partager
 *   linkTitle?:         string,   // titre du lien
 *   linkDescription?:  string,   // description du lien
 *   media?:             { url: string, caption?: string, mimeType?: string }
 * }
 *
 * Retourne : PublishResult { externalId, url?, simulated? }
 * Fonctionne en mode simulé si LINKEDIN_CLIENT_ID est absent.
 */

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/index";
import type { PublishInput } from "@/lib/connectors/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide." },
      { status: 400 }
    );
  }

  const { companyId, accountId, text, link, media, linkTitle, linkDescription } = body;

  if (!text || typeof text !== "string") {
    return NextResponse.json(
      { error: "Le champ `text` est requis." },
      { status: 400 }
    );
  }

  let accessToken = (body.accessToken as string | undefined) ?? "";
  let externalAccountId = (body.externalAccountId as string | undefined) ?? "";

  if ((!accessToken || !externalAccountId) && accountId) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();

      if (supabase) {
        const { data } = await supabase
          .from("social_accounts")
          .select("access_token, external_id")
          .eq("id", accountId)
          .eq("platform", "linkedin")
          .single();

        if (data) {
          accessToken = accessToken || ((data.access_token as string) ?? "");
          externalAccountId =
            externalAccountId || ((data.external_id as string) ?? "");
        }
      }
    } catch {
      // Supabase non disponible.
    }
  }

  const input: PublishInput = {
    externalAccountId,
    accessToken,
    text,
    link: (link as string | undefined) ?? undefined,
    linkTitle: (linkTitle as string | undefined) ?? undefined,
    linkDescription: (linkDescription as string | undefined) ?? undefined,
    media: media
      ? {
          url: (media as Record<string, string>).url,
          caption: (media as Record<string, string>).caption,
          mimeType: (media as Record<string, string>).mimeType,
        }
      : undefined,
  };

  try {
    const connector = getConnector("linkedin");
    const result = await connector.publishPost(input);

    // Log best-effort.
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();

      if (supabase) {
        await supabase.from("audit_log").insert({
          action: "publish_post",
          platform: "linkedin",
          company_id: companyId ?? null,
          account_id: accountId ?? null,
          external_id: result.externalId,
          simulated: result.simulated ?? false,
          metadata: { url: result.url },
        });
      }
    } catch {
      // Log non critique.
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[POST /api/connectors/linkedin/publish] Erreur :", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
