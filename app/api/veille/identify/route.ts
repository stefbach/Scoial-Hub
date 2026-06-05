/**
 * POST /api/veille/identify
 * { companyId, theme, keywords[], geo } → liste de compétiteurs probables via Claude.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAiConfigured, env } from "@/lib/env";
import type { ScrapeNetwork } from "@/lib/scraping/types";

export interface IdentifiedCompetitor {
  network: ScrapeNetwork;
  /** Handle plausible — peut être null si l'IA n'est pas sûre qu'il existe. */
  handle: string | null;
  name: string;
  rationale: string;
  /** Toujours true : ces résultats sont des pistes générées par l'IA, à vérifier. */
  unverified: boolean;
}

/* ── Mock de compétiteurs identifiés ── */
function buildMockIdentified(theme: string, geo: string): IdentifiedCompetitor[] {
  const geoLabel = geo.toUpperCase();
  return [
    { network: "instagram", handle: "@leader_marche_fr", name: "Leader Marché FR", rationale: `Compte leader sur Instagram pour "${theme}" en ${geoLabel}`, unverified: true },
    { network: "tiktok", handle: "@tendance_concurrente", name: "Tendance Concurrente", rationale: `Forte visibilité TikTok sur la thématique ${theme}`, unverified: true },
    { network: "youtube", handle: "@tutoriels_secteur", name: "Tutoriels Secteur", rationale: `Chaîne YouTube référence pour les tutos ${theme}`, unverified: true },
    { network: "linkedin", handle: "@expert_b2b_fr", name: "Expert B2B FR", rationale: `Thought leader LinkedIn sur ${theme} en ${geoLabel}`, unverified: true },
    { network: "facebook", handle: "@communaute_pro", name: "Communauté Pro", rationale: `Grande communauté Facebook autour de ${theme}`, unverified: true },
  ];
}

// Avertissement renvoyé au client : ces comptes sont des pistes IA, jamais confirmées.
const IDENTIFY_NOTICE = {
  fr: "Suggestions générées par l'IA — comptes et handles à vérifier avant utilisation, ils ne sont pas garantis d'exister.",
  en: "AI-generated suggestions — accounts and handles to verify before use, they are not guaranteed to exist.",
};

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
      return NextResponse.json({
        competitors: buildMockIdentified(theme || keywords[0] || "votre secteur", geo),
        unverified: true,
        notice: IDENTIFY_NOTICE,
      });
    }

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: env.anthropicKey });

      const prompt = `Tu es un expert en veille concurrentielle social media.

Pour une marque dont la thématique est : "${theme}"
Mots-clés : ${keywords.join(", ") || "non précisés"}
Zone géographique : ${geo.toUpperCase()}

Identifie les 5 à 8 compétiteurs les PLUS PUISSANTS et influents (audience la plus large, engagement le plus fort, autorité reconnue) pour cette thématique et cette zone. Privilégie des comptes RÉELS et reconnus (leaders, marques dominantes) plutôt que des comptes obscurs.
Pour chaque compte, indique le réseau le plus pertinent parmi : youtube, instagram, tiktok, linkedin, twitter, facebook.

IMPORTANT : N'INVENTE PAS de handle. Si tu n'es pas certain que le compte (handle) existe réellement, mets le champ "handle" à null plutôt que de fabriquer une adresse. Ces résultats seront présentés à l'utilisateur comme des SUGGESTIONS À VÉRIFIER, jamais comme des comptes confirmés.

Réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :
[
  {
    "network": "instagram|tiktok|youtube|linkedin|twitter|facebook",
    "handle": "@handle_reel_ou_null",
    "name": "Nom du compte",
    "rationale": "Pourquoi ce compte est pertinent (1 phrase)"
  }
]

Réponds en français.`;

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

      // Validation basique. Le handle n'est plus exigé : l'IA peut le mettre à
      // null si elle n'est pas sûre qu'il existe (on n'affirme pas le contraire).
      const valid = parsed
        .filter((c) => c.network && c.name)
        .map((c) => ({
          ...c,
          handle: c.handle && String(c.handle).trim() ? c.handle : null,
          unverified: true, // marquage systématique : pistes à vérifier
        }));

      return NextResponse.json({ competitors: valid, unverified: true, notice: IDENTIFY_NOTICE });
    } catch (err) {
      console.warn("[identify] Claude failed, fallback mock:", err);
      return NextResponse.json({
        competitors: buildMockIdentified(theme || keywords[0] || "votre secteur", geo),
        unverified: true,
        notice: IDENTIFY_NOTICE,
      });
    }
  } catch (err) {
    console.error("[POST /api/veille/identify]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
