/**
 * Registre des langues de PUBLICATION.
 *
 * À distinguer de la langue de l'INTERFACE (`lib/i18n`, FR/EN uniquement) : ici
 * l'utilisateur choisit la langue DANS LAQUELLE le contenu est rédigé/publié,
 * indépendamment de la langue de l'app. Une seule source de vérité, partagée
 * entre le client (sélecteur) et le serveur (routes IA qui résolvent le nom de
 * langue à injecter dans le prompt).
 */

export interface PublishLanguage {
  /** Code court stable (ISO 639-1) — valeur transmise aux API. */
  code: string;
  /** Libellé affiché en interface française. */
  fr: string;
  /** Libellé affiché en interface anglaise. */
  en: string;
  /** Nom anglais injecté dans les prompts IA ("French", "Spanish"…). */
  name: string;
}

/** Langues proposées à la publication (couvre les principaux marchés). */
export const PUBLISH_LANGUAGES: PublishLanguage[] = [
  { code: "fr", fr: "Français", en: "French", name: "French" },
  { code: "en", fr: "Anglais", en: "English", name: "English" },
  { code: "es", fr: "Espagnol", en: "Spanish", name: "Spanish" },
  { code: "de", fr: "Allemand", en: "German", name: "German" },
  { code: "it", fr: "Italien", en: "Italian", name: "Italian" },
  { code: "pt", fr: "Portugais", en: "Portuguese", name: "Portuguese" },
  { code: "nl", fr: "Néerlandais", en: "Dutch", name: "Dutch" },
  { code: "ar", fr: "Arabe", en: "Arabic", name: "Arabic" },
  { code: "zh", fr: "Chinois", en: "Chinese", name: "Chinese (Simplified)" },
  { code: "ja", fr: "Japonais", en: "Japanese", name: "Japanese" },
  { code: "ko", fr: "Coréen", en: "Korean", name: "Korean" },
  { code: "ru", fr: "Russe", en: "Russian", name: "Russian" },
  { code: "hi", fr: "Hindi", en: "Hindi", name: "Hindi" },
  { code: "tr", fr: "Turc", en: "Turkish", name: "Turkish" },
  { code: "pl", fr: "Polonais", en: "Polish", name: "Polish" },
];

const BY_CODE = new Map(PUBLISH_LANGUAGES.map((l) => [l.code, l]));

/**
 * Résout un code (ou un nom déjà anglais) en NOM anglais utilisable dans un
 * prompt. Passe-plat pour une valeur inconnue (langue libre saisie ailleurs),
 * afin de ne jamais perdre l'intention de l'utilisateur. Défaut : français.
 */
export function resolvePublishLanguageName(codeOrName?: string): string {
  if (!codeOrName) return "French";
  const key = codeOrName.trim().toLowerCase();
  const found = BY_CODE.get(key);
  if (found) return found.name;
  return codeOrName.trim();
}

/** Vrai si la langue demandée est le français (utile aux fallbacks « démo »). */
export function isFrenchLanguage(codeOrName?: string): boolean {
  if (!codeOrName) return true;
  const key = codeOrName.trim().toLowerCase();
  return key === "fr" || key === "french" || key === "français" || key === "francais";
}

/** Vrai si le code correspond à une langue connue du registre. */
export function isKnownLanguageCode(code?: string): boolean {
  return Boolean(code && BY_CODE.has(code.trim().toLowerCase()));
}
