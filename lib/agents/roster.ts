/**
 * Roster des 7 agents du système Social Hub.
 * Chaque agent a un rôle précis dans la chaîne de valeur "campagne sociale médicale".
 */

import type { AgentDef } from "./types";

export const AGENTS: AgentDef[] = [
  {
    id: "orchestrator",
    name: "Orchestrateur",
    role: "Coordonne l'ensemble des agents et séquence les étapes d'exécution.",
    accentColor: "text-primary-700",
    accentBg: "bg-primary-50 border-primary-200",
    defaultAutonomy: 2,
    requiredConnectors: [],
  },
  {
    id: "strategist",
    name: "Stratège",
    role: "Définit l'objectif de campagne, le ciblage et le calendrier éditorial.",
    accentColor: "text-primary-600",
    accentBg: "bg-primary-50 border-primary-200",
    defaultAutonomy: 1,
    requiredConnectors: ["Meta Insights API", "Analytics interne"],
  },
  {
    id: "copywriter",
    name: "Rédacteur IA",
    role: "Génère les textes de posts et d'annonces en respectant la brand voice.",
    accentColor: "text-ai-text",
    accentBg: "bg-ai-textbg border-blue-200",
    defaultAutonomy: 2,
    requiredConnectors: ["Anthropic Claude API"],
  },
  {
    id: "creative",
    name: "Créatif Visuel",
    role: "Produit les visuels et vidéos adaptés à chaque format de plateforme.",
    accentColor: "text-ai-visual",
    accentBg: "bg-ai-visualbg border-violet-200",
    defaultAutonomy: 1,
    requiredConnectors: ["Replicate · Flux 1.1 Pro (images)", "Replicate · MiniMax Video-01 (vidéo)"],
  },
  {
    id: "media_buyer",
    name: "Media Buyer",
    role: "Configure et optimise les campagnes payantes sur Meta Ads.",
    accentColor: "text-warning-700",
    accentBg: "bg-warning-50 border-warning-200",
    defaultAutonomy: 1,
    requiredConnectors: ["Meta Ads API", "Meta Business Manager"],
  },
  {
    id: "analyst",
    name: "Analyste",
    role: "Mesure les performances et formule des recommandations d'optimisation.",
    accentColor: "text-success-700",
    accentBg: "bg-success-50 border-success-200",
    defaultAutonomy: 2,
    requiredConnectors: ["Meta Insights API", "Supabase Analytics"],
  },
  {
    id: "compliance",
    name: "Conformité",
    role: "Vérifie la conformité réglementaire santé (ANSM, politiques Meta) — BLOQUANT.",
    accentColor: "text-danger-700",
    accentBg: "bg-danger-50 border-danger-200",
    defaultAutonomy: 3, // Toujours actif, quel que soit le niveau d'autonomie global
    requiredConnectors: ["Anthropic Claude API"],
  },
  {
    id: "publisher",
    name: "Publisher",
    role: "Programme et publie le contenu validé sur les réseaux sociaux.",
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
