// Suivi des rendus longs (vidéo / avatar) — « file d'attente » côté Supabase.
// Un job survit à la fermeture de l'onglet : le webhook du provider le finalise.
// Server-only (client service-role). Dégradation gracieuse si Supabase absent.

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

export type RenderJobKind = "avatar" | "video";
export type RenderJobProvider = "replicate" | "shotstack";
export type RenderJobStatus = "processing" | "done" | "failed";

export interface RenderJob {
  id: string;
  companyId: string;
  kind: RenderJobKind;
  provider: RenderJobProvider;
  predictionId: string | null;
  status: RenderJobStatus;
  resultUrl: string | null;
  error: string | null;
}

const TABLE = "sh_render_jobs";

/** Crée un job « en cours » et renvoie son id (null si stockage indisponible). */
export async function createRenderJob(input: {
  companyId: string;
  kind: RenderJobKind;
  provider: RenderJobProvider;
  predictionId?: string;
  meta?: Record<string, unknown>;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const sb = createAdminClient();
  if (!sb) return null;
  const uuid = await resolveCompanyUuid(input.companyId);
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      company_id: uuid,
      kind: input.kind,
      provider: input.provider,
      prediction_id: input.predictionId ?? null,
      status: "processing",
      meta: input.meta ?? {},
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return String(data.id);
}

/** Associe (ou met à jour) l'id de prédiction provider à un job. */
export async function setRenderJobPrediction(jobId: string, predictionId: string): Promise<void> {
  const sb = createAdminClient();
  if (!sb) return;
  try {
    await sb.from(TABLE).update({ prediction_id: predictionId, updated_at: new Date().toISOString() }).eq("id", jobId);
  } catch { /* non bloquant */ }
}

/** Lecture d'un job (pour le webhook et le polling de statut). */
export async function getRenderJob(jobId: string): Promise<RenderJob | null> {
  const sb = createAdminClient();
  if (!sb) return null;
  const { data, error } = await sb.from(TABLE).select("*").eq("id", jobId).maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    companyId: String(data.company_id),
    kind: data.kind as RenderJobKind,
    provider: data.provider as RenderJobProvider,
    predictionId: data.prediction_id ? String(data.prediction_id) : null,
    status: data.status as RenderJobStatus,
    resultUrl: data.result_url ? String(data.result_url) : null,
    error: data.error ? String(data.error) : null,
  };
}

/** Marque un job terminé avec l'URL finale. Idempotent (ignore si déjà done). */
export async function completeRenderJob(jobId: string, resultUrl: string): Promise<void> {
  const sb = createAdminClient();
  if (!sb) return;
  try {
    await sb
      .from(TABLE)
      .update({ status: "done", result_url: resultUrl, error: null, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .neq("status", "done");
  } catch { /* non bloquant */ }
}

/** Jobs encore `processing` plus vieux que `olderThanMs` (webhook manqué ?). */
export async function listStaleProcessingJobs(olderThanMs: number, limit = 50): Promise<RenderJob[]> {
  if (!isSupabaseConfigured) return [];
  const sb = createAdminClient();
  if (!sb) return [];
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .not("prediction_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data.map((d) => ({
    id: String(d.id),
    companyId: String(d.company_id),
    kind: d.kind as RenderJobKind,
    provider: d.provider as RenderJobProvider,
    predictionId: d.prediction_id ? String(d.prediction_id) : null,
    status: d.status as RenderJobStatus,
    resultUrl: d.result_url ? String(d.result_url) : null,
    error: d.error ? String(d.error) : null,
  }));
}

/** Marque un job en échec. */
export async function failRenderJob(jobId: string, error: string): Promise<void> {
  const sb = createAdminClient();
  if (!sb) return;
  try {
    await sb
      .from(TABLE)
      .update({ status: "failed", error: error.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .neq("status", "done");
  } catch { /* non bloquant */ }
}
