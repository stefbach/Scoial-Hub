/**
 * Helper `callClaudeJSON` — appel Claude qui retourne du JSON typé.
 *
 * Factorise le motif répété dans le codebase (≈14 occurrences de `new Anthropic`
 * + extraction/parse JSON, cf. AUDIT P2 #18) : instancier le SDK Anthropic,
 * envoyer un prompt, extraire le premier bloc `{ ... }` de la réponse, le parser
 * et le typer. Toute erreur (clé absente, réseau, JSON invalide) retourne `null`
 * plutôt que de jeter — au sens de la "dégradation gracieuse" du projet.
 *
 * Ce helper n'est volontairement câblé nulle part : il est fourni pour migrer
 * progressivement les appels existants. Aucune logique métier n'en dépend encore.
 *
 * Usage :
 * ```ts
 * import { callClaudeJSON } from "@/lib/ai/claude-json";
 *
 * type Result = { summary: string; tags: string[] };
 *
 * const data = await callClaudeJSON<Result>(prompt);
 * if (!data) {
 *   // fallback : l'IA n'est pas configurée ou n'a pas renvoyé de JSON valide
 * }
 *
 * // Options : surcharger le modèle / max_tokens / system / température.
 * const data2 = await callClaudeJSON<Result>(prompt, {
 *   model: "claude-sonnet-4-6",
 *   maxTokens: 2000,
 *   system: "Tu réponds uniquement en JSON valide.",
 * });
 * ```
 *
 * Note : le parsing (validation/coercition des champs) reste à la charge de
 * l'appelant — ce helper se contente de garantir un objet JSON parsé ou `null`.
 */

import { isAiConfigured, env } from "@/lib/env";

export interface CallClaudeJSONOptions {
  /** Modèle Anthropic à utiliser (défaut : `env.anthropicModel`). */
  model?: string;
  /** Nombre maximum de tokens en sortie (défaut : 1500). */
  maxTokens?: number;
  /** Prompt système optionnel. */
  system?: string;
  /** Température d'échantillonnage optionnelle. */
  temperature?: number;
}

/**
 * Appelle Claude avec `prompt`, extrait le premier bloc JSON `{ ... }` de la
 * réponse et le parse en `T`. Retourne `null` si l'IA n'est pas configurée, en
 * cas d'erreur d'appel, ou si la réponse ne contient pas de JSON parsable.
 */
export async function callClaudeJSON<T>(
  prompt: string,
  opts: CallClaudeJSONOptions = {}
): Promise<T | null> {
  if (!isAiConfigured) return null;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const message = await client.messages.create({
      model: opts.model ?? env.anthropicModel,
      max_tokens: opts.maxTokens ?? 1500,
      ...(opts.system ? { system: opts.system } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      messages: [{ role: "user", content: prompt }],
    });

    // Concatène les blocs texte de la réponse, en retirant les éventuelles
    // clôtures Markdown (```json … ```).
    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    // Extrait le premier objet JSON présent dans la réponse.
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const stop = (message as { stop_reason?: string }).stop_reason;
      console.warn(`[callClaudeJSON] aucun JSON (stop_reason=${stop}):`, rawText.slice(0, 160));
      return null;
    }

    // Tentatives en cascade, de la plus fidèle à la plus permissive :
    //  1) tel quel ;
    //  2) caractères de contrôle bruts (retours à la ligne non échappés dans les
    //     chaînes) corrigés — cause n°1 d'échec de parsing des réponses LLM ;
    //  3) réparation d'une troncature (max_tokens) sur la version échappée.
    const candidate = jsonMatch[0];
    const escaped = escapeRawControlChars(candidate);
    const attempts = [candidate, escaped, repairTruncatedJson(escaped) ?? ""];
    for (const attempt of attempts) {
      if (!attempt) continue;
      try {
        return JSON.parse(attempt) as T;
      } catch {
        /* tentative suivante */
      }
    }
    const stop = (message as { stop_reason?: string }).stop_reason;
    console.warn(`[callClaudeJSON] JSON non parsable (stop_reason=${stop}):`, candidate.slice(0, 220));
    return null;
  } catch (e) {
    console.error("[callClaudeJSON] appel IA échoué:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Échappe les caractères de contrôle bruts (retour à la ligne, tabulation, etc.)
 * présents À L'INTÉRIEUR des chaînes JSON. Les LLM insèrent souvent des sauts de
 * ligne littéraux dans les valeurs textuelles, ce qui rend le JSON invalide.
 * On ne touche pas aux caractères hors chaînes (mise en forme du JSON).
 */
function escapeRawControlChars(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) { out += "\\u" + code.toString(16).padStart(4, "0"); continue; }
    }
    out += ch;
  }
  return out;
}

/**
 * Comme `callClaudeJSON`, mais réessaie après un court délai si le résultat est
 * `null` — utile contre les échecs TRANSITOIRES du modèle (surcharge 529, limite
 * de débit, réponse occasionnellement non parsable). `retries` = nombre de
 * tentatives supplémentaires (1 par défaut → 2 appels au total au pire).
 */
export async function callClaudeJSONRetry<T>(
  prompt: string,
  opts: CallClaudeJSONOptions = {},
  retries = 1
): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    const result = await callClaudeJSON<T>(prompt, opts);
    if (result) return result;
    if (i < retries) await new Promise((res) => setTimeout(res, 700 * (i + 1)));
  }
  return null;
}

/**
 * Répare grossièrement un JSON tronqué : coupe après la dernière virgule/valeur
 * complète puis referme les `]` et `}` ouverts. Suffisant pour récupérer une
 * analyse partielle plutôt que de tout perdre quand la sortie dépasse max_tokens.
 */
function repairTruncatedJson(s: string): string | null {
  let str = s.trim();
  // Retire une fin partielle (après la dernière " ou } ou ] suivie d'éventuels caractères incomplets).
  const lastComplete = Math.max(str.lastIndexOf("}"), str.lastIndexOf("]"), str.lastIndexOf('"'));
  if (lastComplete > 0) str = str.slice(0, lastComplete + 1);
  // Compte les ouvertures non refermées et les referme dans l'ordre.
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (const ch of str) {
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inStr) str += '"';
  // Retire une virgule traînante éventuelle.
  str = str.replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) str += stack[i] === "{" ? "}" : "]";
  return stack.length || inStr ? str : null;
}
