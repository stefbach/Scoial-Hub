// lib/learning-engine/store.ts
//
// Persistance des bras appris (sh_learning_arms) et du journal d'audit
// (sh_learning_events). Même contrat de dégradation gracieuse que
// lib/memory/index.ts : magasin en mémoire si Supabase n'est pas configuré,
// ne throw jamais (best-effort, non bloquant pour l'appelant).

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { newArm, type ArmStat } from "./bandit";
import type { LearningDimension } from "./reward";

const MEM_ARMS = new Map<string, ArmStat>();

function memKey(companyId: string, dimension: LearningDimension, armKey: string): string {
  return `${companyId}:${dimension}:${armKey}`;
}

/** Charge les bras des candidats donnés — un bras jamais vu revient au prior neutre. */
export async function loadArms(
  companyId: string,
  dimension: LearningDimension,
  candidateKeys: string[]
): Promise<ArmStat[]> {
  if (!isSupabaseConfigured) {
    return candidateKeys.map((k) => MEM_ARMS.get(memKey(companyId, dimension, k)) ?? newArm(k));
  }
  try {
    const supabase = createAdminClient();
    if (!supabase) return candidateKeys.map(newArm);
    const uuid = await resolveCompanyUuid(companyId);
    const { data, error } = await supabase
      .from("sh_learning_arms")
      .select("arm_key, alpha, beta")
      .eq("company_id", uuid)
      .eq("dimension", dimension)
      .in("arm_key", candidateKeys);
    if (error || !data) return candidateKeys.map(newArm);
    const byKey = new Map(
      (data as { arm_key: string; alpha: number; beta: number }[]).map((r) => [
        r.arm_key,
        { armKey: r.arm_key, alpha: Number(r.alpha), beta: Number(r.beta) },
      ])
    );
    return candidateKeys.map((k) => byKey.get(k) ?? newArm(k));
  } catch (err) {
    console.error("[learning-engine] loadArms exception:", err);
    return candidateKeys.map(newArm);
  }
}

/** Écrit l'état appris d'un bras (upsert). */
export async function saveArm(companyId: string, dimension: LearningDimension, arm: ArmStat): Promise<void> {
  if (!isSupabaseConfigured) {
    MEM_ARMS.set(memKey(companyId, dimension, arm.armKey), arm);
    return;
  }
  try {
    const supabase = createAdminClient();
    if (!supabase) return;
    const uuid = await resolveCompanyUuid(companyId);
    const { error } = await supabase.from("sh_learning_arms").upsert(
      {
        company_id: uuid,
        dimension,
        arm_key: arm.armKey,
        alpha: arm.alpha,
        beta: arm.beta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,dimension,arm_key" }
    );
    if (error) console.error("[learning-engine] saveArm error:", error);
  } catch (err) {
    console.error("[learning-engine] saveArm exception:", err);
  }
}

/** Journalise un résultat mesuré (audit — n'affecte jamais l'apprentissage lui-même). */
export async function logEvent(
  companyId: string,
  dimension: LearningDimension,
  armKey: string,
  reward: number,
  rawMetrics: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured) return; // le journal d'audit n'a de sens qu'avec une persistance réelle
  try {
    const supabase = createAdminClient();
    if (!supabase) return;
    const uuid = await resolveCompanyUuid(companyId);
    const { error } = await supabase.from("sh_learning_events").insert({
      company_id: uuid,
      dimension,
      arm_key: armKey,
      reward,
      raw_metrics: rawMetrics,
    });
    if (error) console.error("[learning-engine] logEvent error:", error);
  } catch (err) {
    console.error("[learning-engine] logEvent exception:", err);
  }
}
