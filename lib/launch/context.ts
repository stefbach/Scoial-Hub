// Agrégation du CONTEXTE de lancement (RAG) côté serveur.
//
// Récupère et fusionne tout ce que l'app sait déjà de la marque pour rendre le
// Copilote réellement contextuel :
//   - identité de marque  (BrandProfile + BrandKit)
//   - veille / benchmark  (mémoire stratégique : insights, formats, angles…)
//   - données publicitaires (performances + campagnes existantes)
//   - brief stratégique synthétisé
//
// Ne throw jamais : chaque source dégrade gracieusement vers vide.

import { getBrandProfile } from "@/lib/repositories/onboarding";
import { getBrandKit } from "@/lib/repositories/brand-kit";
import { getMemoryContext, getBrief, type StrategyBrief } from "@/lib/memory";
import { listCampaigns } from "@/lib/repositories/campaigns";
import { getCompanyData } from "@/lib/repositories/company-data";
import type { LaunchContextStatus } from "@/lib/launch/types";

export interface LaunchContext {
  companyName: string;
  /** Identité de marque consolidée (texte). */
  brandIdentity: string;
  hasBrandIdentity: boolean;
  /** Mémoire stratégique (veille / pubs / pages). */
  memory: string;
  memorySignals: number;
  /** Brief stratégique synthétisé. */
  brief: StrategyBrief | null;
  /** Performances publicitaires (texte compact). */
  ads: string;
  hasAds: boolean;
  /** Campagnes existantes (nom · objectif · plateformes). */
  campaigns: string;
  campaignsCount: number;
}

function clamp(s: string, n: number): string {
  const v = (s ?? "").trim();
  return v.length > n ? `${v.slice(0, n)}…` : v;
}

/** Construit le contexte complet de lancement pour une société. */
export async function buildLaunchContext(
  companyId: string,
  companyName = "la marque"
): Promise<LaunchContext> {
  const [profile, kit, memory, brief, campaigns, data] = await Promise.all([
    getBrandProfile(companyId).catch(() => null),
    getBrandKit(companyId).catch(() => null),
    getMemoryContext(companyId, 30).catch(() => ""),
    getBrief(companyId).catch(() => null),
    listCampaigns(companyId).catch(() => []),
    getCompanyData(companyId).catch(() => null),
  ]);

  // ── Identité de marque ──────────────────────────────────────────────────
  const idLines: string[] = [];
  if (profile) {
    if (profile.positioning) idLines.push(`Positionnement : ${clamp(profile.positioning, 300)}`);
    if (profile.audience) idLines.push(`Audience : ${clamp(profile.audience, 200)}`);
    if (profile.tone) idLines.push(`Ton : ${profile.tone}`);
    if (profile.keyMessage) idLines.push(`Message clé : ${clamp(profile.keyMessage, 200)}`);
    if (profile.mission) idLines.push(`Mission : ${clamp(profile.mission, 200)}`);
    if (profile.values?.length) idLines.push(`Valeurs : ${profile.values.slice(0, 6).join(", ")}`);
    if (profile.personality?.length) idLines.push(`Personnalité : ${profile.personality.slice(0, 6).join(", ")}`);
    if (profile.themes?.length) idLines.push(`Thèmes : ${profile.themes.slice(0, 8).join(", ")}`);
    if (profile.strengths?.length) idLines.push(`Forces : ${profile.strengths.slice(0, 6).join(", ")}`);
    if (profile.competitorAngles?.length) idLines.push(`Angles vs concurrents : ${profile.competitorAngles.slice(0, 5).join(", ")}`);
    if (profile.recommendedNetworks?.length) idLines.push(`Réseaux recommandés : ${profile.recommendedNetworks.join(", ")}`);
  }
  if (kit) {
    if (kit.tone && !profile?.tone) idLines.push(`Ton (kit) : ${kit.tone}`);
    if (kit.summary) idLines.push(`Charte : ${clamp(kit.summary, 200)}`);
    if (kit.chart?.toneWords?.length) idLines.push(`Mots de ton : ${kit.chart.toneWords.slice(0, 6).join(", ")}`);
    if (kit.chart?.tagline) idLines.push(`Tagline : ${kit.chart.tagline}`);
  }
  const brandIdentity = idLines.join("\n");

  // ── Publicité (performances) ────────────────────────────────────────────
  let ads = "";
  const ad = data?.adPerformance;
  if (ad) {
    const parts = [
      `Dépense : ${ad.spend}€ (${ad.spendTrend})`,
      `Conversions : ${ad.conversions} (${ad.conversionsTrend})`,
      `CPC moyen : ${ad.avgCpc}€`,
      ad.insight ? `Insight : ${clamp(ad.insight, 200)}` : "",
    ].filter(Boolean);
    if (ad.topAds?.length) {
      parts.push(
        `Meilleures pubs : ${ad.topAds.slice(0, 3).map((a) => `${a.name} (CTR ${a.ctr}, ${a.conv} conv.)`).join(" · ")}`
      );
    }
    ads = parts.join("\n");
  }

  // ── Campagnes existantes ────────────────────────────────────────────────
  const campaignsText = campaigns
    .slice(0, 8)
    .map((c) => `- ${c.name} · ${c.objective || "—"} · ${(c.platforms ?? []).join("/")} · ${c.status}`)
    .join("\n");

  return {
    companyName,
    brandIdentity,
    hasBrandIdentity: idLines.length > 0,
    memory: memory ?? "",
    memorySignals: memory ? memory.split("\n").filter(Boolean).length : 0,
    brief,
    ads,
    hasAds: Boolean(ads),
    campaigns: campaignsText,
    campaignsCount: campaigns.length,
  };
}

/** Statut compact pour l'UI (« données récupérées »). */
export function launchContextStatus(ctx: LaunchContext): LaunchContextStatus {
  return {
    brandIdentity: ctx.hasBrandIdentity,
    veille: ctx.memorySignals > 0 || Boolean(ctx.brief?.aiGenerated),
    ads: ctx.hasAds,
    campaigns: ctx.campaignsCount,
    memorySignals: ctx.memorySignals,
  };
}

/** Digest textuel injecté dans les prompts (copilote & stratégie). */
export function launchContextDigest(ctx: LaunchContext): string {
  const blocks: string[] = [];
  if (ctx.brandIdentity) blocks.push(`## IDENTITÉ DE MARQUE (${ctx.companyName})\n${ctx.brandIdentity}`);
  if (ctx.brief) {
    const b = ctx.brief;
    blocks.push(
      `## BRIEF STRATÉGIQUE (synthèse veille)\n${b.resume}\n` +
        [
          b.opportunites?.length ? `Opportunités : ${b.opportunites.join("; ")}` : "",
          b.anglesPrioritaires?.length ? `Angles prioritaires : ${b.anglesPrioritaires.join("; ")}` : "",
          b.formatsGagnants?.length ? `Formats gagnants : ${b.formatsGagnants.join("; ")}` : "",
          b.concurrentsCles?.length ? `Concurrents clés : ${b.concurrentsCles.join("; ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
    );
  }
  if (ctx.memory) blocks.push(`## MÉMOIRE STRATÉGIQUE (veille / pubs / pages)\n${clamp(ctx.memory, 2200)}`);
  if (ctx.ads) blocks.push(`## PERFORMANCES PUBLICITAIRES\n${ctx.ads}`);
  if (ctx.campaigns) blocks.push(`## CAMPAGNES EXISTANTES\n${ctx.campaigns}`);
  return blocks.join("\n\n");
}
