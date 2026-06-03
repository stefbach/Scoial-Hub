/**
 * POST /api/veille/identify
 * { companyId, theme, keywords[], geo } → liste de compétiteurs probables via Claude.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAiConfigured, env } from "@/lib/env";
import type { ScrapeNetwork } from "@/lib/scraping/types";

export interface IdentifiedCompetitor {
  network: ScrapeNetwork;
  handle: string;
  name: string;
  rationale: string;
}

/* ── Mock de compétiteurs identifiés ── */
function buildMockIdentified(theme: string, geo: string): IdentifiedCompetitor[] {
  const geoLabel = geo.toUpperCase();
  return [
    { network: "instagram", handle: "@leader_marche_fr", name: "Leader Marché FR", rationale: `Compte leader sur Instagram pour "${theme}" en ${geoLabel}` },
    { network: "tiktok", handle: "@tendance_concurrente", name: "Tendance Concurrente", rationale: `Forte visibilité TikTok sur la thématique ${theme}` },
    { network: "youtube", handle: "@tutoriels_secteur", name: "Tutoriels Secteur", rationale: `Chaîne YouTube référence pour les tutos ${theme}` },
    { network: "linkedin", handle: "@expert_b2b_fr", name: "Expert B2B FR", rationale: `Thought leader LinkedIn sur ${theme} en ${geoLabel}` },
    { network: "facebook", handle: "@communaute_pro", name: "Communauté Pro", rationale: `Grande communauté Facebook autour de ${theme}` },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      companyId?: string;
      theme?: string;
      keywords?: string[];
      geo?: string;
    };

    const { companyId, theme = "", keywords = [], geo = "fr" } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }

    if (!isAiConfigured) {
      return NextResponse.json({ competitors: buildMockIdentified(theme || keywords[0] || "votre secteur", geo) });
    }

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: env.anthropicKey });

      const prompt = `Tu es un expert en veille concurrentielle social media.

Pour une marque dont la thématique est : "${theme}"
Mots-clés : ${keywords.join(", ") || "non précisés"}
Zone géographique : ${geo.toUpperCase()}

Identifie 5 à 8 compétiteurs ou acteurs incontournables à suivre sur les réseaux sociaux.
Pour chaque compte, indique le réseau le plus pertinent parmi : youtube, instagram, tiktok, linkedin, twitter, facebook.

Réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :
[
  {
    "network": "instagram|tiktok|youtube|linkedin|twitter|facebook",
    "handle": "@handle_exemple",
    "name": "Nom du compte",
    "rationale": "Pourquoi ce compte est pertinent (1 phrase)"
  }
]

Utilise des handles plausibles pour la zone ${geo.toUpperCase()} et la thématique donnée. Réponds en français.`;

      const message = await client.messages.create({
        model: env.anthropicModel,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });

      const rawText = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Pas de JSON valide dans la réponse Claude");

      const parsed = JSON.parse(jsonMatch[0]) as IdentifiedCompetitor[];

      // Validation basique
      const valid = parsed.filter(
        (c) => c.network && c.handle && c.name
      );

      return NextResponse.json({ competitors: valid });
    } catch (err) {
      console.warn("[identify] Claude failed, fallback mock:", err);
      return NextResponse.json({ competitors: buildMockIdentified(theme || keywords[0] || "votre secteur", geo) });
    }
  } catch (err) {
    console.error("[POST /api/veille/identify]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
