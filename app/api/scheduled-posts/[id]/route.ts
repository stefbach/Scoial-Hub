import { NextRequest, NextResponse } from "next/server";
import {
  updateScheduledPost,
  deleteScheduledPost,
  getScheduledPostCompanyId,
} from "@/lib/repositories/scheduled-posts";
import type { Platform, PostSource } from "@/lib/types";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { resolveScheduleStatus } from "@/lib/publishing/approval";

// PATCH /api/scheduled-posts/[id]
// Body: partial ScheduledPost fields to update
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // La route ne vérifiait jusqu'ici qu'une session valide, jamais que
    // l'utilisateur appartient à la société propriétaire du post (IDOR) —
    // corrigé au passage : le contrôle de rôle qu'exige le workflow de
    // validation ci-dessous a de toute façon besoin de la société et de
    // l'accès réel de l'utilisateur dessus.
    const companyId = await getScheduledPostCompanyId(id);
    if (!companyId) {
      return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
    }
    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const body = await req.json();

    const patch: Parameters<typeof updateScheduledPost>[1] = {};
    if (body.platform !== undefined) patch.platform = body.platform as Platform;
    if (body.title !== undefined) patch.title = body.title;
    if (body.date !== undefined) patch.date = body.date;
    if (body.time !== undefined) patch.time = body.time;
    if (body.source !== undefined) patch.source = body.source as PostSource;
    if (body.status !== undefined) {
      // Workflow de validation (retour client Rosiane #5) : un member qui
      // programme (édition d'un brouillon, replanification…) dans une
      // société où le workflow est actif la met en attente d'approbation.
      patch.status = await resolveScheduleStatus(companyId, body.status, guard.role);
    }
    if (body.needsReview !== undefined) patch.needsReview = body.needsReview;
    if (body.body !== undefined) patch.body = body.body;
    if (body.automationName !== undefined) patch.automationName = body.automationName;
    if (body.media !== undefined) patch.media = body.media;
    if (body.publishedAt !== undefined) patch.publishedAt = body.publishedAt;

    const updated = await updateScheduledPost(id, patch);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    console.error(`[PATCH /api/scheduled-posts/${params.id}]`, err);
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/scheduled-posts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await getScheduledPostCompanyId(params.id);
    if (!companyId) {
      return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
    }
    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await deleteScheduledPost(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`[DELETE /api/scheduled-posts/${params.id}]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
