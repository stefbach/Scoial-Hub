/**
 * Client Anthropic robuste — repli automatique de modèle.
 *
 * CAUSE RACINE corrigée ici : tout le codebase appelait `client.messages.create`
 * avec un SEUL identifiant de modèle (`env.anthropicModel`). Si cet ID précis
 * n'est pas accessible à la clé API utilisée (mauvais ID, modèle non activé sur
 * l'organisation, modèle retiré), CHAQUE appel IA échoue en 404 et l'app retombe
 * silencieusement en mode démo — donnant l'impression que « la clé est là mais
 * rien ne fonctionne ». On centralise donc l'appel avec une cascade de modèles
 * de repli : on tente le modèle configuré, puis des replis connus, jusqu'à ce
 * qu'un modèle réponde. Les autres erreurs (clé invalide, quota, réseau) sont
 * propagées telles quelles — on ne masque jamais une vraie cause.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/**
 * Modèles candidats, dans l'ordre d'essai : le modèle configuré
 * (`ANTHROPIC_MODEL`) en premier, puis des replis stables connus. On déduplique
 * pour ne pas réessayer deux fois le même ID.
 */
export const ANTHROPIC_MODEL_CANDIDATES: string[] = (() => {
  const fallbacks = [
    "claude-sonnet-4-6",
    "claude-sonnet-4-5",
    "claude-haiku-4-5-20251001",
  ];
  const primary = env.anthropicModel?.trim() || fallbacks[0];
  return [primary, ...fallbacks.filter((m) => m !== primary)];
})();

/**
 * Vrai si l'erreur indique un modèle indisponible (ID inconnu / pas d'accès)
 * plutôt qu'un problème de clé, de quota ou de réseau. Dans ce cas seulement,
 * on bascule sur le modèle de repli suivant.
 */
export function isModelUnavailableError(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (status === 404) return true;
  if (status === 400 && msg.includes("model")) return true;
  return (
    msg.includes("not_found_error") ||
    (msg.includes("model") &&
      (msg.includes("not found") ||
        msg.includes("does not exist") ||
        msg.includes("invalid") ||
        msg.includes("unknown")))
  );
}

type CreateParams = Anthropic.MessageCreateParamsNonStreaming;
type RequestOptions = Parameters<Anthropic["messages"]["create"]>[1];

/**
 * Comme `client.messages.create`, mais essaie les modèles candidats dans
 * l'ordre : si le modèle demandé est indisponible pour cette clé, on bascule
 * automatiquement sur le repli suivant. `params.model` (s'il est fourni) reste
 * prioritaire et est essayé en premier. Toute erreur non liée au modèle est
 * propagée immédiatement.
 */
export async function createClaudeMessage(
  client: Anthropic,
  params: Omit<CreateParams, "model"> & { model?: string },
  requestOptions?: RequestOptions
): Promise<Anthropic.Message> {
  const requested = params.model?.trim();
  const candidates = requested
    ? [requested, ...ANTHROPIC_MODEL_CANDIDATES.filter((m) => m !== requested)]
    : ANTHROPIC_MODEL_CANDIDATES;

  let lastErr: unknown = new Error("no Anthropic model candidate available");
  for (const model of candidates) {
    try {
      return await client.messages.create({ ...params, model }, requestOptions);
    } catch (e) {
      lastErr = e;
      if (isModelUnavailableError(e)) continue; // modèle suivant
      throw e; // vraie erreur (clé, quota, réseau) : on ne la masque pas
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
