/**
 * POST /api/agents/run
 *
 * Lance une orchestration multi-agent pour piloter une campagne sociale.
 *
 * Body attendu :
 * {
 *   objective       : string       — objectif libre (ex: "Lance une campagne Tibok à 50€/j")
 *   companyId       : string       — identifiant de la marque DDS Group
 *   brandVoice?     : string       — tone of voice de la marque (optionnel)
 *   autonomy        : 1 | 2 | 3   — niveau d'autonomie souhaité
 *   profileId?      : string       — identifiant du profil professionnel (optionnel)
 *   cadence?        : Cadence      — cadence éditoriale (optionnel)
 *   benchmarkTarget?: string       — cible de benchmark libre (optionnel)
 * }
 *
 * Réponse : AgentRunResult (voir lib/agents/types.ts)
 *
 * Fonctionne en mode mock si ANTHROPIC_API_KEY est absente.
 * Rétro-compatible : les champs profileId, cadence, benchmarkTarget sont optionnels.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { runOrchestration } from "@/lib/agents/orchestrator";
import type { AutonomyLevel, Cadence } from "@/lib/agents/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      objective,
      companyId,
      brandVoice,
      autonomy,
      profileId,
      cadence,
      benchmarkTarget,
    } = body as {
      objective?: string;
      companyId?: string;
      brandVoice?: string;
      autonomy?: unknown;
      profileId?: string;
      cadence?: Cadence;
      benchmarkTarget?: string;
    };

    // Validation des champs obligatoires
    if (!objective || typeof objective !== "string" || !objective.trim()) {
      return NextResponse.json(
        { error: "Champ requis manquant : objective (string non vide)" },
        { status: 400 }
      );
    }

    if (!companyId || typeof companyId !== "string") {
      return NextResponse.json(
        { error: "Champ requis manquant : companyId (string)" },
        { status: 400 }
      );
    }

    const autonomyLevel = Number(autonomy);
    if (![1, 2, 3].includes(autonomyLevel)) {
      return NextResponse.json(
        { error: "Champ invalide : autonomy doit être 1, 2 ou 3" },
        { status: 400 }
      );
    }

    // Mémoire stratégique persistante : on injecte l'historique d'analyses
    // (veille, pubs, Page) pour que la campagne soit fondée dessus.
    let enrichedObjective = objective.trim();
    try {
      const { getMemoryContext } = await import("@/lib/memory");
      const mem = await getMemoryContext(companyId, 25);
      if (mem) {
        enrichedObjective += `\n\n[Mémoire stratégique — insights accumulés à exploiter]\n${mem}`;
      }
    } catch {
      /* non bloquant */
    }

    const result = await runOrchestration({
      objective: enrichedObjective,
      companyId,
      brandVoice: typeof brandVoice === "string" ? brandVoice : undefined,
      autonomy: autonomyLevel as AutonomyLevel,
      // Champs enrichis optionnels
      profileId: typeof profileId === "string" ? profileId : undefined,
      cadence: cadence && typeof cadence === "object" ? cadence : undefined,
      benchmarkTarget:
        typeof benchmarkTarget === "string" ? benchmarkTarget : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/agents/run] Erreur inattendue :", err);
    return NextResponse.json(
      { error: "Erreur interne lors de l'orchestration. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
