// /api/ai/simulate — Moteur de Prédiction & Simulation de campagne (Claude).
//   POST { companyId, product, audience, message?, market?, trends?, language? }
//     → { result: SimulationResult, aiGenerated: true }
//     → { simulated: true } si l'IA n'est pas configurée (mode démo)
//
// Inspiré des moteurs de simulation multi-agents (type MiroFish) mais NATIF :
// pas de service externe, pas de dépendance copyleft — on s'appuie sur Claude
// pour générer des personas représentatifs et simuler leurs réactions, puis on
// agrège une prédiction directionnelle. C'est une SIMULATION, pas une garantie.

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";
import type { SimulationResult } from "@/lib/ai/simulation";

interface Body {
  companyId?: string;
  product?: string;
  audience?: string;
  message?: string;
  market?: string;
  trends?: string;
  language?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  const product = (body.product ?? "").trim();
  const audience = (body.audience ?? "").trim();
  if (!product) return NextResponse.json({ error: "Produit requis" }, { status: 400 });
  if (!audience) return NextResponse.json({ error: "Audience cible requise" }, { status: 400 });

  if (!isAiConfigured) return NextResponse.json({ simulated: true });

  const lang = body.language === "en" ? "English" : "français";
  const message = (body.message ?? "").trim();
  const market = (body.market ?? "").trim();
  const trends = (body.trends ?? "").trim();

  const prompt = `Tu es un MOTEUR DE SIMULATION DE MARCHÉ. Objectif : prédire, de façon directionnelle, comment une audience cible réagirait à la mise en avant d'un produit, AVANT toute dépense média.

Méthode (raisonnement interne) :
1. Construis 6 PERSONAS distincts et réalistes, représentatifs de l'audience cible et du marché (démographie + psychographie + rapport au sujet).
2. Pour CHAQUE persona, simule sa réaction au produit et au message : tonalité (positif/neutre/négatif), un verbatim plausible à la première personne, une probabilité d'adhésion (0–100), et l'objection principale s'il y en a une.
3. Agrège : un score global de réception (0–100, moyenne pondérée réaliste), les angles qui résonnent le plus, les objections/risques majeurs, des recommandations concrètes, et l'alignement avec les tendances fournies (en signalant tout risque de saturation/“déjà-vu”).

Contexte :
- Produit / offre à mettre en avant : "${product}"
- Audience cible : "${audience}"
${message ? `- Message / angle envisagé : "${message}"` : "- Message : (non fourni — déduis l'angle le plus pertinent)"}
${market ? `- Marché / zone : "${market}"` : ""}
${trends ? `- Tendances actuelles à prendre en compte : "${trends}"` : ""}

Contraintes : reste honnête et nuancé (c'est une SIMULATION directionnelle, pas une certitude). Pas de chiffres faussement précis. Rédige TOUT le texte en ${lang}.

Réponds STRICTEMENT en JSON, sans texte autour, au format :
{
  "score": <0-100>,
  "verdict": "phrase d'accroche courte",
  "summary": "synthèse en un paragraphe",
  "personas": [
    { "name": "...", "profile": "...", "sentiment": "positif|neutre|négatif", "reaction": "...", "adoption": <0-100>, "objection": "..." }
  ],
  "winningAngles": ["...", "..."],
  "objections": ["...", "..."],
  "recommendations": ["...", "..."],
  "trendAlignment": "..."
}`;

  // Tier « rapide » : modèle Haiku (faible latence) → tient dans le budget de la
  // fonction même sous charge (Sonnet, plus lent sur 3200 tokens, expirait).
  const data = await callClaudeJSON<SimulationResult>(prompt, {
    model: "claude-haiku-4-5-20251001",
    maxTokens: 3200,
    temperature: 0.7,
  });
  if (!data || typeof data.score !== "number" || !Array.isArray(data.personas)) {
    return NextResponse.json({ error: "La simulation n'a pas abouti. Réessayez." }, { status: 502 });
  }

  // Normalisation défensive des bornes / champs (l'IA peut déraper légèrement).
  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const result: SimulationResult = {
    score: clamp(data.score),
    verdict: String(data.verdict ?? "").trim(),
    summary: String(data.summary ?? "").trim(),
    personas: (data.personas ?? []).slice(0, 8).map((p) => ({
      name: String(p.name ?? "").trim(),
      profile: String(p.profile ?? "").trim(),
      sentiment: p.sentiment === "positif" || p.sentiment === "négatif" ? p.sentiment : "neutre",
      reaction: String(p.reaction ?? "").trim(),
      adoption: clamp(p.adoption),
      objection: p.objection ? String(p.objection).trim() : undefined,
    })),
    winningAngles: (data.winningAngles ?? []).map((s) => String(s).trim()).filter(Boolean),
    objections: (data.objections ?? []).map((s) => String(s).trim()).filter(Boolean),
    recommendations: (data.recommendations ?? []).map((s) => String(s).trim()).filter(Boolean),
    trendAlignment: String(data.trendAlignment ?? "").trim(),
  };

  return NextResponse.json({ result, aiGenerated: true });
}
