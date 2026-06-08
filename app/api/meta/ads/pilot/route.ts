// GET /api/meta/ads/pilot?companyId=…  → « Pilote Pub » : lit la performance
// réelle et propose des ACTIONS concrètes (pause, budget, activation), chacune
// taguée « sûre » ou « dépense ». N'applique rien (voir /api/meta/ads/apply).

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext, fetchAdAccountData } from "@/lib/connectors/meta-pages";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

interface PilotAction {
  type: "pause" | "activate" | "budget";
  campaignId: string;
  campaignName: string;
  reason: string;
  factor?: number;        // pour type=budget (ex 1.2 = +20%, 0.7 = -30%)
  impact: "safe" | "spend";
}

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken || !ctx.adAccountId) return NextResponse.json({ connected: false, actions: [] });

    const data = await fetchAdAccountData(ctx.userToken, ctx.adAccountId, "maximum");
    const campaigns = data.campaigns.filter((c) => c.id);
    if (campaigns.length === 0) return NextResponse.json({ connected: true, actions: [] });
    if (!isAiConfigured) return NextResponse.json({ connected: true, actions: [], note: "IA non configurée." });

    const perf = campaigns.map((c) => ({
      id: c.id, nom: c.name, statut: c.status, depense: c.spend, impressions: c.impressions,
      clics: c.clicks, ctr: c.ctr, cpc: c.cpc, conversions: c.conversions,
    }));

    const prompt = `Tu es un media buyer Meta senior. À partir de la PERFORMANCE RÉELLE (durée de vie), propose des ACTIONS d'optimisation concrètes et prudentes. Réfère-toi à "campaignId" exact.

PERFORMANCE :
${JSON.stringify(perf, null, 2)}

Règles :
- "pause" pour les campagnes qui gaspillent (CPC élevé, CTR faible, 0 conversion malgré dépense). impact="safe".
- "budget" avec "factor" pour scaler les gagnantes (>1, ex 1.3) ou réduire les perdantes (<1, ex 0.6). factor>1 → impact="spend", factor<1 → impact="safe".
- "activate" seulement si une campagne en pause est clairement prometteuse. impact="spend".
- Maximum 6 actions, priorise l'impact. Ne propose rien si tout est sain.

Réponds STRICTEMENT en JSON : { "actions": [ { "type":"pause|activate|budget", "campaignId":"", "campaignName":"", "reason":"raison chiffrée et courte", "factor":1.0, "impact":"safe|spend" } ] }`;

    const parsed = await callClaudeJSON<{ actions?: PilotAction[] }>(prompt, { maxTokens: 1500 });
    const validIds = new Set(campaigns.map((c) => c.id));
    const actions = (parsed?.actions ?? [])
      .filter((a) => a && validIds.has(a.campaignId) && ["pause", "activate", "budget"].includes(a.type))
      .slice(0, 6)
      .map((a) => ({
        ...a,
        impact: a.type === "pause" ? "safe" : a.type === "budget" ? ((a.factor ?? 1) > 1 ? "spend" : "safe") : "spend",
      }));

    return NextResponse.json({ connected: true, actions, account: data.account ?? null });
  } catch (e) {
    console.error("[GET /api/meta/ads/pilot]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
