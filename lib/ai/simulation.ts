// Types partagés du module « Prédiction & Simulation de campagne ».
// Un moteur de simulation léger, piloté par Claude : à partir d'un produit, d'une
// cible et d'un message (enrichis des tendances issues de la Veille), on génère
// des personas représentatifs, on simule leurs réactions, puis on agrège une
// PRÉDICTION de réception + des recommandations actionnables.
//
// ⚠️ Cadrage honnête : il s'agit d'une SIMULATION PROSPECTIVE (directionnelle),
// jamais d'une garantie statistique. L'UI doit le présenter comme tel.

/** Réaction simulée d'un persona représentatif de l'audience cible. */
export interface SimPersona {
  /** Nom d'archétype court (ex. « Mère active, 35 ans »). */
  name: string;
  /** Profil en une ligne (démographie + psychographie). */
  profile: string;
  /** Tonalité de la réaction. */
  sentiment: "positif" | "neutre" | "négatif";
  /** Réaction « à la première personne » (verbatim plausible). */
  reaction: string;
  /** Probabilité d'adhésion estimée (0–100). */
  adoption: number;
  /** Principale objection / frein, si pertinent. */
  objection?: string;
}

/** Résultat complet d'une simulation de campagne. */
export interface SimulationResult {
  /** Score global de réception prédit (0–100). */
  score: number;
  /** Verdict court (une phrase d'accroche). */
  verdict: string;
  /** Synthèse en un paragraphe. */
  summary: string;
  /** Personas simulés. */
  personas: SimPersona[];
  /** Angles / messages qui résonnent le plus. */
  winningAngles: string[];
  /** Objections et risques principaux. */
  objections: string[];
  /** Recommandations concrètes pour améliorer la réception. */
  recommendations: string[];
  /** Alignement avec les tendances fournies (et risque de saturation). */
  trendAlignment: string;
}

/** Entrée d'une simulation (envoyée par le client). */
export interface SimulationInput {
  /** Produit / offre à mettre en avant. */
  product: string;
  /** Audience cible visée. */
  audience: string;
  /** Message / angle de campagne envisagé. */
  message?: string;
  /** Marché / zone géographique. */
  market?: string;
  /** Tendances actuelles (texte libre, idéalement nourri par la Veille). */
  trends?: string;
}
