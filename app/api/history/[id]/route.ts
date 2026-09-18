import { NextRequest, NextResponse } from "next/server";
import { deleteHistoryItem, getHistoryItemCompanyId } from "@/lib/repositories/history";
import { requireCompanyAccess } from "@/lib/auth/guard";

// DELETE /api/history/[id]
// Suppression réelle (auparavant : le bouton « Supprimer » ne mutait qu'un
// état local côté navigateur, sans jamais toucher la base — l'entrée
// réapparaissait au rechargement malgré le message « action irréversible »).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await getHistoryItemCompanyId(params.id);
    if (!companyId) {
      return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
    }
    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await deleteHistoryItem(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`[DELETE /api/history/${params.id}]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
