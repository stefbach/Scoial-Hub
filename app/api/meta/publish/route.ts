// Publication ORGANIQUE (normale) sur la Page Facebook et/ou le compte Instagram
// connectés, via le token de Page stocké (getMetaContext). Distinct de la
// publication via Ads (MetaAdsPublisher / Marketing API).
//
// - Facebook : texte seul → /{pageId}/feed ; avec image → /{pageId}/photos.
// - Instagram : EXIGE une image (conteneur → publish en 2 étapes).
// Dégradation : si la Page n'est pas connectée → { connected:false }.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext } from "@/lib/connectors/meta-pages";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

const V = process.env.META_API_VERSION ?? "v21.0";

async function metaPost(path: string, params: Record<string, string>) {
  const res = await fetch(`https://graph.facebook.com/${V}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  return (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } };
}

/** Trace une publication réussie dans l'Historique (vérifiable côté /history). */
async function logPublished(companyId: string, platform: string, body: string, url?: string) {
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
    });
  } catch {
    /* non bloquant */
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, text, imageUrl, targets } = (await req.json()) as {
      companyId?: string;
      text?: string;
      imageUrl?: string;
      targets?: { facebook?: boolean; instagram?: boolean };
    };
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!text?.trim() && !imageUrl) {
      return NextResponse.json({ error: "Texte ou image requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.pageToken) {
      return NextResponse.json({ connected: false, error: "Page Meta non connectée." });
    }

    const wantFb = targets?.facebook !== false; // FB par défaut
    const wantIg = Boolean(targets?.instagram);
    const out: {
      facebook?: { ok: boolean; url?: string; error?: string };
      instagram?: { ok: boolean; url?: string; error?: string };
    } = {};

    // ── Facebook ───────────────────────────────────────────────────────────
    if (wantFb && ctx.pageId) {
      try {
        const r = imageUrl
          ? await metaPost(`${ctx.pageId}/photos`, { url: imageUrl, caption: text ?? "", access_token: ctx.pageToken })
          : await metaPost(`${ctx.pageId}/feed`, { message: text ?? "", access_token: ctx.pageToken });
        if (r.error) out.facebook = { ok: false, error: r.error.message };
        else {
          const pid = r.post_id || r.id || "";
          const url = pid ? `https://www.facebook.com/${pid}` : undefined;
          out.facebook = { ok: true, url };
          await logPublished(companyId, "facebook", text ?? "", url);
        }
      } catch (e) {
        out.facebook = { ok: false, error: e instanceof Error ? e.message : "Échec FB" };
      }
    }

    // ── Instagram (image obligatoire) ────────────────────────────────────────
    if (wantIg && ctx.igId) {
      if (!imageUrl) {
        out.instagram = { ok: false, error: "Instagram exige une image." };
      } else {
        try {
          const c = await metaPost(`${ctx.igId}/media`, { image_url: imageUrl, caption: text ?? "", access_token: ctx.pageToken });
          if (c.error || !c.id) {
            out.instagram = { ok: false, error: c.error?.message ?? "Conteneur IG refusé." };
          } else {
            const pub = await metaPost(`${ctx.igId}/media_publish`, { creation_id: c.id, access_token: ctx.pageToken });
            if (pub.error) out.instagram = { ok: false, error: pub.error.message };
            else {
              out.instagram = { ok: true };
              await logPublished(companyId, "instagram", text ?? "", undefined);
            }
          }
        } catch (e) {
          out.instagram = { ok: false, error: e instanceof Error ? e.message : "Échec IG" };
        }
      }
    }

    return NextResponse.json({ connected: true, results: out });
  } catch (e) {
    console.error("[POST /api/meta/publish]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
