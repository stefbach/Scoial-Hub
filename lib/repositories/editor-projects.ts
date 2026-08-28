// Dépôt des projets d'édition — table public.sh_editor_projects.
//
// C'est ce qui rend l'édition reprenable : le document vit en base, pas dans
// l'état d'un composant détruit à la fermeture de la modale. On peut revenir
// des jours plus tard, depuis un autre poste.
//
// Ne throw jamais : l'appelant reçoit null ou une liste vide.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "./resolve-company";
import { emptyProject, normalize, type EditorFormat, type EditorProject } from "@/lib/editor/project";

export interface EditorProjectRow {
  id: string;
  companyId: string;
  name: string;
  format: EditorFormat;
  doc: EditorProject;
  renderUrl: string | null;
  updatedAt: string;
}

/** Repli mémoire quand Supabase n'est pas configuré (démo, tests). */
const MEM = new Map<string, EditorProjectRow>();

function toRow(r: Record<string, unknown>): EditorProjectRow {
  const doc = (r.doc && typeof r.doc === "object" ? r.doc : {}) as Partial<EditorProject>;
  const id = String(r.id);
  const companyId = String(r.company_id);
  // Le document fait autorité, mais on le remet d'aplomb : une ligne écrite par
  // une version antérieure peut manquer de champs.
  const hydrated = normalize({
    ...emptyProject(companyId, id, (r.format as EditorFormat) ?? "9:16"),
    ...doc,
    id,
    companyId,
  });
  return {
    id,
    companyId,
    name: String(r.name ?? ""),
    format: (r.format as EditorFormat) ?? "9:16",
    doc: hydrated,
    renderUrl: (r.render_url as string) ?? null,
    updatedAt: String(r.updated_at ?? ""),
  };
}

export async function listEditorProjects(companyId: string, limit = 30): Promise<EditorProjectRow[]> {
  if (!isSupabaseConfigured) {
    return [...MEM.values()].filter((p) => p.companyId === companyId).slice(0, limit);
  }
  try {
    const sb = createClient();
    if (!sb) return [];
    const uuid = await resolveCompanyUuid(companyId);
    const { data, error } = await sb
      .from("sh_editor_projects")
      .select("*")
      .eq("company_id", uuid)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(toRow);
  } catch {
    return [];
  }
}

export async function getEditorProject(id: string): Promise<EditorProjectRow | null> {
  if (!isSupabaseConfigured) return MEM.get(id) ?? null;
  try {
    const sb = createClient();
    if (!sb) return null;
    const { data, error } = await sb.from("sh_editor_projects").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return toRow(data);
  } catch {
    return null;
  }
}

/**
 * Crée ou met à jour un projet. `id` absent → création.
 * Le document est enregistré tel quel : c'est lui la source de vérité.
 */
export async function saveEditorProject(input: {
  id?: string;
  companyId: string;
  name?: string;
  doc: EditorProject;
  renderUrl?: string | null;
}): Promise<EditorProjectRow | null> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured) {
    const id = input.id ?? `mem-${MEM.size + 1}`;
    const row: EditorProjectRow = {
      id,
      companyId: input.companyId,
      name: input.name ?? "",
      format: input.doc.format,
      doc: { ...input.doc, id, companyId: input.companyId, updatedAt: now },
      renderUrl: input.renderUrl ?? null,
      updatedAt: now,
    };
    MEM.set(id, row);
    return row;
  }

  try {
    const sb = createClient();
    if (!sb) return null;
    const uuid = await resolveCompanyUuid(input.companyId);
    const payload = {
      ...(input.id ? { id: input.id } : {}),
      company_id: uuid,
      name: input.name ?? input.doc.name ?? "",
      format: input.doc.format,
      doc: { ...input.doc, companyId: uuid, updatedAt: now },
      ...(input.renderUrl !== undefined ? { render_url: input.renderUrl } : {}),
      updated_at: now,
    };
    const { data, error } = await sb
      .from("sh_editor_projects")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error || !data) {
      console.error("[editor-projects] saveEditorProject error:", error);
      return null;
    }
    return toRow(data);
  } catch (err) {
    console.error("[editor-projects] saveEditorProject exception:", err);
    return null;
  }
}

export async function deleteEditorProject(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return MEM.delete(id);
  try {
    const sb = createClient();
    if (!sb) return false;
    const { error } = await sb.from("sh_editor_projects").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
