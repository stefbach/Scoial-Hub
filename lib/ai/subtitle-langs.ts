// Langues proposées pour FORCER la transcription du banc de montage — sinon
// détection automatique par Whisper. Module pur (aucun accès réseau ni
// secret), donc sûr à importer côté client (le sélecteur de langue) comme
// côté serveur (validation de la requête).
//
// Codes ISO 639-1 tels qu'attendus par Whisper — distincts de ceux du Studio
// Avatar (AVATAR_LANGS dans lib/ai/avatar-models.ts), qui incluent des
// variantes (« zh-cn », un créole) propres au TTS/lip-sync, pas à Whisper.

export interface SubtitleLang {
  code: string;
  fr: string;
  en: string;
}

export const SUBTITLE_LANGS: SubtitleLang[] = [
  { code: "fr", fr: "Français", en: "French" },
  { code: "en", fr: "Anglais", en: "English" },
  { code: "es", fr: "Espagnol", en: "Spanish" },
  { code: "de", fr: "Allemand", en: "German" },
  { code: "it", fr: "Italien", en: "Italian" },
  { code: "pt", fr: "Portugais", en: "Portuguese" },
  { code: "nl", fr: "Néerlandais", en: "Dutch" },
  { code: "pl", fr: "Polonais", en: "Polish" },
  { code: "ru", fr: "Russe", en: "Russian" },
  { code: "ar", fr: "Arabe", en: "Arabic" },
  { code: "tr", fr: "Turc", en: "Turkish" },
  { code: "zh", fr: "Chinois", en: "Chinese" },
  { code: "ja", fr: "Japonais", en: "Japanese" },
  { code: "ko", fr: "Coréen", en: "Korean" },
  { code: "hi", fr: "Hindi", en: "Hindi" },
];

/** Ensemble des codes valides — sert à valider une requête côté serveur. */
export const SUBTITLE_LANG_CODES = new Set(SUBTITLE_LANGS.map((l) => l.code));
