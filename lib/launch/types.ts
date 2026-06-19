// Types partagés du Copilote de lancement (client + serveur, sans dépendance serveur).
//
// Flux : chat (construction du brief, nourri par le RAG) → simulation → stratégie
// applicable directement dans les campagnes organiques ET publicitaires.

import type { Platform } from "@/lib/types";

/** Brief de lancement, enrichi progressivement par le Copilote au fil du dialogue. */
export interface LaunchBrief {
  product: string;
  audience: string;
  message?: string;
  market?: string;
  trends?: string;
  /** Objectif marketing (notoriété, acquisition, conversion, rétention…). */
  objective?: string;
  /** Budget indicatif (texte libre : « 2000€/mois », « modeste »…). */
  budget?: string;
  /** Horizon de lancement (« dans 3 semaines », « T3 »…). */
  timeline?: string;
  /** Canaux visés. */
  channels?: Platform[];
  /** Indicateurs de succès attendus. */
  kpis?: string[];
  /** Différenciateurs / preuves. */
  differentiators?: string[];
}

/** Une réponse du Copilote conversationnel. */
export interface CopilotTurn {
  /** Message conversationnel à afficher. */
  reply: string;
  /** Brief CUMULÉ et mis à jour (jamais régressif). */
  brief: LaunchBrief;
  /** Éléments encore manquants pour une simulation fiable. */
  missing: string[];
  /** Questions de relance posées au client. */
  questions?: string[];
  /** True quand le brief est assez complet pour lancer la simulation. */
  ready: boolean;
}

/** Plan d'action pour UN canal (organique ou publicitaire). */
export interface ChannelPlay {
  channel: Platform;
  objective: string;
  audience: string;
  angles: string[];
  formats: string[];
  /** Accroches / exemples de contenu prêts à l'emploi. */
  hooks: string[];
  /** Cadence de publication (organique). */
  postingCadence?: string;
  /** Part de budget recommandée (publicitaire, ex. « 30 % »). */
  budgetShare?: string;
  /** KPI principal du canal. */
  kpi?: string;
}

/** Stratégie de lancement complète, exploitable dans l'app. */
export interface LaunchStrategy {
  summary: string;
  positioning: string;
  organic: ChannelPlay[];
  paid: ChannelPlay[];
  calendar: { phase: string; focus: string; actions: string[] }[];
  kpis: string[];
  risks: string[];
  aiGenerated: boolean;
}

/** Résultat d'application de la stratégie (brouillons en pause). */
export interface ApplyResult {
  campaignsCreated: number;
  adSetsCreated: number;
  postsCreated: number;
  campaignId?: string;
}

/** Statut des données récupérées (RAG) affiché dans l'UI. */
export interface LaunchContextStatus {
  brandIdentity: boolean;
  veille: boolean;
  ads: boolean;
  campaigns: number;
  memorySignals: number;
}
