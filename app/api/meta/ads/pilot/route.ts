// GET /api/meta/ads/pilot?companyId=…  → « Pilote Pub » : lit la performance
// réelle et propose des ACTIONS concrètes (pause, budget, activation), chacune
// taguée « sûre » ou « dépense ». N'applique rien (voir /api/meta/ads/apply).

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext, fetchAdAccountData } from "@/lib/connectors/meta-pages";
import { callClaudeJSONRetry } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

interface PilotAction {
  type: "pause" | "activate" | "budget";
  campaignId: string;
  campaignName: string;
  reason: string;
  factor?: number;        // pour type=budget (ex 1.2 = +20%, 0.7 = -30%)
  impact: "safe" | "spend";
}

type Lang = "fr" | "en";

interface CampaignPerf {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
}

/**
 * Filet de sécurité (BUG #14) : optimisations GÉNÉRIQUES par heuristiques simples
 * lorsque l'IA renvoie une réponse inexploitable. Garantit que le « Pilote Pub »
 * ne débouche jamais sur une impasse — on propose toujours des actions sensées.
 */
function fallbackActions(campaigns: CampaignPerf[], lang: Lang): PilotAction[] {
  const tr = (fr: string, en: string) => (lang === "en" ? en : fr);
  const out: PilotAction[] = [];

  for (const c of campaigns) {
    if (out.length >= 6) break;
    const active = c.status === "ACTIVE";

    // Gaspillage manifeste : dépense réelle, aucune conversion → pause (sûr).
    if (active && c.spend >= 20 && c.conversions === 0) {
      out.push({
        type: "pause",
        campaignId: c.id,
        campaignName: c.name,
        reason: tr(
          `Dépense de ${c.spend.toFixed(0)} sans conversion : mettre en pause limite le gaspillage.`,
          `Spent ${c.spend.toFixed(0)} with zero conversions: pausing limits waste.`
        ),
        impact: "safe",
      });
      continue;
    }
    // CTR faible malgré du volume → réduire le budget (sûr).
    if (active && c.clicks >= 50 && c.ctr > 0 && c.ctr < 0.8) {
      out.push({
        type: "budget",
        campaignId: c.id,
        campaignName: c.name,
        factor: 0.7,
        reason: tr(
          `CTR faible (${c.ctr.toFixed(2)}%) : réduire le budget de 30 % en attendant un meilleur créatif.`,
          `Low CTR (${c.ctr.toFixed(2)}%): cut budget by 30% until creative improves.`
        ),
        impact: "safe",
      });
      continue;
    }
    // Gagnante claire → scaler prudemment (dépense).
    if (active && c.conversions >= 3 && c.ctr >= 1.2) {
      out.push({
        type: "budget",
        campaignId: c.id,
        campaignName: c.name,
        factor: 1.3,
        reason: tr(
          `Bonne performance (${c.conversions} conv., CTR ${c.ctr.toFixed(2)}%) : augmenter le budget de 30 %.`,
          `Strong performance (${c.conversions} conv., ${c.ctr.toFixed(2)}% CTR): scale budget by 30%.`
        ),
        impact: "spend",
      });
      continue;
    }

    // Campagne en pause clairement rentable → la réactiver (dépense).
    if (!active && c.conversions >= 2 && c.ctr >= 1) {
      out.push({
        type: "activate",
        campaignId: c.id,
        campaignName: c.name,
        reason: tr(
          `En pause mais rentable par le passé (${c.conversions} conv., CTR ${c.ctr.toFixed(2)}%) : la réactiver peut relancer les résultats.`,
          `Paused but profitable historically (${c.conversions} conv., ${c.ctr.toFixed(2)}% CTR): reactivating it can revive results.`
        ),
        impact: "spend",
      });
      continue;
    }

    // Catch-all : aucune règle franche ne s'applique. On propose tout de même un
    // ajustement de budget léger et SÛR (-10 %) pour ne JAMAIS laisser l'utilisateur
    // sans suggestion exploitable (BUG #9 : jamais d'impasse « rien à proposer »).
    if (active) {
      out.push({
        type: "budget",
        campaignId: c.id,
        campaignName: c.name,
        factor: 0.9,
        reason: tr(
          `Performance moyenne (CTR ${c.ctr.toFixed(2)}%, ${c.conversions} conv.) : réduire légèrement le budget (-10 %) et tester un nouveau créatif avant de scaler.`,
          `Average performance (${c.ctr.toFixed(2)}% CTR, ${c.conversions} conv.): trim budget slightly (-10%) and test a fresh creative before scaling.`
        ),
        impact: "safe",
      });
    }
  }

  return out.slice(0, 6);
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const companyId = sp.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    // BUG #15 : la langue de l'UI pilote la langue des propositions.
    const lang: Lang = sp.get("language") === "en" ? "en" : "fr";

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken || !ctx.adAccountId) return NextResponse.json({ connected: false, actions: [] });

    const data = await fetchAdAccountData(ctx.userToken, ctx.adAccountId, "maximum");
    const campaigns: CampaignPerf[] = data.campaigns
      .filter((c) => c.id)
      .map((c) => ({
        id: c.id, name: c.name, status: c.status, spend: c.spend, impressions: c.impressions,
        clicks: c.clicks, ctr: c.ctr, cpc: c.cpc, conversions: c.conversions,
      }));
    // Aucune campagne à optimiser : message clair et calme (pas une erreur).
    if (campaigns.length === 0) {
      return NextResponse.json({ connected: true, actions: [], noCampaigns: true });
    }

    const validIds = new Set(campaigns.map((c) => c.id));
    const normalize = (raw: PilotAction[]): PilotAction[] =>
      raw
        .filter((a) => a && validIds.has(a.campaignId) && ["pause", "activate", "budget"].includes(a.type))
        .slice(0, 6)
        .map((a) => ({
          ...a,
          impact: a.type === "pause" ? "safe" : a.type === "budget" ? ((a.factor ?? 1) > 1 ? "spend" : "safe") : "spend",
        }));

    // IA non configurée → on dégrade quand même vers des propositions utiles
    // (BUG #14 : jamais d'impasse) plutôt que de renvoyer une liste vide.
    if (!isAiConfigured) {
      return NextResponse.json({ connected: true, actions: normalize(fallbackActions(campaigns, lang)), fallback: true });
    }

    const perf = campaigns.map((c) => ({
      id: c.id, nom: c.name, statut: c.status, depense: c.spend, impressions: c.impressions,
      clics: c.clicks, ctr: c.ctr, cpc: c.cpc, conversions: c.conversions,
    }));

    // BUG #15 : directive de langue forte EN TÊTE et EN FIN du prompt.
    const langDirective =
      lang === "en"
        ? `ABSOLUTE LANGUAGE RULE: write EVERY "reason" and ALL human-readable text in ENGLISH ONLY. Never use French. This overrides any other instruction.`
        : `RÈGLE DE LANGUE ABSOLUE : rédige CHAQUE "reason" et tout texte lisible en FRANÇAIS uniquement.`;

    const prompt = `${langDirective}

Tu es un media buyer Meta senior. À partir de la PERFORMANCE RÉELLE (durée de vie), propose des ACTIONS d'optimisation concrètes et prudentes. Réfère-toi à "campaignId" exact.

PERFORMANCE :
${JSON.stringify(perf, null, 2)}

Règles :
- "pause" pour les campagnes qui gaspillent (CPC élevé, CTR faible, 0 conversion malgré dépense). impact="safe".
- "budget" avec "factor" pour scaler les gagnantes (>1, ex 1.3) ou réduire les perdantes (<1, ex 0.6). factor>1 → impact="spend", factor<1 → impact="safe".
- "activate" seulement si une campagne en pause est clairement prometteuse. impact="spend".
- Maximum 6 actions, priorise l'impact. S'il n'y a aucun problème évident, propose tout de même 1 à 3 optimisations génériques utiles (test créatif, ajustement de budget léger). Ne renvoie JAMAIS une liste vide tant qu'il existe au moins une campagne.

Réponds STRICTEMENT en JSON, sans texte hors du JSON : { "actions": [ { "type":"pause|activate|budget", "campaignId":"", "campaignName":"", "reason":"raison chiffrée et courte", "factor":1.0, "impact":"safe|spend" } ] }

${langDirective}`;

    const parsed = await callClaudeJSONRetry<{ actions?: PilotAction[] }>(prompt, { maxTokens: 1500 }, 1);
    let actions = normalize(parsed?.actions ?? []);

    // BUG #9 : réponse IA inexploitable (null) ou vide → filet de sécurité
    // déterministe. Le fallback propose désormais TOUJOURS au moins une action
    // sensée par campagne active, donc l'utilisateur n'aboutit jamais à une
    // impasse « l'IA n'a pas pu analyser ».
    let fallback = false;
    if (!parsed || actions.length === 0) {
      actions = normalize(fallbackActions(campaigns, lang));
      fallback = true;
    }

    return NextResponse.json({ connected: true, actions, fallback, account: data.account ?? null });
  } catch (e) {
    console.error("[GET /api/meta/ads/pilot]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
