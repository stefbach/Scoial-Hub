// Niveaux d'autonomie des agents — une seule définition pour toute l'app.
// Le lanceur d'agent et le centre de pilotage décrivaient (ou non) ces niveaux
// chacun de leur côté ; la description doit être la même partout.

export type AutonomyLevel = 1 | 2 | 3;

export interface AutonomyCopy {
  /** Étiquette courte affichée sur le bouton (« Reco », « Semi », « Auto »). */
  shortFr: string;
  shortEn: string;
  /** Description brève du niveau, affichée sous les boutons. */
  fr: string;
  en: string;
}

export const AUTONOMY_LEVELS: Record<AutonomyLevel, AutonomyCopy> = {
  1: {
    shortFr: "Reco",
    shortEn: "Reco",
    fr: "Recommandation — les agents proposent, vous décidez de tout. Rien n'est publié.",
    en: "Recommendation — the agents suggest, you decide everything. Nothing is published.",
  },
  2: {
    shortFr: "Semi",
    shortEn: "Semi",
    fr: "Semi-auto — les agents préparent tout (posts, pub) et attendent votre validation avant publication.",
    en: "Semi-auto — the agents prepare everything (posts, ad) and wait for your approval before publishing.",
  },
  3: {
    shortFr: "Auto",
    shortEn: "Auto",
    fr: "Auto — les agents exécutent automatiquement ce qui est conforme à vos règles ; le reste passe en validation.",
    en: "Auto — the agents automatically run what complies with your rules; the rest goes to review.",
  },
};
