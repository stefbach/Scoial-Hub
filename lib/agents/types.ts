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
