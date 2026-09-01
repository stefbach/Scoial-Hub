// POST /api/scheduled-posts/[id]/reject  { note?: string }
//
// Workflow de validation (retour client Rosiane #5) : un owner/admin
// (responsable marketing) refuse une publication en attente. Elle repasse
// "draft" plutôt que d'être supprimée — le Community Manager la retrouve
// dans ses brouillons, avec le motif du refus, pour la corriger et la
// soumettre à nouveau.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getScheduledPost, getScheduledPostCompanyId, updateScheduledPost } from "@/lib/repositories/scheduled-posts";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { isAccountAdmin } from "@/lib/rbac/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const companyId = await getScheduledPostCompanyId(id);
    if (!companyId) {
      return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
    }

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    if (!isAccountAdmin(guard.role)) {
      return NextResponse.json(
        { error: "Réservé aux responsables (owner/admin) de la société." },
        { status: 403 }
      );
    }

    const post = await getScheduledPost(id);
    if (!post) {
      return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
    }
    if (post.status !== "pending_approval") {
      return NextResponse.json({ error: "Cette publication n'est pas en attente de validation." }, { status: 409 });
    }

    const body = (await req.json().catch(() => ({}))) as { note?: string };
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    const updated = await updateScheduledPost(id, { status: "draft", approvalNote: note });
    return NextResponse.json(updated);
  } catch (err) {
    console.error(`[POST /api/scheduled-posts/${params.id}/reject]`, err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
