/**
 * Types du framework d'agents multi-IA pour Social Hub.
 * Ces types sont utilisés par le roster, l'orchestrateur et l'UI de pilotage.
 */

// ── Identifiants des 7 agents ──────────────────────────────────────────
export type AgentId =
  | "orchestrator"
  | "strategist"
  | "copywriter"
  | "creative"
  | "media_buyer"
  | "analyst"
  | "compliance";

// ── Cadence éditoriale ─────────────────────────────────────────────────
/**
 * Définit le rythme de publication et la période de reporting.
 * Tous les champs sont optionnels ; les valeurs par défaut sont appliquées
 * par l'orchestrateur si le champ est absent.
 */
export interface Cadence {
  /** Nombre de publications par jour (défaut : 1) */
  postingPerDay?: number;
  /**
   * Jours de publication dans la semaine.
   * 0 = dimanche … 6 = samedi (convention JavaScript).
   * Défaut : [1, 2, 3, 4, 5] (lundi → vendredi)
   */
  postingDays?: number[];
  /**
   * Heures de publication préférées (format "HH:MM", ex. ["08:00","19:00"]).
   * Défaut : ["08:00", "19:00"]
   */
  postingHours?: string[];
  /**
   * Granularité de la période de reporting.
   * 'day' | 'week' | 'month' | 'quarter' | 'year'
   * Défaut : 'month'
   */
  reportingPeriod: "day" | "week" | "month" | "quarter" | "year";
}

// ── Niveau d'autonomie ─────────────────────────────────────────────────
// 1 = recommandation pure (aucune action exécutée, tout est proposé)
// 2 = semi-auto (actions simulées, validation humaine requise avant publication)
// 3 = auto sous garde-fous (exécution effective si compliance=pass et budget respecté)
export type AutonomyLevel = 1 | 2 | 3;

// ── Statut d'une étape d'exécution ────────────────────────────────────
export type AgentStepStatus = "done" | "running" | "blocked" | "simulated";

// ── Étape atomique produite par un agent ──────────────────────────────
export interface AgentStep {
  /** Agent responsable de l'étape */
  agent: AgentId;
  /** Titre lisible de l'étape (en français) */
  title: string;
  /** Statut à la fin de l'exécution */
  status: AgentStepStatus;
  /** Sortie principale de l'étape (texte, JSON stringifié, etc.) */
  output: string;
  /** Détail optionnel : raison d'un blocage, connecteur requis, etc. */
  detail?: string;
  /** Horodatage ISO de fin d'exécution */
  finishedAt?: string;
}

// ── Résultat complet d'une orchestration ──────────────────────────────
export interface AgentRunResult {
  /** Objectif soumis par l'utilisateur */
  objective: string;
  /** Séquence ordonnée des étapes exécutées */
  steps: AgentStep[];
  /**
   * Verdict de l'agent Compliance.
   * "pass"     → contenu conforme, peut être publié
   * "warn"     → avertissements, révision recommandée avant publication
   * "block"    → contenu non conforme, publication empêchée
   * undefined  → compliance non encore évaluée
   */
  complianceVerdict?: "pass" | "warn" | "block";
  /** Niveau d'autonomie utilisé lors de cette exécution */
  autonomy: AutonomyLevel;
  /**
   * Contenu final produit (post social, brief créatif, recommandation).
   * Absent si la compliance a bloqué la publication ou en mode recommandation pur.
   */
  finalOutput?: string;
  /** Mode mock : true si l'IA n'est pas configurée */
  mock?: boolean;

  // ── Champs enrichis (optionnels, rétro-compatibles) ──────────────
  /** Identifiant du profil professionnel utilisé */
  profileId?: string;
  /** Cadence éditoriale retenue pour ce run */
  cadence?: Cadence;
  /** Cible de benchmark libre saisie par l'utilisateur */
  benchmarkTarget?: string;
  /**
   * Analyse environnementale structurée produite par le Stratège.
   * Contient le marché, la concurrence, le champ sémantique et le positionnement.
   */
  environmentAnalysis?: EnvironmentAnalysis;
  /**
   * Benchmark sectoriel produit par l'Analyste.
   * Contient les KPIs cibles vs sectoriels et la projection de captation d'audience.
   */
  benchmark?: BenchmarkResult;
}

// ── Analyse d'environnement (sortie du Stratège) ─────────────────────
export interface EnvironmentAnalysis {
  /** Synthèse du marché et du contexte concurrentiel */
  marketOverview: string;
  /** Analyse des intentions de recherche et du champ sémantique */
  semanticAnalysis: string;
  /** Positionnement différenciant recommandé */
  positioning: string;
  /** Angles d'acquisition prioritaires */
  acquisitionAngles: string[];
  /** Plateformes recommandées avec justification */
  recommendedPlatforms: string[];
  /** Résumé des risques concurrentiels */
  competitiveRisks: string;
}

// ── Benchmark sectoriel (sortie de l'Analyste) ───────────────────────
export interface BenchmarkKPIRow {
  /** Nom du KPI */
  kpi: string;
  /** Valeur cible pour cette campagne */
  targetValue: string;
  /** Valeur de référence sectorielle */
  sectorReference: string;
  /** Évaluation : au-dessus / dans la norme / en dessous */
  assessment: "above" | "inline" | "below";
}

export interface BenchmarkResult {
  /** Cible benchmark analysée */
  benchmarkTarget: string;
  /** Lignes du tableau de KPIs */
  kpiRows: BenchmarkKPIRow[];
  /** Projection de captation d'audience (portée estimée en % de la cible) */
  audienceCaptureProjection: {
    targetAudienceSize: number;
    estimatedReach: number;
    captureRate: number;
    timeframe: string;
  };
  /** Recommandations d'optimisation prioritaires */
  optimizationRecommendations: string[];
  /** Résumé narratif du benchmark */
  summary: string;
}

// ── Définition statique d'un agent (roster) ───────────────────────────
export interface AgentDef {
  id: AgentId;
  /** Nom affiché en français */
  name: string;
  /** Rôle en une ligne */
  role: string;
  /**
   * Classe de couleur Tailwind pour l'accent visuel.
   * Doit correspondre à un token défini dans tailwind.config.ts.
   */
  accentColor: string;
  /** Classe de fond pour les badges / chips */
  accentBg: string;
  /** Niveau d'autonomie par défaut */
  defaultAutonomy: AutonomyLevel;
  /** Liste des connecteurs/outils requis (pour signaler ce qui est simulé) */
  requiredConnectors: string[];
}
