// « Cerveau Contenu » : équivalent organique du Cerveau Pub. Fusionne les
// indicateurs organiques RÉELS (Facebook/Instagram, lib/pilotage-live.ts) et la
// mémoire stratégique (RAG : veille concurrents, angles/formats déjà appris),
// puis fait analyser le tout par un LLM (stratège éditorial senior).
// Les recommandations qualitatives sont réinjectées dans le RAG (source
// "organic") pour affiner les analyses suivantes — miroir exact de
// /api/meta/ads-strategy, côté organique plutôt que payant.

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getMemoryContext, appendMemory } from "@/lib/memory";
import { callClaudeJSONRetry } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";
import { fetchLiveKpis, type LiveNetworkKpis } from "@/lib/pilotage-live";

type Lang = "fr" | "en";

interface ContentAnalysis {
  diagnostic: string;
  bestPerformer: { network: string; why: string } | null;
  toImprove: { network: string; issue: string; action: string }[];
  formatIdeas: string[];
  angleIdeas: string[];
  cadenceAdvice: string[];
  nextActions: { priority: "haute" | "moyenne" | "basse"; action: string }[];
  kpiWatch: string[];
  aiGenerated: boolean;
}

const NET_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn" };

/**
 * Filet de sécurité (même logique que fallbackAnalysis de /api/meta/ads-strategy) :
 * synthèse déterministe bâtie sur les vrais indicateurs organiques, utilisée si
 * l'IA n'est pas configurée ou renvoie une réponse inexploitable. Jamais d'impasse.
 */
function fallbackAnalysis(kpis: LiveNetworkKpis[], lang: Lang): ContentAnalysis {
  const tr = (fr: string, en: string) => (lang === "en" ? en : fr);
  const measured = kpis.filter((k) => k.measured);

  if (measured.length === 0) {
    return {
      diagnostic: tr(
        "Aucun réseau organique mesuré. Connectez votre Page Facebook ou votre compte Instagram professionnel dans Connecteurs pour analyser vos contenus.",
        "No organic network measured. Connect your Facebook Page or Instagram business account in Connectors to analyze your content."
      ),
      bestPerformer: null, toImprove: [], formatIdeas: [], angleIdeas: [], cadenceAdvice: [],
      nextActions: [], kpiWatch: [], aiGenerated: false,
    };
  }

  const byEngagement = [...measured].sort((a, b) => b.engagementRate - a.engagementRate);
  const best = byEngagement[0];
  const worst = byEngagement[byEngagement.length - 1];
  const totalPosts = measured.reduce((s, k) => s + k.postsAnalysed, 0);

  const diagnostic = tr(
    `${measured.length} réseau(x) mesuré(s), ${totalPosts} publication(s) analysée(s). Meilleur engagement : ${NET_LABEL[best.network]} (${best.engagementRate} %). ${worst !== best ? `À surveiller : ${NET_LABEL[worst.network]} (${worst.engagementRate} %).` : ""} Synthèse calculée directement à partir de vos chiffres réels.`,
    `${measured.length} network(s) measured, ${totalPosts} post(s) analyzed. Best engagement: ${NET_LABEL[best.network]} (${best.engagementRate}%). ${worst !== best ? `Watch out: ${NET_LABEL[worst.network]} (${worst.engagementRate}%).` : ""} Summary computed directly from your real figures.`
  );

  const toImprove: ContentAnalysis["toImprove"] = [];
  if (worst && worst !== best && worst.postsAnalysed > 0) {
    toImprove.push({
      network: NET_LABEL[worst.network],
      issue: tr(`Engagement à ${worst.engagementRate} % sur ${worst.postsAnalysed} publication(s).`, `Engagement at ${worst.engagementRate}% over ${worst.postsAnalysed} post(s).`),
      action: tr("Tester un nouveau format (vidéo courte, carrousel) et comparer l'engagement sur 2 semaines.", "Test a new format (short video, carousel) and compare engagement over 2 weeks."),
    });
  }
  for (const k of measured) {
    if (k.daysSinceLastPost !== undefined && k.daysSinceLastPost >= 7 && !toImprove.some((f) => f.network === NET_LABEL[k.network])) {
      toImprove.push({
        network: NET_LABEL[k.network],
        issue: tr(`${k.daysSinceLastPost} jours sans publication.`, `${k.daysSinceLastPost} days without a post.`),
        action: tr("Programmer au moins un post cette semaine pour ne pas perdre l'audience.", "Schedule at least one post this week to avoid losing the audience."),
      });
    }
  }

  return {
    diagnostic,
    bestPerformer: best
      ? { network: NET_LABEL[best.network], why: tr(`Engagement le plus élevé (${best.engagementRate} %) sur ${best.postsAnalysed} publication(s) — format à décliner.`, `Highest engagement (${best.engagementRate}%) over ${best.postsAnalysed} post(s) — format worth repeating.`) }
      : null,
    toImprove,
    formatIdeas: [
      tr("Vidéo courte verticale (Reel/Story) pour capter l'attention sur mobile.", "Short vertical video (Reel/Story) to capture attention on mobile."),
      tr("Carrousel pédagogique (avant/après, étapes, chiffres clés).", "Educational carousel (before/after, steps, key figures)."),
    ],
    angleIdeas: [],
    cadenceAdvice: [
      tr("Visez au moins 1 publication par semaine et par réseau connecté pour éviter le silence éditorial.", "Aim for at least 1 post per week per connected network to avoid editorial silence."),
    ],
    nextActions: [
      { priority: "haute", action: tr(`Décliner le format gagnant de ${best ? NET_LABEL[best.network] : "votre meilleur réseau"} sur les autres réseaux.`, `Repurpose the winning format from ${best ? NET_LABEL[best.network] : "your best network"} on other networks.`) },
    ],
    kpiWatch: [tr("Taux d'engagement par réseau.", "Engagement rate per network."), tr("Jours depuis la dernière publication.", "Days since last post.")],
    aiGenerated: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = body?.companyId;
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const lang: Lang = body?.language === "en" ? "en" : "fr";
    const uuid = await resolveCompanyUuid(companyId);

    // 1) Indicateurs organiques réels (mêmes données que le Centre de pilotage).
    const kpis = await fetchLiveKpis(companyId);
    const measured = kpis.filter((k) => k.measured);

    // 2) Contexte de marque + RAG (veille : formats/angles déjà identifiés).
    let brandName = "", brandVoice = "";
    try {
      const sb = createAdminClient();
      if (sb) {
        const { data } = await sb.from("sh_companies").select("name, brand_voice").eq("id", uuid).maybeSingle();
        if (data) { brandName = String(data.name ?? ""); brandVoice = String(data.brand_voice ?? ""); }
      }
    } catch { /* ignore */ }
    const memory = await getMemoryContext(companyId, 18).catch(() => "");

    if (!isAiConfigured) {
      return NextResponse.json({ analysis: fallbackAnalysis(kpis, lang), measuredCount: measured.length, fallback: true });
    }

    const perf = measured.map((k) => ({
      reseau: NET_LABEL[k.network] ?? k.network,
      abonnes: k.followers,
      publications_analysees: k.postsAnalysed,
      taux_engagement: k.engagementRate,
      jours_depuis_derniere_publication: k.daysSinceLastPost ?? null,
    }));

    const langDirective =
      lang === "en"
        ? `ABSOLUTE LANGUAGE RULE: write ALL output (every "diagnostic", "why", "issue", "action", and every list item) in ENGLISH ONLY. Never use French. This overrides any other instruction below.`
        : `RÈGLE DE LANGUE ABSOLUE : rédige TOUTE la sortie (chaque "diagnostic", "why", "issue", "action" et chaque élément de liste) en FRANÇAIS uniquement.`;

    const prompt = `${langDirective}

Tu es un stratège éditorial social media senior. Analyse la performance ORGANIQUE réelle (hors publicité payante) et propose une stratégie de contenu actionnable.

MARQUE : ${brandName || "(non précisée)"}${brandVoice ? `\nVOIX : ${brandVoice}` : ""}

PERFORMANCE ORGANIQUE PAR RÉSEAU (données réelles) :
${perf.length ? JSON.stringify(perf, null, 2) : "(aucun réseau mesuré)"}

MÉMOIRE STRATÉGIQUE (RAG — veille concurrents, formats/angles déjà identifiés) :
${memory || "(vide)"}

Retourne STRICTEMENT ce JSON (concret, chiffré quand possible) :
{
  "diagnostic": "3-4 phrases : santé éditoriale, ce qui ressort (engagement, régularité), opportunités",
  "bestPerformer": {"network":"réseau le plus performant","why":"pourquoi, chiffré"} ou null si aucune donnée,
  "toImprove": [{"network":"réseau","issue":"problème mesuré","action":"correctif précis"}],
  "formatIdeas": ["formats à tester, inspirés de ce qui marche déjà + de la veille"],
  "angleIdeas": ["angles éditoriaux à tester, inspirés de la marque + concurrents"],
  "cadenceAdvice": ["conseils de rythme de publication par réseau"],
  "nextActions": [{"priority":"haute|moyenne|basse","action":"action priorisée"}],
  "kpiWatch": ["KPIs organiques à surveiller et seuils"]
}
Max 5 éléments par liste. Base-toi sur les données réelles ; si peu de données, dis-le et propose un plan de test.

${langDirective}`;

    const parsed = await callClaudeJSONRetry<Partial<ContentAnalysis>>(prompt, { maxTokens: 3000 }, 1);
    if (!parsed) {
      return NextResponse.json({ analysis: fallbackAnalysis(kpis, lang), measuredCount: measured.length, fallback: true });
    }

    const analysis: ContentAnalysis = {
      diagnostic: parsed.diagnostic ?? fallbackAnalysis(kpis, lang).diagnostic,
      bestPerformer: parsed.bestPerformer ?? null,
      toImprove: (parsed.toImprove ?? []).slice(0, 5),
      formatIdeas: (parsed.formatIdeas ?? []).slice(0, 5),
      angleIdeas: (parsed.angleIdeas ?? []).slice(0, 5),
      cadenceAdvice: (parsed.cadenceAdvice ?? []).slice(0, 5),
      nextActions: (parsed.nextActions ?? []).slice(0, 5),
      kpiWatch: (parsed.kpiWatch ?? []).slice(0, 5),
      aiGenerated: true,
    };

    // 3) Mémoire RAG (source "organic") : conserve les recommandations
    // qualitatives pour affiner les prochaines analyses — même logique que
    // /api/meta/ads-strategy (source "ads"), séparée pour ne pas mélanger les
    // enseignements payants et organiques.
    try {
      const entries = [
        { title: "Diagnostic contenu", content: analysis.diagnostic, kind: "insight" as const },
        ...analysis.formatIdeas.map((f) => ({ title: "Format", content: f, kind: "format" as const })),
        ...analysis.angleIdeas.map((a) => ({ title: "Angle éditorial", content: a, kind: "angle" as const })),
        ...analysis.nextActions.map((a) => ({ title: `Action (${a.priority})`, content: a.action, kind: "recommendation" as const })),
      ].filter((e) => e.content);
      await appendMemory(companyId, entries.map((e) => ({ source: "organic" as const, kind: e.kind, title: e.title, content: e.content, score: 3 })));
    } catch { /* non bloquant */ }

    return NextResponse.json({ analysis, measuredCount: measured.length });
  } catch (e) {
    console.error("[POST /api/content/strategy]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
