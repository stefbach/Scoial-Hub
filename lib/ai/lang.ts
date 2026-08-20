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

// ── Détection de la langue d'un texte PRODUIT ────────────────────────────────
//
// Savoir dans quelle langue un texte a été DEMANDÉ ne dit pas dans quelle
// langue il a été ÉCRIT. L'application marquait l'ADN de marque avec la langue
// demandée puis affichait « ce texte est dans une autre langue » sur la foi de
// cette étiquette : quand le modèle ne suivait pas la consigne, l'avertissement
// se déclenchait sur un texte pourtant correct (R25 #1). On mesure la langue
// réelle plutôt que de la supposer.

/** Mots outils très fréquents, quasi absents de l'autre langue. */
const FR_WORDS = /\b(le|la|les|des|une|nos|votre|vos|notre|avec|pour|sur|dans|est|sont|qui|que|nous|vous|plus|leur|aux|cette|ces|chez|afin|ainsi)\b/gi;
const EN_WORDS = /\b(the|and|with|for|our|your|their|this|these|that|are|is|who|which|you|we|from|about|into|through|its|has|have)\b/gi;

/**
 * Langue dominante d'un texte, ou `null` si le texte est trop court ou trop
 * ambigu pour trancher — auquel cas l'appelant ne doit RIEN affirmer.
 */
export function detectTextLang(text: string): UiLang | null {
  const sample = text.trim();
  if (sample.length < 40) return null;

  const fr = (sample.match(FR_WORDS) ?? []).length;
  const en = (sample.match(EN_WORDS) ?? []).length;
  // Les accents sont un signal fort du français, mais un nom propre accentué
  // dans un texte anglais ne doit pas suffire : ils pèsent, ils ne décident pas.
  const accents = (sample.match(/[éèêëàâçùûôîï]/gi) ?? []).length;
  const frScore = fr + Math.min(accents, fr + 3);

  if (frScore === 0 && en === 0) return null;
  // Écart net exigé : sous 60 % de dominance, on préfère ne pas conclure.
  const total = frScore + en;
  if (frScore / total >= 0.6) return "fr";
  if (en / total >= 0.6) return "en";
  return null;
}
