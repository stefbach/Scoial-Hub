// Langue des textes PRODUITS par l'IA.
//
// Les prompts de l'application demandaient « en français » en dur : le résultat
// arrivait donc en français même sur une interface en anglais. La langue de
// sortie doit suivre la langue choisie par l'utilisateur, partout.

export type UiLang = "fr" | "en";

/** Normalise une valeur reçue du client (body, query) en langue d'interface. */
export function normalizeLang(v: unknown): UiLang {
  return typeof v === "string" && v.toLowerCase().startsWith("en") ? "en" : "fr";
}

/** Nom de la langue tel qu'on l'écrit DANS le prompt (adressé au modèle). */
export function langName(lang: UiLang): string {
  return lang === "en" ? "ANGLAIS (English)" : "FRANÇAIS";
}

/**
 * Règle de langue à coller dans un prompt. Explicite « affiché tel quel » :
 * sans cette précision, le modèle traduit parfois les libellés mais garde les
 * phrases longues dans sa langue de raisonnement.
 */
export function langRule(lang: UiLang): string {
  const name = langName(lang);
  return `RÈGLE DE LANGUE ABSOLUE : rédige TOUS les textes de la réponse en ${name}. Ils sont affichés tels quels dans une interface en ${name} ; une seule phrase dans une autre langue est un défaut.`;
}

/** Choisit un texte selon la langue — pour les messages renvoyés par l'API. */
export function pick(lang: UiLang, fr: string, en: string): string {
  return lang === "en" ? en : fr;
}
