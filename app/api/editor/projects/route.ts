// GET    /api/editor/projects?companyId=…      → liste des projets d'édition
// GET    /api/editor/projects?id=…             → un projet
// POST   /api/editor/projects { companyId, id?, name?, doc } → crée ou met à jour
// DELETE /api/editor/projects?id=…&companyId=… → supprime
//
// L'enregistrement est appelé automatiquement par l'éditeur : c'est ce qui rend
// la reprise possible, et ce qui garantit qu'aucun travail n'est perdu si
// l'onglet se ferme.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import {
  deleteEditorProject,
  getEditorProject,
  listEditorProjects,
  saveEditorProject,
} from "@/lib/repositories/editor-projects";
import { normalize, type EditorProject } from "@/lib/editor/project";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  const companyId = sp.get("companyId");

  if (id) {
    const project = await getEditorProject(id);
    if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    const guard = await requireCompanyAccess(project.companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    return NextResponse.json({ project });
  }

  if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
  const guard = await requireCompanyAccess(companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
  return NextResponse.json({ projects: await listEditorProjects(companyId) });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      id?: string;
      name?: string;
      doc?: EditorProject;
      renderUrl?: string | null;
    };
    if (!body.companyId || !body.doc) {
      return NextResponse.json({ error: "companyId et doc requis" }, { status: 400 });
    }
    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    // Un projet écrit par un client ne peut pas être supposé cohérent : on le
    // remet d'aplomb avant de l'enregistrer.
    const project = await saveEditorProject({
      id: body.id,
      companyId: body.companyId,
      name: body.name,
      doc: normalize(body.doc),
      renderUrl: body.renderUrl,
    });
    if (!project) return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
    return NextResponse.json({ project });
  } catch (e) {
    console.error("[POST /api/editor/projects]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const project = await getEditorProject(id);
  if (!project) return NextResponse.json({ ok: true });
  const guard = await requireCompanyAccess(project.companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  return NextResponse.json({ ok: await deleteEditorProject(id) });
}
