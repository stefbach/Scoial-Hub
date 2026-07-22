// /api/benchmark — Benchmark concurrentiel produit (qualité + prix).
//   POST { companyId, product?, competitors: [{ name, url? }] }
//     → récupère (best-effort) les pages concurrentes, puis demande à Claude une
//       matrice de scores (12 dimensions), une analyse SWOT, le positionnement
//       et une recommandation de prix. Dégradation gracieuse si IA non configurée
//       ou si une page est inaccessible (Claude s'appuie alors sur sa connaissance).

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { isSafeRemoteUrl } from "@/lib/security/url-guard";
import { callClaudeJSONRetryResult } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

interface Competitor { name?: string; url?: string }
interface Body { companyId?: string; product?: string; competitors?: Competitor[]; language?: "fr" | "en" }

export interface BenchmarkResult {
  summary: string;
  threatLevel: "LOW" | "MEDIUM" | "HIGH";
  dimensions: string[];
  rows: { name: string; isYou?: boolean; scores: number[]; total: number }[];
  pricing: { name: string; tiers: { tier: string; price: string; note?: string }[] }[];
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  positioning: string;
  recommendedPricing: { tiers: { name: string; price: string; target: string; rationale?: string }[]; notes?: string };
}

/** Récupère une page et la réduit à du texte brut (best-effort, jamais bloquant). */
async function fetchText(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AxonBenchmark/1.0)" },
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const guard = await requireCompanyAccess(body.companyId);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  const competitors = (body.competitors ?? []).filter((c) => (c.name ?? "").trim()).slice(0, 6);
  if (competitors.length === 0) return NextResponse.json({ error: "Ajoutez au moins un concurrent." }, { status: 400 });

  if (!isAiConfigured) return NextResponse.json({ simulated: true });

  // Récupère en parallèle les pages fournies (pricing/landing) pour ancrer l'analyse.
  const scraped = await Promise.all(
    competitors.map(async (c) => {
      const text = c.url && isSafeRemoteUrl(c.url) ? await fetchText(c.url.trim()) : "";
      return { name: (c.name ?? "").trim(), url: (c.url ?? "").trim(), text };
    })
  );

  const product = (body.product ?? "").trim() ||
    "AXON-AI Social Hub — hub social tout-en-un pour PME/TPE francophones : planification multi-réseaux (Facebook, Instagram, LinkedIn), génération IA de contenu (texte, visuels, affiches), studios vidéo IA dont avatar parlant + clonage de voix multilingue, veille concurrentielle publicitaire, gestion multi-sociétés avec RBAC, agents IA.";

  const evidence = scraped
    .map((s) => `### ${s.name}${s.url ? ` (${s.url})` : ""}\n${s.text ? s.text : "(page non récupérée — utilise ta connaissance du produit)"}`)
    .join("\n\n");

  const prompt = `Tu es analyste en intelligence concurrentielle SaaS. Réalise un BENCHMARK rigoureux du produit suivant face à ses concurrents.

NOTRE PRODUIT :
${product}

CONCURRENTS (avec extraits de leurs pages quand disponibles) :
${evidence}

Évalue NOTRE PRODUIT et CHAQUE concurrent sur 12 dimensions notées de 1 (faible) à 5 (best-in-class) :
Étendue fonctionnelle, Prix (clarté/valeur), UX, Performance, Documentation, Support, Intégrations, Sécurité/conformité, Scalabilité, Marque, Communauté, Innovation IA.

Combine les extraits fournis ET ta connaissance du marché. Sois honnête : un produit jeune marque faible sur support/communauté/marque même s'il est riche fonctionnellement. Le total est la somme des 12 scores (sur 60).

Pour le prix : capture les paliers réels connus de chaque concurrent, puis propose une grille tarifaire pour NOTRE produit (3-4 paliers en euros) avec cible et justification.

Réponds UNIQUEMENT en JSON valide, structure EXACTE :
{
  "summary": "2-3 phrases de synthèse",
  "threatLevel": "LOW|MEDIUM|HIGH",
  "dimensions": ["Étendue fonctionnelle","Prix","UX","Performance","Documentation","Support","Intégrations","Sécurité","Scalabilité","Marque","Communauté","Innovation IA"],
  "rows": [
    {"name":"AXON-AI","isYou":true,"scores":[n,n,n,n,n,n,n,n,n,n,n,n],"total":n},
    {"name":"Concurrent","scores":[...12 nombres...],"total":n}
  ],
  "pricing": [
    {"name":"Concurrent","tiers":[{"tier":"Plan","price":"99$/mo","note":"détail"}]}
  ],
  "swot": {"strengths":["..."],"weaknesses":["..."],"opportunities":["..."],"threats":["..."]},
  "positioning": "Description de l'espace de marché et où nous nous situons",
  "recommendedPricing": {"tiers":[{"name":"PME","price":"99 €/mo","target":"cœur de cible","rationale":"pourquoi"}],"notes":"remarque marge/crédits IA"}
}
Inclus NOTRE PRODUIT en première ligne de "rows" (isYou=true) et une ligne par concurrent. La SWOT est du point de vue de NOTRE produit.

${(body.language === "en") ? "Write ALL textual values (summary, positioning, tiers, notes, swot, rationale…) in ENGLISH." : "Rédige toutes les valeurs textuelles en français."}`;

  // #14 — Causes racines de l'échec récurrent : (a) max_tokens 4000 trop bas pour
  // la matrice 12 dimensions × N produits + SWOT + pricing → JSON tronqué non
  // parsable ; (b) timeout par défaut du helper (30 s) trop court pour une
  // génération de cette taille alors que maxDuration = 120 s. On monte les deux
  // (90 s < 120 s, fetchs inclus) et on ré-essaie 1 fois sur échec transitoire
  // (le helper ne ré-essaie pas après un timeout, pas de risque de 504).
  const { data, error: aiError } = await callClaudeJSONRetryResult<BenchmarkResult>(
    prompt,
    {
      model: "claude-sonnet-4-6",
      maxTokens: 8000,
      temperature: 0.4,
      timeoutMs: 90_000,
      system: "Tu réponds uniquement en JSON valide, sans texte autour.",
    },
    1
  );

  if (!data) {
    const en = body.language === "en";
    const timedOut = /tim(e|ed)?\s*-?\s*out|timeout/i.test(aiError ?? "");
    const msg = timedOut
      ? (en
          ? "Benchmark generation timed out — retry with fewer competitors."
          : "Génération du benchmark trop longue — réessayez avec moins de concurrents.")
      : (en
          ? `Benchmark generation failed (${aiError ?? "unknown error"}). Please retry.`
          : `Échec de génération du benchmark (${aiError ?? "erreur inconnue"}). Réessayez.`);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json({ result: data });
}
