// POST /api/scheduled-posts/[id]/publish  { companyId }
//
// Publie RÉELLEMENT une publication programmée sur le réseau connecté.
// Auparavant, « Publier maintenant » se contentait de passer le statut à
// "published" en base — le post n'était jamais envoyé à Facebook/LinkedIn.
// La logique (connexion → connecteur → marquage publié) est factorisée dans
// lib/publishing/publish-scheduled.ts, partagée avec le cron de publication
// automatique (/api/cron/publish-due). En cas d'échec (compte non connecté,
// token expiré, refus API), on remonte une vraie erreur au lieu de faire
// croire à une publication réussie.

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getScheduledPost } from "@/lib/repositories/scheduled-posts";
import { publishScheduledPostNow } from "@/lib/publishing/publish-scheduled";
import { requireCompanyAccess } from "@/lib/auth/guard";

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

    const outcome = await publishScheduledPostNow(post, companyId);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({
      published: true,
      simulated: outcome.simulated ?? false,
      externalId: outcome.externalId,
      url: outcome.url,
      platform: outcome.platform,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    console.error(`[POST /api/scheduled-posts/${params.id}/publish]`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
