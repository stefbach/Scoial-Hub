/**
 * POST /api/social/publish
 *
 * Publication immédiate, scopée par SOCIÉTÉ, pour les réseaux gérés via leurs
 * connecteurs déclaratifs (Twitter/X, Pinterest, TikTok…). Lit la connexion de
 * la société dans sh_channel_connections (token + identifiant de compte), puis
 * appelle le connecteur. Équivalent générique de /api/linkedin/publish pour les
 * réseaux pas encore branchés sur le moteur de programmation automatique.
 *
 * Body : { companyId, platform, text, imageUrl?, videoUrl?, boardId? }
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getConnection } from "@/lib/repositories/channel-connections";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getConnector, isSupportedPlatform } from "@/lib/connectors/index";

export async function POST(req: NextRequest) {
  try {
    const { companyId, platform, text, imageUrl, videoUrl, boardId } = await req.json();

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
    const conn = await getConnection(uuid, platform);
    const token = conn?.config?.access_token;
    // Pinterest : un board cible est requis (boardId prioritaire sur la config).
    const externalId = boardId || conn?.config?.board_id || conn?.config?.external_id;

    if (!conn || conn.status !== "connected" || !token) {
      return NextResponse.json({ connected: false, error: `${platform} non connecté.` });
    }

    // Média : vidéo prioritaire (TikTok), sinon image.
    const media = videoUrl
      ? { url: videoUrl as string, mimeType: "video/mp4" }
      : imageUrl
      ? { url: imageUrl as string, mimeType: "image/jpeg" }
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
