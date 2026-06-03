/**
 * Dispatch des commandes Telegram vers les agents AXON-AI.
 *
 * Toutes les fonctions sont best-effort : elles ne throwent jamais,
 * renvoient un message d'erreur courtois si quelque chose foire.
 *
 * Commandes supportées :
 *   /start | /aide           → aide
 *   /status                  → résumé de l'entité
 *   /objectif <texte>        → enregistre l'objectif
 *   /lancer <texte>          → lance une orchestration agents
 *   /veille                  → lance une analyse de veille
 *   <texte libre>            → traité comme /lancer
 */

import { env } from "@/lib/env";
import { getConnection, upsertConnection } from "@/lib/repositories/channel-connections";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommandContext {
  companyId: string;
  text: string;
  chatId: number | string;
}

// ── Aide ──────────────────────────────────────────────────────────────────────

const AIDE = `*AXON-AI — Commandes disponibles*

🚀 */lancer <objectif>*
Lance une orchestration multi-agent avec l'objectif donné.
_Ex : /lancer Campagne LinkedIn pour notre nouveau produit_

🎯 */objectif <texte>*
Enregistre un objectif par défaut pour ce compte.
_Ex : /objectif Augmenter les abonnés de 20 % ce trimestre_

📡 */veille*
Déclenche une analyse de veille concurrentielle.

📊 */status*
Affiche le statut et l'objectif en cours de ce compte.

❓ */aide*
Affiche ce message d'aide.

---
_Vous pouvez aussi écrire un objectif directement sans commande._`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function trim(text: string): string {
  return text.trim();
}

function stripCommand(text: string, cmd: string): string {
  return text.replace(new RegExp(`^${cmd}\\s*`, "i"), "").trim();
}

// ── Sous-handlers ─────────────────────────────────────────────────────────────

async function handleStatus(companyId: string): Promise<string> {
  try {
    const conn = await getConnection(companyId, "telegram");
    const config = conn?.config ?? {};
    const objectif = (config.current_objective as string | undefined) ?? null;
    const statusLine = conn?.status === "connected" ? "✅ Bot connecté" : "⚠️ Bot non connecté";
    return (
      `*Statut — compte \`${companyId}\`*\n\n` +
      `${statusLine}\n\n` +
      `🎯 *Objectif en cours :*\n${objectif ? objectif : "_Aucun objectif enregistré._"}`
    );
  } catch {
    return "Impossible de récupérer le statut pour le moment. Réessayez dans quelques instants.";
  }
}

async function handleObjectif(companyId: string, text: string): Promise<string> {
  const objectif = trim(text);
  if (!objectif) {
    return "Veuillez préciser un objectif. Ex : `/objectif Augmenter l'engagement de 15 %`";
  }

  try {
    const conn = await getConnection(companyId, "telegram");
    const existingConfig = conn?.config ?? {};
    const mergedConfig = { ...existingConfig, current_objective: objectif };

    await upsertConnection(
      companyId,
      "telegram",
      mergedConfig,
      conn?.status ?? "connected"
    );

    return `✅ *Objectif enregistré*\n\n_${objectif}_\n\nUtilisez */lancer* pour démarrer une orchestration avec cet objectif.`;
  } catch {
    return "Erreur lors de l'enregistrement de l'objectif. Veuillez réessayer.";
  }
}

async function handleLancer(companyId: string, objectifArg: string): Promise<string> {
  // Si pas d'objectif dans l'argument, essayer de récupérer l'objectif par défaut
  let objectif = trim(objectifArg);

  if (!objectif) {
    try {
      const conn = await getConnection(companyId, "telegram");
      objectif = (conn?.config?.current_objective as string | undefined) ?? "";
    } catch {
      // pas grave
    }
  }

  if (!objectif) {
    return (
      "Aucun objectif défini. Précisez-le directement :\n" +
      "`/lancer Campagne LinkedIn pour notre nouveau service`\n\n" +
      "Ou enregistrez un objectif par défaut avec `/objectif <texte>`."
    );
  }

  try {
    const url = `${env.appUrl}/api/agents/run`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: objectif,
        companyId,
        autonomy: 2, // Autonomie standard par défaut
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return `❌ *Erreur lors du lancement :* ${body.error ?? `Erreur ${res.status}`}`;
    }

    const result = (await res.json()) as {
      finalOutput?: string;
      complianceVerdict?: string;
      steps?: Array<{ agent: string; output?: string }>;
    };

    const lines: string[] = [];
    lines.push(`✅ *Orchestration lancée*\n\n🎯 _${objectif}_`);

    if (result.finalOutput) {
      const excerpt =
        result.finalOutput.length > 400
          ? result.finalOutput.slice(0, 400) + "…"
          : result.finalOutput;
      lines.push(`\n📋 *Recommandation :*\n${excerpt}`);
    }

    if (result.complianceVerdict) {
      const verdict = result.complianceVerdict.toLowerCase();
      const icon =
        verdict.includes("conforme") || verdict.includes("ok") || verdict.includes("pass")
          ? "🟢"
          : verdict.includes("attention") || verdict.includes("warn")
          ? "🟡"
          : "🔴";
      lines.push(`\n${icon} *Conformité :* ${result.complianceVerdict}`);
    }

    if (result.steps && result.steps.length > 0) {
      lines.push(`\n🔧 _${result.steps.length} étape(s) exécutée(s)_`);
    }

    return lines.join("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return `❌ *Impossible de contacter l'orchestrateur :*\n_${msg}_\n\nVérifiez que l'application est bien déployée.`;
  }
}

async function handleVeille(companyId: string): Promise<string> {
  try {
    const url = `${env.appUrl}/api/veille/run`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });

    if (!res.ok) {
      return `⚠️ Veille : erreur ${res.status}. Le module de veille est peut-être en cours de démarrage.`;
    }

    const result = (await res.json()) as {
      summary?: string;
      insights?: string[];
      competitors?: string[];
    };

    const lines: string[] = ["📡 *Rapport de veille*\n"];

    if (result.summary) {
      lines.push(result.summary.slice(0, 500));
    }

    if (result.insights && result.insights.length > 0) {
      lines.push("\n\n💡 *Points clés :*");
      result.insights.slice(0, 3).forEach((ins) => lines.push(`• ${ins}`));
    }

    if (lines.length === 1) {
      lines.push("Analyse en cours… Revenez dans quelques minutes.");
    }

    return lines.join("\n");
  } catch {
    return "⚠️ Le module de veille est temporairement indisponible. Réessayez dans quelques instants.";
  }
}

// ── Dispatch principal ────────────────────────────────────────────────────────

/**
 * Parse le texte reçu de Telegram, route vers le bon handler,
 * et retourne toujours un message en français.
 * Ne throw jamais.
 */
export async function handleCommand(ctx: CommandContext): Promise<string> {
  const text = trim(ctx.text ?? "");
  const { companyId } = ctx;

  if (!text) {
    return AIDE;
  }

  // /start ou /aide
  if (/^\/start\b/i.test(text) || /^\/aide\b/i.test(text)) {
    return AIDE;
  }

  // /status
  if (/^\/status\b/i.test(text)) {
    return handleStatus(companyId);
  }

  // /objectif <texte>
  if (/^\/objectif\b/i.test(text)) {
    const arg = stripCommand(text, "/objectif");
    return handleObjectif(companyId, arg);
  }

  // /lancer <texte>
  if (/^\/lancer\b/i.test(text)) {
    const arg = stripCommand(text, "/lancer");
    return handleLancer(companyId, arg);
  }

  // /veille
  if (/^\/veille\b/i.test(text)) {
    return handleVeille(companyId);
  }

  // Toute autre commande Telegram non reconnue
  if (text.startsWith("/")) {
    return `Commande non reconnue : \`${text}\`\n\nTapez */aide* pour voir les commandes disponibles.`;
  }

  // Texte libre → traité comme /lancer
  return handleLancer(companyId, text);
}
