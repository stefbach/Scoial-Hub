// « Cerveau » Publicité Meta : fusionne la PERFORMANCE RÉELLE du compte pub
// (Marketing API), la MÉMOIRE STRATÉGIQUE (RAG : veille concurrents + pubs +
// Page) et le contexte de marque, puis fait analyser le tout par un LLM
// (stratège media buying senior). Les recommandations sont réinjectées dans le
// RAG pour affiner les analyses suivantes (boucle d'apprentissage).

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext, fetchAdAccountData } from "@/lib/connectors/meta-pages";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getMemoryContext, appendMemory } from "@/lib/memory";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

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

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json();
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const uuid = await resolveCompanyUuid(companyId);

    // 1) Performance réelle du compte publicitaire sélectionné.
    const ctx = await getMetaContext(companyId);
    let account: { name: string; currency: string; amountSpent: number } | undefined;
    let campaigns: Array<{ name: string; status: string; objective: string; spend: number; impressions: number; clicks: number; currency: string }> = [];
    if (ctx.userToken && ctx.adAccountId) {
      const d = await fetchAdAccountData(ctx.userToken, ctx.adAccountId);
      account = d.account ? { name: d.account.name, currency: d.account.currency, amountSpent: d.account.amountSpent } : undefined;
      campaigns = d.campaigns;
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

    const empty: Analysis = {
      diagnostic: campaigns.length === 0
        ? "Aucune campagne lue. Sélectionnez un compte publicitaire Meta (section Publicité → Comptes) pour analyser la performance réelle."
        : `${campaigns.length} campagne(s) lue(s). Analyse IA en attente.`,
      winners: [], toFix: [], budgetMoves: [], audienceIdeas: [], creativeAngles: [],
      competitorInsights: [], nextActions: [], kpiWatch: [], aiGenerated: false,
    };

    if (!isAiConfigured) {
      return NextResponse.json({ analysis: empty, account, campaignsCount: campaigns.length });
    }

    // 3) LLM stratège.
    const perf = campaigns.map((c) => ({
      campagne: c.name, statut: c.status, objectif: c.objective,
      depense: c.spend, impressions: c.impressions, clics: c.clicks,
      ctr: c.impressions ? +(c.clicks / c.impressions * 100).toFixed(2) : 0,
      cpc: c.clicks ? +(c.spend / c.clicks).toFixed(2) : 0,
    }));

    const prompt = `Tu es un media buyer / growth strategist senior spécialiste Meta Ads. Analyse la performance RÉELLE du compte publicitaire et propose une stratégie d'optimisation actionnable et chiffrée.

MARQUE : ${brandName || "(non précisée)"}${brandVoice ? `\nVOIX : ${brandVoice}` : ""}
COMPTE : ${account ? `${account.name} — devise ${account.currency}, dépense cumulée ${account.amountSpent / 100} ${account.currency}` : "(compte non sélectionné)"}

PERFORMANCE PAR CAMPAGNE (toute la période disponible) :
${perf.length ? JSON.stringify(perf, null, 2) : "(aucune campagne)"}

MÉMOIRE STRATÉGIQUE (RAG — veille concurrents, pubs, Page) :
${memory || "(vide)"}

Retourne STRICTEMENT ce JSON (français, concret, chiffré quand possible) :
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
Max 5 éléments par liste. Base-toi sur les données réelles ; si peu de données, dis-le et propose un plan de test.`;

    const parsed = await callClaudeJSON<Partial<Analysis>>(prompt, { maxTokens: 2200 });
    if (!parsed) return NextResponse.json({ analysis: empty, account, campaignsCount: campaigns.length });

    const analysis: Analysis = {
      diagnostic: parsed.diagnostic ?? empty.diagnostic,
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
