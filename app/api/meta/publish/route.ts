// Publication ORGANIQUE (normale) sur la Page Facebook et/ou le compte Instagram
// connectés, via le token de Page stocké (getMetaContext). Distinct de la
// publication via Ads (MetaAdsPublisher / Marketing API).
//
// Trois emplacements : fil (feed), Story (24 h) et Reel — chacun a son propre
// endpoint Graph, implémenté une seule fois dans lib/connectors/meta-publish.
// Dégradation : si la Page n'est pas connectée → { connected:false }.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext } from "@/lib/connectors/meta-pages";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { ensurePublishableImageUrl } from "@/lib/repositories/media";
import {
  inferMediaKind,
  normalizePostType,
  publishToFacebookPage,
  publishToInstagram,
  type MetaMediaKind,
} from "@/lib/connectors/meta-publish";

/** Trace une publication réussie dans l'Historique (vérifiable côté /history). */
async function logPublished(
  companyId: string,
  platform: string,
  body: string,
  url?: string,
  // Média publié : sans lui, l'historique n'affichait aucune image (R24 #12).
  media?: { kind: MetaMediaKind; url: string }
) {
  try {
    const sb = createAdminClient();
    if (!sb) return;
    await sb.from("sh_history_items").insert({
      company_id: await resolveCompanyUuid(companyId),
      platform,
      body: body.slice(0, 280),
      full_body: body,
      external_url: url ?? null,
      published_at: new Date().toISOString(),
      source: "manual",
      status: "published",
      ...(media ? { media } : {}),
    });
  } catch {
    /* non bloquant */
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      text?: string;
      /** Ancien champ (image seule) — conservé pour compatibilité. */
      imageUrl?: string;
      /** Média joint, image OU vidéo. */
      mediaUrl?: string;
      mediaKind?: MetaMediaKind;
      postType?: string;
      targets?: { facebook?: boolean; instagram?: boolean };
    };
    const { companyId, text, targets } = body;
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const postType = normalizePostType(body.postType);
    let mediaUrl = (body.mediaUrl || body.imageUrl || "").trim() || undefined;
    const mediaKind: MetaMediaKind | undefined = mediaUrl
      ? body.mediaKind ?? inferMediaKind(mediaUrl)
      : undefined;

    if (!text?.trim() && !mediaUrl) {
      return NextResponse.json({ error: "Texte ou média requis" }, { status: 400 });
    }
    if (postType !== "feed" && !mediaUrl) {
      return NextResponse.json(
        { error: postType === "story" ? "Une story exige une image ou une vidéo." : "Un Reel exige une vidéo." },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.pageToken || (!ctx.pageId && !ctx.igId)) {
      // Distingue « jamais connecté » de « connecté mais aucune Page choisie » :
      // le second cas se règle en deux clics et ne demande pas de refaire l'OAuth.
      return NextResponse.json({
        connected: false,
        error: ctx.userToken
          ? "Compte Meta connecté, mais aucune Page sélectionnée. Choisissez votre Page dans « Mes Pages »."
          : "Page Meta non connectée.",
      });
    }

    // WebP refusé par Instagram (JPEG requis) → conversion + rehébergement.
    // Ne concerne que les images : une vidéo passe telle quelle.
    if (mediaUrl && mediaKind === "image") {
      mediaUrl = await ensurePublishableImageUrl(companyId, mediaUrl);
    }

    const wantFb = targets?.facebook !== false; // FB par défaut
    const wantIg = Boolean(targets?.instagram);
    const out: {
      facebook?: { ok: boolean; url?: string; error?: string };
      instagram?: { ok: boolean; url?: string; error?: string };
    } = {};

    const input = { text, mediaUrl, mediaKind, postType };
    // Média réellement envoyé (après conversion éventuelle) — mémorisé tel quel
    // dans l'historique pour pouvoir revoir la publication.
    const loggedMedia = mediaUrl && mediaKind ? { kind: mediaKind, url: mediaUrl } : undefined;

    if (wantFb && ctx.pageId) {
      try {
        const r = await publishToFacebookPage(ctx.pageId, ctx.pageToken, input);
        out.facebook = { ok: r.ok, url: r.url, error: r.error };
        if (r.ok) await logPublished(companyId, "facebook", text ?? "", r.url, loggedMedia);
      } catch (e) {
        out.facebook = { ok: false, error: e instanceof Error ? e.message : "Échec FB" };
      }
    }

    if (wantIg && ctx.igId) {
      try {
        const r = await publishToInstagram(ctx.igId, ctx.pageToken, input);
        out.instagram = { ok: r.ok, url: r.url, error: r.error };
        if (r.ok) await logPublished(companyId, "instagram", text ?? "", r.url, loggedMedia);
      } catch (e) {
        out.instagram = { ok: false, error: e instanceof Error ? e.message : "Échec IG" };
      }
    }

    return NextResponse.json({ connected: true, results: out });
  } catch (e) {
    console.error("[POST /api/meta/publish]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
