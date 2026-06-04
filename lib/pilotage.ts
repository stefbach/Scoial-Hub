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
  // Données vidées : démarrage propre (aucune statistique fictive).
  void companyId; void market; void days;
  return NETWORKS.map((network) => ({
    network,
    followers: 0,
    followersTrend: 0,
    engagementRate: 0,
    engagementTrend: 0,
    likes: 0,
    comments: 0,
    views: 0,
    reach: 0,
  }));
}

export function aggregateKpis(kpis: NetworkKpis[]) {
  const n = kpis.length || 1;
  const sum = (f: (k: NetworkKpis) => number) => kpis.reduce((a, k) => a + f(k), 0);
  const followers = sum((k) => k.followers);
  const likes = sum((k) => k.likes);
  const comments = sum((k) => k.comments);
  const views = sum((k) => k.views);
  const reach = sum((k) => k.reach);
  const engagementRate = Number((kpis.reduce((a, k) => a + k.engagementRate, 0) / n).toFixed(2));
  return { followers, likes, comments, views, reach, engagementRate };
}

export function computeBenchmark(companyId: string, market: string, kpis: NetworkKpis[]): BenchmarkRow[] {
  void companyId; void market; void kpis;
  return [];
}

export function generateDecisions(companyId: string, market: string): Decision[] {
  void companyId; void market;
  return [];
}

export function generateAlerts(companyId: string, market: string, kpis: NetworkKpis[]): PilotAlert[] {
  void companyId; void market; void kpis;
  return [];
}
