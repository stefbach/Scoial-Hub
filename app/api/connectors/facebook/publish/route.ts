/**
 * app/api/connectors/facebook/publish/route.ts
 *
 * POST /api/connectors/facebook/publish
 *
 * Corps JSON attendu :
 * {
 *   companyId:   string,          // identifiant de la marque (pour les logs)
 *   accountId:   string,          // id dans social_accounts (pour récupérer les tokens)
 *   externalAccountId: string,    // page_id Facebook (requis si accessToken fourni directement)
 *   accessToken?: string,         // token d'accès (prioritaire sur social_accounts)
 *   text:        string,          // texte du post
 *   link?:       string,          // URL optionnelle
 *   media?:      { url: string, caption?: string, mimeType?: string }
 * }
 *
 * Retourne : PublishResult { externalId, url?, simulated? }
 * Fonctionne en mode simulé si META_APP_ID est absent.
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

  // Récupération du token et de l'externalAccountId depuis social_accounts
  // si non fournis directement dans le corps.
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
          .eq("platform", "facebook")
          .single();

        if (data) {
          accessToken = accessToken || ((data.access_token as string) ?? "");
          externalAccountId =
            externalAccountId || ((data.external_id as string) ?? "");
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
    media: media
      ? {
          url: (media as Record<string, string>).url,
          caption: (media as Record<string, string>).caption,
          mimeType: (media as Record<string, string>).mimeType,
        }
      : undefined,
    linkTitle: (linkTitle as string | undefined) ?? undefined,
    linkDescription: (linkDescription as string | undefined) ?? undefined,
  };

  try {
    const connector = getConnector("facebook");
    const result = await connector.publishPost(input);

    // Log best-effort dans audit_log si Supabase est disponible.
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const supabase = createAdminClient();

      if (supabase) {
        await supabase.from("sh_audit_log").insert({
          action: "publish_post",
          platform: "facebook",
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
    console.error("[POST /api/connectors/facebook/publish] Erreur :", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
