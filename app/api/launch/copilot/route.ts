// POST /api/launch/copilot { companyId, goal, history?, brief?, language? }
// Copilote de lancement conversationnel : guide le client pour construire un brief
// complet, EN S'APPUYANT sur le RAG (identité de marque, veille, pubs, campagnes).
// Retourne une réponse + le brief cumulé + ce qu'il reste à préciser + ready.

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";
import { buildLaunchContext, launchContextDigest } from "@/lib/launch/context";
import type { CopilotTurn, LaunchBrief } from "@/lib/launch/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      companyName?: string;
      goal?: string;
      brief?: LaunchBrief;
      history?: { role: "user" | "assistant"; content: string }[];
      language?: "fr" | "en";
    };
    const companyId = body.companyId;
    const goal = (body.goal ?? "").trim();
    const lang = body.language === "en" ? "en" : "fr";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!goal) return NextResponse.json({ error: "goal requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    if (!isAiConfigured) {
      return NextResponse.json({ error: "IA non configurée (ANTHROPIC_API_KEY)." }, { status: 503 });
    }

    const ctx = await buildLaunchContext(companyId, body.companyName);
    const digest = launchContextDigest(ctx);
    const histText = (body.history ?? [])
      .slice(-8)
      .map((m) => `${m.role === "user" ? "CLIENT" : "COPILOTE"} : ${m.content}`)
      .join("\n");

    const prompt = `# RÔLE
Tu es un CONSULTANT EN STRATÉGIE DE LANCEMENT d'élite (calibre KPMG / McKinsey / BCG), intégré à un outil marketing. Tu DIALOGUES avec le client pour construire, jusqu'au bout, un brief de lancement solide AVANT de lancer une simulation de marché. Tu es proactif : tu exploites le CONTEXTE déjà connu de la marque (ci-dessous) pour pré-remplir et proposer, au lieu de tout demander. Pose une à deux questions ciblées à la fois, propose des valeurs par défaut intelligentes, challenge gentiment les angles faibles.

# CONTEXTE CONNU DE LA MARQUE (RAG — identité, veille, pubs, campagnes)
${digest || "(Peu de données disponibles : aide le client à partir de zéro, propose des hypothèses plausibles.)"}

# BRIEF DÉJÀ CONSTRUIT (à compléter, ne jamais régresser)
${JSON.stringify(body.brief ?? {}, null, 2)}

${histText ? `# CONVERSATION\n${histText}\n` : ""}# NOUVEAU MESSAGE DU CLIENT
${goal}

# CE QUE TU PRODUIS (langue : ${lang === "en" ? "anglais" : "français"})
- "reply" : ta réponse conversationnelle (chaleureuse, experte, concise). Exploite explicitement le contexte connu ("D'après votre veille…", "Votre positionnement étant…"). Termine par 1-2 questions ciblées tant que le brief n'est pas complet.
- "brief" : le brief CUMULÉ et enrichi (fusionne l'existant + ce que tu déduis du message et du contexte). Champs : product, audience, message, market, trends, objective, budget, timeline, channels (parmi facebook/instagram/linkedin/tiktok), kpis[], differentiators[].
- "missing" : liste courte de ce qu'il reste VRAIMENT à clarifier pour une bonne simulation.
- "questions" : tes 1-2 questions de relance (vide si ready).
- "ready" : true uniquement quand product + audience + objective + au moins un canal sont clairs et cohérents.

# FORMAT — STRICTEMENT du JSON valide, sans texte autour :
{"reply":"","brief":{"product":"","audience":"","message":"","market":"","trends":"","objective":"","budget":"","timeline":"","channels":[],"kpis":[],"differentiators":[]},"missing":[],"questions":[],"ready":false}`;

    const result = await callClaudeJSON<CopilotTurn>(prompt, {
      model: "claude-sonnet-4-6",
      maxTokens: 2200,
      temperature: 0.5,
      system: "Tu réponds STRICTEMENT par un unique objet JSON valide, sans texte autour. Échappe correctement tout retour à la ligne dans les chaînes (\\n).",
    });
    if (!result) {
      return NextResponse.json({ error: "Le copilote n'a pas pu répondre. Réessayez." }, { status: 502 });
    }
    // Garde-fous : on garantit la présence des champs et la non-régression du brief.
    const merged: LaunchBrief = { ...(body.brief ?? {}), ...(result.brief ?? {}) } as LaunchBrief;
    return NextResponse.json({
      reply: result.reply ?? "",
      brief: merged,
      missing: Array.isArray(result.missing) ? result.missing : [],
      questions: Array.isArray(result.questions) ? result.questions : [],
      ready: Boolean(result.ready),
    } satisfies CopilotTurn);
  } catch (e) {
    console.error("[POST /api/launch/copilot]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
