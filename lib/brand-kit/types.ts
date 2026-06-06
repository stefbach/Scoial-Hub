// Brand kit persistant : identité visuelle d'une marque réutilisée partout
// (Studio Affiches, Studio Vidéo, Composer). Module pur — utilisable client &
// serveur. Le logo et la charte sont stockés dans Supabase Storage (bucket
// public `sh-logos`), seules leurs URLs sont persistées en base.

export interface BrandKit {
  companyId: string;
  /** URL publique du logo (Supabase Storage) ou data URL en session. */
  logoUrl: string;
  /** URL publique de la charte graphique. */
  charteUrl: string;
  /** Palette de couleurs (hex). */
  palette: string[];
  /** Couleur de texte recommandée pour rester lisible sur la marque. */
  recommendedTextColor: string;
  /** Style visuel (ex. minimaliste, premium…). */
  style: string;
  /** Ton (ex. rassurant, expert…). */
  tone: string;
  /** Indications de style EN ANGLAIS à injecter dans les prompts d'image. */
  promptHints: string;
  /** Résumé FR de l'identité visuelle. */
  summary: string;
  /** Vrai si l'analyse provient de l'IA (vision). */
  aiGenerated: boolean;
  updatedAt: string | null;
}

export function makeEmptyBrandKit(companyId: string): BrandKit {
  return {
    companyId,
    logoUrl: "",
    charteUrl: "",
    palette: [],
    recommendedTextColor: "#ffffff",
    style: "",
    tone: "",
    promptHints: "",
    summary: "",
    aiGenerated: false,
    updatedAt: null,
  };
}
