// Moteur de pilotage intelligent (Centre de Pilotage).
// Calcule des indicateurs par réseau, un benchmark marché, des recommandations
// d'agents et des alertes. Déterministe (seed = entité+marché) et réaliste —
// conçu pour basculer sur les vraies données dès que Meta/LinkedIn sont connectés.

export type Network = "facebook" | "instagram" | "linkedin";

export interface NetworkKpis {
  network: Network;
  followers: number;
  followersTrend: number; // % vs période précédente
  engagementRate: number; // %
  engagementTrend: number;
  likes: number;
  comments: number;
  views: number;
  reach: number;
}

export interface BenchmarkRow {
  label: string;
  you: number;
  market: number;
  unit: string;
  better: boolean; // true si "you" >= market (pour les métriques où + = mieux)
}

export type DecisionAgent = "strategist" | "copywriter" | "creative" | "media_buyer" | "analyst" | "compliance";
export type DecisionStatus = "pending" | "approved" | "rejected";

export interface Decision {
  id: string;
  agent: DecisionAgent;
  channel?: Network | "sea";
  title: string;
  rationale: string;
  impact: string;
  status: DecisionStatus;
}

export type AlertLevel = "info" | "warning" | "critical";
export interface PilotAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
}

// ── Seed déterministe ─────────────────────────────────────────
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
  return h;
}
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}
const NETWORKS: Network[] = ["facebook", "instagram", "linkedin"];

export function computeNetworkKpis(companyId: string, market: string, days: number): NetworkKpis[] {
  return NETWORKS.map((network) => {
    const r = rng(hashSeed(`${companyId}|${market}|${network}|${days}`));
    const base = network === "instagram" ? 42000 : network === "facebook" ? 28000 : 12000;
    const followers = Math.round(base * (0.6 + r() * 0.9));
    const engagementRate = Number((1.4 + r() * 4.2).toFixed(2));
    const reach = Math.round(followers * (1.5 + r() * 4) * (days / 30));
    const views = Math.round(reach * (1.2 + r() * 2));
    const likes = Math.round(reach * engagementRate / 100 * (0.7 + r() * 0.4));
    const comments = Math.round(likes * (0.04 + r() * 0.06));
    return {
      network,
      followers,
      followersTrend: Number(((r() - 0.35) * 14).toFixed(1)),
      engagementRate,
      engagementTrend: Number(((r() - 0.4) * 22).toFixed(1)),
      likes,
      comments,
      views,
      reach,
    };
  });
}

export function aggregateKpis(kpis: NetworkKpis[]) {
  const sum = (f: (k: NetworkKpis) => number) => kpis.reduce((a, k) => a + f(k), 0);
  const followers = sum((k) => k.followers);
  const likes = sum((k) => k.likes);
  const comments = sum((k) => k.comments);
  const views = sum((k) => k.views);
  const reach = sum((k) => k.reach);
  const engagementRate = Number((kpis.reduce((a, k) => a + k.engagementRate, 0) / kpis.length).toFixed(2));
  return { followers, likes, comments, views, reach, engagementRate };
}

export function computeBenchmark(companyId: string, market: string, kpis: NetworkKpis[]): BenchmarkRow[] {
  const agg = aggregateKpis(kpis);
  const r = rng(hashSeed(`${market}|bench`));
  const marketEng = Number((2.1 + r() * 1.6).toFixed(2));
  const marketFollowersGrowth = Number((1.5 + r() * 3).toFixed(1));
  const yourGrowth = Number((kpis.reduce((a, k) => a + k.followersTrend, 0) / kpis.length).toFixed(1));
  const marketComments = Math.round(agg.likes * (0.05 + r() * 0.04));
  return [
    { label: "Taux d'engagement", you: agg.engagementRate, market: marketEng, unit: "%", better: agg.engagementRate >= marketEng },
    { label: "Croissance followers", you: yourGrowth, market: marketFollowersGrowth, unit: "%/mois", better: yourGrowth >= marketFollowersGrowth },
    { label: "Commentaires / post", you: Math.round(agg.comments / 30), market: Math.round(marketComments / 30), unit: "", better: agg.comments >= marketComments },
  ];
}

export function generateDecisions(companyId: string, market: string): Decision[] {
  const r = rng(hashSeed(`${companyId}|${market}|dec`));
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const templates: Omit<Decision, "id" | "status">[] = [
    { agent: "strategist", channel: "instagram", title: "Renforcer le pilier 'preuve sociale' sur Instagram", rationale: `Le marché ${market} sur-performe sur les témoignages patients (+38% d'engagement vs moyenne).`, impact: "+0,8 pt d'engagement estimé" },
    { agent: "copywriter", channel: "facebook", title: "Tester 3 nouveaux hooks orientés bénéfice", rationale: "Les hooks 'gain de temps' surperforment les hooks 'prix' sur ton audience 35-55.", impact: "+12% CTR estimé" },
    { agent: "media_buyer", channel: "sea", title: "Réallouer 15% du budget vers la campagne Leads", rationale: "CPA Leads 14€ vs 22€ sur Notoriété — meilleure efficience.", impact: "-18% CPA global estimé" },
    { agent: "creative", channel: "instagram", title: "Produire 2 Reels 9:16 'coulisses clinique'", rationale: "Le format Reels capte 3,2× plus de vues que le feed sur ce marché.", impact: "+2 400 portée / semaine" },
    { agent: "analyst", channel: "linkedin", title: "Publier le mardi 8h plutôt que vendredi", rationale: "Pic d'engagement B2B détecté en début de semaine pour le secteur.", impact: "+9% reach organique" },
  ];
  return templates.map((t, i) => ({ ...t, id: `dec-${i}`, status: "pending" as DecisionStatus })).sort(() => r() - 0.5).slice(0, 4 + Math.floor(r() * 1));
}

export function generateAlerts(companyId: string, market: string, kpis: NetworkKpis[]): PilotAlert[] {
  const alerts: PilotAlert[] = [];
  const ig = kpis.find((k) => k.network === "instagram");
  if (ig && ig.engagementTrend < -5) {
    alerts.push({ id: "a1", level: "warning", title: "Baisse d'engagement Instagram", detail: `${ig.engagementTrend}% vs période précédente — l'agent recommande un ajustement de la ligne éditoriale.` });
  }
  const r = rng(hashSeed(`${companyId}|alert`));
  if (r() > 0.5) alerts.push({ id: "a2", level: "info", title: "Budget SEA à 78% du plafond mensuel", detail: "Au rythme actuel, le plafond sera atteint le 26. L'agent peut lisser les enchères." });
  if (r() > 0.7) alerts.push({ id: "a3", level: "critical", title: "Pic de mentions concurrent détecté", detail: `Un concurrent du marché ${market} a lancé une campagne — opportunité de réponse rapide.` });
  return alerts;
}
