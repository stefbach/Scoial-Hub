/**
 * POST /api/social/publish
 *
 * Publication immédiate, scopée par SOCIÉTÉ, pour les réseaux gérés via leurs
 * connecteurs déclaratifs (TikTok…). Lit la connexion de la société dans
 * sh_channel_connections (token + identifiant de compte), puis appelle le
 * connecteur. Équivalent générique de /api/linkedin/publish pour les réseaux
 * pas encore branchés sur le moteur de programmation automatique.
 *
 * Body : { companyId, platform, text, imageUrl?, videoUrl? }
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getConnection } from "@/lib/repositories/channel-connections";
import { getTikTokConnection } from "@/lib/repositories/tiktok-connection";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getConnector, isSupportedPlatform } from "@/lib/connectors/index";
import { ensurePublishableImageUrl } from "@/lib/repositories/media";

export async function POST(req: NextRequest) {
  try {
    const { companyId, platform, text, imageUrl, videoUrl } = await req.json();

    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!platform || !isSupportedPlatform(platform)) {
      return NextResponse.json({ error: "Plateforme non supportée." }, { status: 400 });
    }
    if (!text?.trim() && !imageUrl && !videoUrl) {
      return NextResponse.json({ error: "Contenu vide (texte ou média requis)." }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const uuid = await resolveCompanyUuid(companyId);

    // TikTok (Brique 2) : connexion dédiée (sh_tiktok_connections), pas
    // sh_channel_connections que partagent les autres réseaux de cette route.
    let token: string | undefined;
    let externalId: string | undefined;
    let connected: boolean;
    if (platform === "tiktok") {
      const conn = await getTikTokConnection(uuid);
      token = conn?.access_token ?? undefined;
      externalId = conn?.external_id ?? undefined;
      connected = !!conn && conn.status === "connected" && !!token;
    } else {
      const conn = await getConnection(uuid, platform);
      token = conn?.config?.access_token;
      externalId = conn?.config?.external_id;
      connected = !!conn && conn.status === "connected" && !!token;
    }

    if (!connected || !token) {
      return NextResponse.json({ connected: false, error: `${platform} non connecté.` });
    }

    // Média : vidéo prioritaire (TikTok), sinon image.
    // Image : WebP refusé par plusieurs réseaux → conversion JPEG + rehébergement.
    const media = videoUrl
      ? { url: videoUrl as string, mimeType: "video/mp4" }
      : imageUrl
      ? { url: await ensurePublishableImageUrl(companyId, imageUrl as string), mimeType: "image/jpeg" }
      : undefined;

    const result = await getConnector(platform).publishPost({
      externalAccountId: externalId ?? "",
      accessToken: token,
      text: (text ?? "").trim(),
      media,
    });

    return NextResponse.json({ connected: true, ...result });
  } catch (e) {
    console.error("[POST /api/social/publish]", e);
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
