/**
 * Formes de données de la veille concurrentielle, partagées par la route
 * `/api/veille/latest`, le contenu simulé et l'écran Pilotage.
 */

export interface VeilleInsight {
  id: string;
  type: "format" | "angle" | "benchmark";
  label: string;
  detail: string;
  reseau?: string;
}

export interface VeilleReco {
  id: string;
  priorite: "haute" | "moyenne" | "basse";
  titre: string;
  detail: string;
  action: string;
}

export interface VeilleLatestResult {
  runId: string | null;
  companyId: string;
  finishedAt: string;
  simulated: boolean;
  resume: string;
  insights: VeilleInsight[];
  recommandations: VeilleReco[];
}

