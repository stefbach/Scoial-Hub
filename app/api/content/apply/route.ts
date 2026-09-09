// POST /api/content/apply { companyId, action: { type: "reschedule", postId, newTime } }
// Applique UNE action du Pilote Contenu. Seule "reschedule" a une application
// serveur : elle change l'heure d'un post déjà programmé (même mécanisme que
// PATCH /api/scheduled-posts/[id]). Les actions "compose" n'ont rien à
// appliquer côté serveur — le client ouvre directement /compose.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getScheduledPostCompanyId, updateScheduledPost } from "@/lib/repositories/scheduled-posts";

interface Action { type: "reschedule"; postId: string; newTime: string }

export async function POST(req: NextRequest) {
  try {
    const { action } = (await req.json()) as { companyId?: string; action?: Action };
    if (!action?.type || !action.postId) {
      return NextResponse.json({ error: "action (type, postId) requis" }, { status: 400 });
    }
    if (action.type !== "reschedule" || !/^\d{2}:\d{2}$/.test(action.newTime || "")) {
      return NextResponse.json({ error: "Type d'action inconnu ou heure invalide" }, { status: 400 });
    }

    // La société est dérivée du post lui-même (jamais du client) — même
    // garde IDOR que PATCH /api/scheduled-posts/[id].
    const companyId = await getScheduledPostCompanyId(action.postId);
    if (!companyId) {
      return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
    }
    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await updateScheduledPost(action.postId, { time: action.newTime });
    return NextResponse.json({ ok: true, applied: "reschedule" });
  } catch (e) {
    console.error("[POST /api/content/apply]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur serveur" }, { status: 500 });
  }
}
