// POST /api/scheduled-posts/[id]/publish  { companyId }
//
// Publie RÉELLEMENT une publication programmée sur le réseau connecté.
// Auparavant, « Publier maintenant » se contentait de passer le statut à
// "published" en base — le post n'était jamais envoyé à Facebook/LinkedIn.
// Ici on récupère le compte connecté (page_id + token de Page pour Facebook),
// on appelle le connecteur, PUIS on marque le post comme publié. En cas
// d'échec (compte non connecté, token expiré, refus Graph API), on remonte
// une vraie erreur au lieu de faire croire à une publication réussie.

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getScheduledPost, updateScheduledPost } from "@/lib/repositories/scheduled-posts";
import { getConnection } from "@/lib/repositories/channel-connections";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getConnector } from "@/lib/connectors/index";
import { requireCompanyAccess } from "@/lib/auth/guard";
import type { PublishInput } from "@/lib/connectors/types";
import type { Platform } from "@/lib/types";

/** Identifiant de compte + token requis par le connecteur, selon la plateforme. */
function resolveCreds(
  platform: Platform,
  cfg: Record<string, string>
): { externalAccountId: string; accessToken: string } {
  switch (platform) {
    case "facebook":
      return { externalAccountId: cfg.page_id ?? "", accessToken: cfg.page_access_token ?? "" };
    case "instagram":
      return { externalAccountId: cfg.ig_business_account_id ?? "", accessToken: cfg.page_access_token ?? "" };
    case "linkedin":
      return { externalAccountId: cfg.external_id ?? "", accessToken: cfg.access_token ?? "" };
    default:
      return { externalAccountId: "", accessToken: "" };
  }
}

const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => ({}))) as { companyId?: string };
    const companyId = body.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const post = await getScheduledPost(params.id);
    if (!post) {
      return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
    }

    const text = (post.body || post.title || "").trim();
    if (!text) {
      return NextResponse.json({ error: "La publication est vide." }, { status: 400 });
    }

    const platform = post.platform;
    const label = PLATFORM_LABEL[platform] ?? platform;

    // Compte connecté = source de vérité pour les tokens (page_access_token…).
    const uuid = await resolveCompanyUuid(companyId);
    const conn = await getConnection(uuid, platform);
    if (!conn || conn.status !== "connected") {
      return NextResponse.json(
        { error: `Le compte ${label} n'est pas connecté. Connectez-le dans Connecteurs avant de publier.` },
        { status: 409 }
      );
    }

    const { externalAccountId, accessToken } = resolveCreds(platform, conn.config ?? {});
    if (!externalAccountId || !accessToken) {
      return NextResponse.json(
        { error: `La connexion ${label} est incomplète (Page/token manquant). Reconnectez le compte.` },
        { status: 409 }
      );
    }

    // Instagram exige un média : un post programmé ne porte pas l'URL de l'image
    // (seulement son type). On publie depuis Composer pour Instagram.
    if (platform === "instagram") {
      return NextResponse.json(
        { error: "Instagram exige une image — publiez ce contenu depuis Composer." },
        { status: 422 }
      );
    }

    const input: PublishInput = { externalAccountId, accessToken, text };

    let result;
    try {
      const connector = getConnector(platform);
      result = await connector.publishPost(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      console.error(`[POST /api/scheduled-posts/${params.id}/publish] ${platform}:`, message);
      return NextResponse.json(
        { error: `Échec de la publication sur ${label} : ${message}` },
        { status: 502 }
      );
    }

    // Publication effectuée → on marque le post comme publié.
    const publishedAt = new Date().toISOString();
    await updateScheduledPost(params.id, { status: "published", publishedAt }).catch(() => {});

    return NextResponse.json({
      published: true,
      simulated: result.simulated ?? false,
      externalId: result.externalId,
      url: result.url,
      platform,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    console.error(`[POST /api/scheduled-posts/${params.id}/publish]`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
