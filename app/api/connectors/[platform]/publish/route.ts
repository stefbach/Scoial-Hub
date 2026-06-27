/**
 * app/api/connectors/[platform]/publish/route.ts
 *
 * POST /api/connectors/{platform}/publish
 *
 * Publication organique GÉNÉRIQUE pour tout réseau enregistré.
 *
 * Corps JSON :
 * {
 *   companyId?:          string,   // pour les logs / audit
 *   accountId?:          string,   // id dans sh_social_accounts (récupère le token)
 *   externalAccountId?:  string,   // id de compte côté plateforme (board_id, urn…)
 *   accessToken?:        string,   // token d'accès (prioritaire sur la base)
 *   text:                string,
 *   link?:               string,
 *   linkTitle?:          string,
 *   linkDescription?:    string,
 *   media?:              { url: string, caption?: string, mimeType?: string }
 * }
 *
 * Retourne PublishResult { externalId, url?, simulated? }. Mode simulé tant que
 * les credentials du réseau sont absents.
 */

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getConnector, isSupportedPlatform } from "@/lib/connectors/index";
import type { PublishInput } from "@/lib/connectors/types";

export async function POST(
  request: NextRequest,
  { params }: { params: { platform: string } }
): Promise<NextResponse> {
  const platform = params.platform;
  if (!isSupportedPlatform(platform)) {
    return NextResponse.json({ error: `Plateforme inconnue : ${platform}` }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const { companyId, accountId, text, link, media, linkTitle, linkDescription } = body;
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Le champ `text` est requis." }, { status: 400 });
  }

  // Récupère token + externalAccountId depuis sh_social_accounts si non fournis.
  let accessToken = (body.accessToken as string | undefined) ?? "";
  let externalAccountId = (body.externalAccountId as string | undefined) ?? "";

  if ((!accessToken || !externalAccountId) && accountId) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();
      if (supabase) {
        const { data } = await supabase
          .from("sh_social_accounts")
          .select("access_token, external_id")
          .eq("id", accountId)
          .eq("platform", platform)
          .single();
        if (data) {
          accessToken = accessToken || ((data.access_token as string) ?? "");
          externalAccountId = externalAccountId || ((data.external_id as string) ?? "");
        }
      }
    } catch {
      // Supabase non disponible → on continue avec les valeurs du corps.
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
    const result = await getConnector(platform).publishPost(input);

    // Log best-effort dans sh_audit_log.
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();
      if (supabase) {
        await supabase.from("sh_audit_log").insert({
          action: "publish_post",
          platform,
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
    console.error(`[POST /api/connectors/${platform}/publish] Erreur :`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
