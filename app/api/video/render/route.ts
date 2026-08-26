/**
 * POST /api/video/render
 *
 * DEUX appelants, deux contrats :
 *   • Studio Créatif  → { cut: PlatformCut, assets: MediaAsset[], captions? }
 *   • Banc de montage → { project: EditorProject }
 *
 * Le second a été ajouté après coup : le banc transmettait sa timeline sans que
 * personne ne l'attende, et TOUT montage aiguillé vers le serveur — donc tout
 * montage à plusieurs plans, avec transitions, ou long — échouait en 400.
 *
 * Le banc envoie son DOCUMENT, pas une timeline : la projection est faite ici,
 * à partir d'une structure que le serveur sait normaliser. Une timeline
 * fabriquée par le client serait transmise telle quelle au moteur.
 *
 * Renvoie { id, status }.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { submitEdit, submitRender } from "@/lib/video/render";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { env, isWebhookConfigured } from "@/lib/env";
import { createRenderJob, setRenderJobPrediction } from "@/lib/jobs/render-jobs";
import { normalize, type EditorProject } from "@/lib/editor/project";
import { toServerEdit } from "@/lib/editor/render-plan";
import type { CaptionSegment, MediaAsset, PlatformCut } from "@/lib/video/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      cut?: PlatformCut;
      assets?: MediaAsset[];
      captions?: CaptionSegment[];
      logoUrl?: string;
      brandColors?: { text?: string; accent?: string };
      companyId?: string;
      project?: EditorProject;
    };
    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    // ── Banc de montage : document de projet ────────────────────────────────
    if (body.project && Array.isArray(body.project.clips)) {
      const project = normalize(body.project);
      if (project.clips.length === 0) {
        return NextResponse.json({ error: "Le montage ne contient aucun plan." }, { status: 400 });
      }
      const job = await openRenderJob(body.companyId);
      const result = await submitEdit(toServerEdit(project, job.callback));
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      if (job.id && result.id) await setRenderJobPrediction(job.id, result.id);
      return NextResponse.json({ id: result.id, status: result.status, jobId: job.id });
    }

    // ── Studio Créatif : cut + médias ───────────────────────────────────────
    if (!body.cut || !Array.isArray(body.assets)) {
      return NextResponse.json({ error: "cut et assets requis, ou project." }, { status: 400 });
    }
    const logoUrl = typeof body.logoUrl === "string" && /^https?:\/\//.test(body.logoUrl) ? body.logoUrl : undefined;
    const hex = (c?: string) => (typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : undefined);
    const brandColors = body.brandColors ? { text: hex(body.brandColors.text), accent: hex(body.brandColors.accent) } : undefined;

    const job = await openRenderJob(body.companyId);
    const result = await submitRender(body.cut, body.assets, body.captions ?? [], logoUrl, brandColors, job.callback);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, status: result.status }, { status: result.status === "unsupported" ? 422 : 400 });
    }
    if (job.id && result.id) await setRenderJobPrediction(job.id, result.id);
    return NextResponse.json({ id: result.id, status: result.status, jobId: job.id });
  } catch (err) {
    console.error("[POST /api/video/render]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

/**
 * Ouvre un suivi de rendu et son adresse de rappel, quand le webhook est
 * configuré. C'est ce qui permet à la vidéo d'atterrir dans la médiathèque même
 * si l'utilisateur ferme son onglet — les deux appelants en bénéficient.
 */
async function openRenderJob(companyId?: string): Promise<{ id: string | null; callback?: string }> {
  if (!isWebhookConfigured || !companyId) return { id: null };
  const id = await createRenderJob({ companyId, kind: "video", provider: "shotstack" });
  if (!id) return { id: null };
  return {
    id,
    callback: `${env.appUrl.replace(/\/$/, "")}/api/webhooks/shotstack?job=${id}&secret=${encodeURIComponent(env.webhookSecret)}`,
  };
}
