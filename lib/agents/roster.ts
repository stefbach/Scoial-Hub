/**
 * Roster des 8 agents du système Social Hub.
 * Chaque agent a un rôle précis dans la chaîne de valeur "campagne sociale médicale".
 */

import type { AgentDef } from "./types";

export const AGENTS: AgentDef[] = [
  {
    id: "orchestrator",
    name: "Orchestrateur",
    nameEn: "Orchestrator",
    role: "Coordonne l'ensemble des agents et séquence les étapes d'exécution.",
    roleEn: "Coordinates all agents and sequences the execution steps.",
    accentColor: "text-primary-700",
    accentBg: "bg-primary-50 border-primary-200",
    defaultAutonomy: 2,
    requiredConnectors: [],
  },
  {
    id: "strategist",
    name: "Stratège",
    nameEn: "Strategist",
    role: "Définit l'objectif de campagne, le ciblage et le calendrier éditorial.",
    roleEn: "Defines the campaign goal, targeting and editorial calendar.",
    accentColor: "text-primary-600",
    accentBg: "bg-primary-50 border-primary-200",
    defaultAutonomy: 1,
    requiredConnectors: ["Meta Insights API", "Analytics interne"],
  },
  {
    id: "copywriter",
    name: "Rédacteur IA",
    nameEn: "AI Copywriter",
    role: "Génère les textes de posts et d'annonces en respectant la brand voice.",
    roleEn: "Generates post and ad copy that respects the brand voice.",
    accentColor: "text-ai-text",
    accentBg: "bg-ai-textbg border-blue-200",
    defaultAutonomy: 2,
    requiredConnectors: ["Anthropic Claude API"],
  },
  {
    id: "creative",
    name: "Créatif Visuel",
    nameEn: "Visual Creative",
    role: "Produit les visuels et vidéos adaptés à chaque format de plateforme.",
    roleEn: "Produces visuals and videos tailored to each platform format.",
    accentColor: "text-ai-visual",
    accentBg: "bg-ai-visualbg border-violet-200",
    defaultAutonomy: 1,
    requiredConnectors: ["Replicate · Flux 1.1 Pro (images)", "Replicate · MiniMax Video-01 (vidéo)"],
  },
  {
    id: "media_buyer",
    name: "Media Buyer",
    nameEn: "Media Buyer",
    role: "Configure et optimise les campagnes payantes sur Meta Ads.",
    roleEn: "Sets up and optimizes paid campaigns on Meta Ads.",
    accentColor: "text-warning-700",
    accentBg: "bg-warning-50 border-warning-200",
    defaultAutonomy: 1,
    requiredConnectors: ["Meta Ads API", "Meta Business Manager"],
  },
  {
    id: "analyst",
    name: "Analyste",
    nameEn: "Analyst",
    role: "Mesure les performances et formule des recommandations d'optimisation.",
    roleEn: "Measures performance and formulates optimization recommendations.",
    accentColor: "text-success-700",
    accentBg: "bg-success-50 border-success-200",
    defaultAutonomy: 2,
    requiredConnectors: ["Meta Insights API", "Supabase Analytics"],
  },
  {
    id: "compliance",
    name: "Conformité",
    nameEn: "Compliance",
    role: "Vérifie la conformité réglementaire santé (ANSM, politiques Meta) — BLOQUANT.",
    roleEn: "Checks health regulatory compliance (ANSM, Meta policies) — BLOCKING.",
    accentColor: "text-danger-700",
    accentBg: "bg-danger-50 border-danger-200",
    defaultAutonomy: 3, // Toujours actif, quel que soit le niveau d'autonomie global
    requiredConnectors: ["Anthropic Claude API"],
  },
  {
    id: "publisher",
    name: "Publisher",
    nameEn: "Publisher",
    role: "Programme et publie le contenu validé sur les réseaux sociaux.",
    roleEn: "Schedules and publishes approved content on social networks.",
    accentColor: "text-indigo-700",
    accentBg: "bg-indigo-50 border-indigo-200",
    defaultAutonomy: 2,
    requiredConnectors: ["Meta Business API", "LinkedIn API"],
  },
];

/** Retrouve la définition d'un agent par son identifiant. */
export function getAgentDef(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}
