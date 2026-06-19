// POST /api/launch/strategy { companyId, brief, report?, language? }
// À partir du brief finalisé + du rapport de simulation + du RAG, génère une
// STRATÉGIE de lancement actionnable, ventilée par canal ORGANIQUE et PUBLICITAIRE,
// directement applicable dans les campagnes de l'app.

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";
import { buildLaunchContext, launchContextDigest } from "@/lib/launch/context";
import { appendMemory } from "@/lib/memory";
import type { LaunchBrief, LaunchStrategy } from "@/lib/launch/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      companyName?: string;
      brief?: LaunchBrief;
      report?: string;
      language?: "fr" | "en";
    };
    const companyId = body.companyId;
    const brief = body.brief;
    const lang = body.language === "en" ? "en" : "fr";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!brief?.product) return NextResponse.json({ error: "brief incomplet" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    if (!isAiConfigured) {
      return NextResponse.json({ error: "IA non configurée (ANTHROPIC_API_KEY)." }, { status: 503 });
    }

    const ctx = await buildLaunchContext(companyId, body.companyName);
    const digest = launchContextDigest(ctx);

    const prompt = `# RÔLE
Tu es un DIRECTEUR DE STRATÉGIE marketing d'élite (calibre KPMG / McKinsey / BCG). Tu transformes un brief de lancement + les résultats d'une simulation de marché en une STRATÉGIE OPÉRATIONNELLE, ventilée par canal, directement exécutable.

# CONTEXTE DE MARQUE (RAG)
${digest || "(contexte limité)"}

# BRIEF DE LANCEMENT
${JSON.stringify(brief, null, 2)}

${body.report ? `# RÉSULTATS DE SIMULATION DE MARCHÉ (à exploiter en priorité)\n${body.report.slice(0, 6000)}\n` : ""}
# CONSIGNES
- Canaux autorisés : facebook, instagram, linkedin, tiktok (utilise ceux pertinents pour l'audience).
- Sépare clairement ORGANIQUE (contenu non payant) et PUBLICITAIRE (campagnes payantes).
- Sois concret et actionnable : angles, formats, accroches prêtes à l'emploi, cadence, répartition de budget.
- Ancre tout dans le contexte réel de la marque et les enseignements de la simulation.
- Langue : ${lang === "en" ? "anglais" : "français"}.

# FORMAT — STRICTEMENT du JSON valide, sans texte autour :
{
  "summary": "synthèse exécutive 3-4 phrases",
  "positioning": "angle de positionnement du lancement",
  "organic": [{"channel":"instagram","objective":"","audience":"","angles":[],"formats":[],"hooks":[],"postingCadence":"","kpi":""}],
  "paid": [{"channel":"facebook","objective":"","audience":"","angles":[],"formats":[],"hooks":[],"budgetShare":"","kpi":""}],
  "calendar": [{"phase":"Semaine 1 — Amorçage","focus":"","actions":[]}],
  "kpis": [],
  "risks": []
}
Max 4 canaux par section, max 4 éléments par liste, max 4 phases de calendrier.`;

    const result = await callClaudeJSON<LaunchStrategy>(prompt, {
      model: "claude-sonnet-4-6",
      maxTokens: 3000,
      temperature: 0.55,
      system: "Tu réponds STRICTEMENT par un unique objet JSON valide, sans texte autour. Échappe correctement tout retour à la ligne dans les chaînes (\\n).",
    });
    if (!result) {
      return NextResponse.json({ error: "Stratégie non générée. Réessayez." }, { status: 502 });
    }

    const strategy: LaunchStrategy = {
      summary: result.summary ?? "",
      positioning: result.positioning ?? "",
      organic: Array.isArray(result.organic) ? result.organic.slice(0, 4) : [],
      paid: Array.isArray(result.paid) ? result.paid.slice(0, 4) : [],
      calendar: Array.isArray(result.calendar) ? result.calendar.slice(0, 4) : [],
      kpis: Array.isArray(result.kpis) ? result.kpis.slice(0, 6) : [],
      risks: Array.isArray(result.risks) ? result.risks.slice(0, 6) : [],
      aiGenerated: true,
    };

    // Trace dans la mémoire stratégique (alimente le RAG futur).
    appendMemory(companyId, [
      {
        source: "agent",
        kind: "recommendation",
        title: `Stratégie de lancement — ${brief.product}`.slice(0, 80),
        content: `${strategy.summary} ${strategy.positioning}`.slice(0, 500),
        score: 5,
      },
    ]).catch(() => {});

    return NextResponse.json({ strategy });
  } catch (e) {
    console.error("[POST /api/launch/strategy]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
