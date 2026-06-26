// « Cerveau » Publicité Meta : fusionne la PERFORMANCE RÉELLE du compte pub
// (Marketing API), la MÉMOIRE STRATÉGIQUE (RAG : veille concurrents + pubs +
// Page) et le contexte de marque, puis fait analyser le tout par un LLM
// (stratège media buying senior). Les recommandations sont réinjectées dans le
// RAG pour affiner les analyses suivantes (boucle d'apprentissage).

export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext, fetchAdAccountData } from "@/lib/connectors/meta-pages";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getMemoryContext, appendMemory } from "@/lib/memory";
import { callClaudeJSONRetry } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

type Lang = "fr" | "en";

interface Analysis {
  diagnostic: string;
  winners: { name: string; why: string }[];
  toFix: { name: string; issue: string; action: string }[];
  budgetMoves: string[];
  audienceIdeas: string[];
  creativeAngles: string[];
  competitorInsights: string[];
  nextActions: { priority: "haute" | "moyenne" | "basse"; action: string }[];
  kpiWatch: string[];
  aiGenerated: boolean;
}

interface CampaignPerf {
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  currency: string;
}

/**
 * Filet de sécurité (BUG #7) : analyse stratégique DÉTERMINISTE bâtie à partir
 * des métriques réelles, lorsque l'IA n'est pas configurée ou renvoie une
 * réponse inexploitable. Garantit que le « Cerveau Pub » ne débouche JAMAIS sur
 * une impasse « réponse non exploitable » : on identifie les meilleures/pires
 * campagnes (CTR / dépense / conversions) et on propose des recommandations
 * concrètes. Le champ `fallback` permet à l'UI d'afficher une note calme.
 */
function fallbackAnalysis(campaigns: CampaignPerf[], lang: Lang): Analysis {
  const tr = (fr: string, en: string) => (lang === "en" ? en : fr);
  const cur = campaigns[0]?.currency || "";

  if (campaigns.length === 0) {
    return {
      diagnostic: tr(
        "Aucune campagne lue. Sélectionnez un compte publicitaire Meta (section Publicité → Comptes) pour analyser la performance réelle.",
        "No campaigns read. Select a Meta ad account (Advertising → Accounts) to analyze real performance."
      ),
      winners: [], toFix: [], budgetMoves: [], audienceIdeas: [], creativeAngles: [],
      competitorInsights: [], nextActions: [], kpiWatch: [], aiGenerated: false,
    };
  }

  const withClicks = campaigns.filter((c) => c.clicks > 0);
  const byCtr = [...campaigns].sort((a, b) => b.ctr - a.ctr);
  const bySpend = [...campaigns].sort((a, b) => b.spend - a.spend);
  const best = byCtr[0];
  const worst = [...withClicks].sort((a, b) => a.ctr - b.ctr)[0] ?? byCtr[byCtr.length - 1];
  const topSpender = bySpend[0];
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalConv = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgCtr = campaigns.length ? campaigns.reduce((s, c) => s + c.ctr, 0) / campaigns.length : 0;

  const diagnostic = tr(
    `${campaigns.length} campagne(s) analysée(s). Dépense cumulée ${totalSpend.toFixed(0)} ${cur}, ${totalConv} conversion(s), CTR moyen ${avgCtr.toFixed(2)}%. Meilleure campagne au CTR : « ${best?.name} » (${best?.ctr.toFixed(2)}%). À surveiller : « ${worst?.name} » (CTR ${worst?.ctr.toFixed(2)}%). Synthèse calculée directement à partir de vos chiffres réels.`,
    `${campaigns.length} campaign(s) analyzed. Total spend ${totalSpend.toFixed(0)} ${cur}, ${totalConv} conversion(s), average CTR ${avgCtr.toFixed(2)}%. Best campaign by CTR: "${best?.name}" (${best?.ctr.toFixed(2)}%). Watch out: "${worst?.name}" (CTR ${worst?.ctr.toFixed(2)}%). Summary computed directly from your real figures.`
  );

  const winners = best
    ? [{
        name: best.name,
        why: tr(
          `CTR le plus élevé du compte (${best.ctr.toFixed(2)}%), ${best.conversions} conversion(s) — angle à conserver et décliner.`,
          `Highest CTR on the account (${best.ctr.toFixed(2)}%), ${best.conversions} conversion(s) — angle to keep and replicate.`
        ),
      }]
    : [];

  const toFix: Analysis["toFix"] = [];
  if (worst && worst !== best) {
    toFix.push({
      name: worst.name,
      issue: tr(
        `CTR faible (${worst.ctr.toFixed(2)}%) pour ${worst.spend.toFixed(0)} ${cur} dépensés, ${worst.conversions} conversion(s).`,
        `Low CTR (${worst.ctr.toFixed(2)}%) for ${worst.spend.toFixed(0)} ${cur} spent, ${worst.conversions} conversion(s).`
      ),
      action: tr(
        "Tester un nouveau créatif/accroche et réduire le budget de 20–30 % en attendant l'amélioration.",
        "Test a fresh creative/hook and cut budget by 20–30% until it improves."
      ),
    });
  }
  const waster = campaigns.find((c) => c.spend >= 20 && c.conversions === 0);
  if (waster && !toFix.some((f) => f.name === waster.name)) {
    toFix.push({
      name: waster.name,
      issue: tr(
        `${waster.spend.toFixed(0)} ${cur} dépensés sans conversion.`,
        `${waster.spend.toFixed(0)} ${cur} spent with zero conversions.`
      ),
      action: tr("Mettre en pause ou revoir le ciblage avant de relancer.", "Pause or revisit targeting before re-launching."),
    });
  }

  const budgetMoves: string[] = [];
  if (best && best.conversions > 0) {
    budgetMoves.push(tr(
      `+20–30 % sur « ${best.name} » (meilleur CTR, conversions présentes).`,
      `+20–30% on "${best.name}" (best CTR, has conversions).`
    ));
  }
  if (worst && worst !== best) {
    budgetMoves.push(tr(
      `-20–30 % sur « ${worst.name} » (CTR sous la moyenne).`,
      `-20–30% on "${worst.name}" (below-average CTR).`
    ));
  }

  return {
    diagnostic,
    winners,
    toFix,
    budgetMoves,
    audienceIdeas: [
      tr("Lookalike 1–3 % bâti sur vos derniers convertisseurs.", "Lookalike 1–3% built on your latest converters."),
      tr("Retargeting des visiteurs 7–14 jours non convertis.", "Retargeting 7–14 day visitors who didn't convert."),
    ],
    creativeAngles: [
      tr(`Décliner l'accroche de « ${best?.name} » en nouveaux formats (vidéo courte, UGC).`, `Repurpose the hook from "${best?.name}" into new formats (short video, UGC).`),
    ],
    competitorInsights: [],
    nextActions: [
      { priority: "haute", action: tr(`Réallouer le budget de « ${worst?.name} » vers « ${best?.name} ».`, `Reallocate budget from "${worst?.name}" to "${best?.name}".`) },
      { priority: "moyenne", action: tr(`Tester 2 nouveaux créatifs sur la campagne au plus gros budget (« ${topSpender?.name} »).`, `Test 2 new creatives on the top-spending campaign ("${topSpender?.name}").`) },
    ],
    kpiWatch: [
      tr("CTR > 1 % par campagne.", "CTR > 1% per campaign."),
      tr("CPA / coût par conversion stable ou en baisse.", "CPA / cost per conversion stable or decreasing."),
    ],
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

    // BUG #7 : la langue de l'UI pilote la langue de l'analyse (IA + fallback).
    const lang: Lang = body?.language === "en" ? "en" : "fr";

    const uuid = await resolveCompanyUuid(companyId);

    // 1) Performance réelle du compte publicitaire sélectionné.
    const ctx = await getMetaContext(companyId);
    let account: { name: string; currency: string; amountSpent: number } | undefined;
    let campaigns: CampaignPerf[] = [];
    if (ctx.userToken && ctx.adAccountId) {
      const d = await fetchAdAccountData(ctx.userToken, ctx.adAccountId);
      account = d.account ? { name: d.account.name, currency: d.account.currency, amountSpent: d.account.amountSpent } : undefined;
      campaigns = d.campaigns.map((c) => ({
        name: c.name, status: c.status, objective: c.objective,
        spend: c.spend, impressions: c.impressions, clicks: c.clicks,
        ctr: c.ctr, cpc: c.cpc, conversions: c.conversions, currency: c.currency,
      }));
    }

    // 2) Contexte de marque + RAG (veille concurrents, pubs, Page).
    let brandName = "", brandVoice = "";
    try {
      const sb = createAdminClient();
      if (sb) {
        const { data } = await sb.from("sh_companies").select("name, brand_voice").eq("id", uuid).maybeSingle();
        if (data) { brandName = String(data.name ?? ""); brandVoice = String(data.brand_voice ?? ""); }
      }
    } catch { /* ignore */ }
    const memory = await getMemoryContext(companyId, 18).catch(() => "");

    // IA non configurée → analyse déterministe utile (BUG #7 : jamais d'impasse).
    if (!isAiConfigured) {
      return NextResponse.json({
        analysis: fallbackAnalysis(campaigns, lang),
        account,
        campaignsCount: campaigns.length,
        fallback: true,
      });
    }

    // 3) LLM stratège.
    const perf = campaigns.map((c) => ({
      campagne: c.name, statut: c.status, objectif: c.objective,
      depense: c.spend, impressions: c.impressions, clics: c.clicks,
      ctr: c.impressions ? +(c.clicks / c.impressions * 100).toFixed(2) : 0,
      cpc: c.clicks ? +(c.spend / c.clicks).toFixed(2) : 0,
      conversions: c.conversions,
    }));

    // BUG #7 : directive de langue forte EN TÊTE et EN FIN du prompt.
    const langDirective =
      lang === "en"
        ? `ABSOLUTE LANGUAGE RULE: write ALL output (every "diagnostic", "why", "issue", "action", and every list item) in ENGLISH ONLY. Never use French. This overrides any other instruction below.`
        : `RÈGLE DE LANGUE ABSOLUE : rédige TOUTE la sortie (chaque "diagnostic", "why", "issue", "action" et chaque élément de liste) en FRANÇAIS uniquement.`;

    const prompt = `${langDirective}

Tu es un media buyer / growth strategist senior spécialiste Meta Ads. Analyse la performance RÉELLE du compte publicitaire et propose une stratégie d'optimisation actionnable et chiffrée.

MARQUE : ${brandName || "(non précisée)"}${brandVoice ? `\nVOIX : ${brandVoice}` : ""}
COMPTE : ${account ? `${account.name} — devise ${account.currency}, dépense cumulée ${account.amountSpent / 100} ${account.currency}` : "(compte non sélectionné)"}

PERFORMANCE PAR CAMPAGNE (toute la période disponible) :
${perf.length ? JSON.stringify(perf, null, 2) : "(aucune campagne)"}

MÉMOIRE STRATÉGIQUE (RAG — veille concurrents, pubs, Page) :
${memory || "(vide)"}

Retourne STRICTEMENT ce JSON (concret, chiffré quand possible) :
{
  "diagnostic": "3-4 phrases : santé du compte, ce qui ressort (CTR/CPC/dépense), opportunités",
  "winners": [{"name":"campagne ou angle","why":"pourquoi ça marche"}],
  "toFix": [{"name":"campagne","issue":"problème mesuré","action":"correctif précis"}],
  "budgetMoves": ["réallocations de budget concrètes (ex. -X% sur A, +Y% sur B)"],
  "audienceIdeas": ["audiences à tester (lookalike, intérêts, retargeting…)"],
  "creativeAngles": ["angles créatifs à tester, inspirés de la marque + concurrents"],
  "competitorInsights": ["enseignements tirés de la veille concurrents"],
  "nextActions": [{"priority":"haute|moyenne|basse","action":"action priorisée"}],
  "kpiWatch": ["KPIs à surveiller et seuils"]
}
Max 5 éléments par liste. Base-toi sur les données réelles ; si peu de données, dis-le et propose un plan de test.

${langDirective}`;

    const parsed = await callClaudeJSONRetry<Partial<Analysis>>(prompt, { maxTokens: 3500 }, 1);
    if (!parsed) {
      // BUG #7 : l'IA est configurée mais n'a pas renvoyé d'analyse exploitable
      // → on bascule sur l'analyse déterministe bâtie sur les chiffres réels.
      // Plus JAMAIS d'impasse « réponse non exploitable ».
      return NextResponse.json({
        analysis: fallbackAnalysis(campaigns, lang),
        account,
        campaignsCount: campaigns.length,
        fallback: true,
      });
    }

    const analysis: Analysis = {
      diagnostic: parsed.diagnostic ?? fallbackAnalysis(campaigns, lang).diagnostic,
      winners: (parsed.winners ?? []).slice(0, 5),
      toFix: (parsed.toFix ?? []).slice(0, 5),
      budgetMoves: (parsed.budgetMoves ?? []).slice(0, 5),
      audienceIdeas: (parsed.audienceIdeas ?? []).slice(0, 5),
      creativeAngles: (parsed.creativeAngles ?? []).slice(0, 5),
      competitorInsights: (parsed.competitorInsights ?? []).slice(0, 5),
      nextActions: (parsed.nextActions ?? []).slice(0, 5),
      kpiWatch: (parsed.kpiWatch ?? []).slice(0, 5),
      aiGenerated: true,
    };

    // 4) Boucle d'apprentissage : on conserve les recommandations dans le RAG.
    try {
      const entries = [
        { title: "Diagnostic pub", content: analysis.diagnostic, kind: "insight" as const },
        ...analysis.budgetMoves.map((b) => ({ title: "Budget", content: b, kind: "recommendation" as const })),
        ...analysis.creativeAngles.map((a) => ({ title: "Angle créatif", content: a, kind: "angle" as const })),
        ...analysis.nextActions.map((a) => ({ title: `Action (${a.priority})`, content: a.action, kind: "recommendation" as const })),
      ].filter((e) => e.content);
      await appendMemory(companyId, entries.map((e) => ({ source: "ads" as const, kind: e.kind, title: e.title, content: e.content, score: 3 })));
    } catch { /* non bloquant */ }

    return NextResponse.json({ analysis, account, campaignsCount: campaigns.length });
  } catch (e) {
    console.error("[POST /api/meta/ads-strategy]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
