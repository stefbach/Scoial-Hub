// /api/benchmark/suggest — Suggestion IA de concurrents produit pour le benchmark.
//   POST { companyId, product?, language? }
//     → Claude propose 4-6 concurrents directs avec, pour chacun, l'URL la plus
//       probable de sa page tarifs (pricing/plans/tarifs), ou null s'il n'est
//       pas sûr. Aucun fetch réseau vers les sites concurrents ici (latence) :
//       l'URL proposée sera validée par le fetch du benchmark lui-même.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSONRetryResult } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

interface Body { companyId?: string; product?: string; language?: "fr" | "en" }
interface SuggestedCompetitor { name: string; pricingUrl: string | null }

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const guard = await requireCompanyAccess(body.companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  const en = body.language === "en";
  const product = (body.product ?? "").trim();
  if (!product) {
    return NextResponse.json(
      { error: en ? "Describe your product first." : "Décrivez d'abord votre produit." },
      { status: 400 }
    );
  }

  if (!isAiConfigured) return NextResponse.json({ simulated: true });

  const prompt = `Tu es analyste en intelligence concurrentielle SaaS.

NOTRE PRODUIT :
${product}

Identifie les 4 à 6 concurrents DIRECTS les plus pertinents : des produits RÉELS et reconnus sur ce marché (leaders établis + challengers crédibles).

Pour CHAQUE concurrent, donne l'URL la plus probable de sa page tarifs publique (chemins usuels : /pricing, /plans, /tarifs) sur son domaine officiel. N'INVENTE PAS : si tu n'es pas raisonnablement sûr du domaine officiel ou du chemin, mets "pricingUrl" à null — l'utilisateur complétera lui-même.

Réponds UNIQUEMENT en JSON valide, structure EXACTE :
{"competitors":[{"name":"Nom du produit","pricingUrl":"https://exemple.com/pricing"}]}
("pricingUrl" vaut null en cas de doute.)`;

  // 2 tentatives (échecs transitoires : surcharge, JSON invalide occasionnel).
  const { data, error } = await callClaudeJSONRetryResult<{ competitors: SuggestedCompetitor[] }>(
    prompt,
    { maxTokens: 1000, temperature: 0.3, system: "Tu réponds uniquement en JSON valide, sans texte autour." },
    1
  );

  if (!data?.competitors?.length) {
    return NextResponse.json(
      {
        error: en
          ? `Competitor suggestion failed (${error ?? "unknown error"}). Please retry.`
          : `Échec de la suggestion de concurrents (${error ?? "erreur inconnue"}). Réessayez.`,
      },
      { status: 502 }
    );
  }

  // Validation : nom requis ; URL conservée seulement si http(s) plausible.
  const competitors = data.competitors
    .map((c) => {
      const url = typeof c.pricingUrl === "string" ? c.pricingUrl.trim() : "";
      return {
        name: String(c.name ?? "").trim(),
        pricingUrl: /^https?:\/\/\S+\.\S+/i.test(url) ? url : null,
      };
    })
    .filter((c) => c.name)
    .slice(0, 6);

  return NextResponse.json({ competitors });
}
