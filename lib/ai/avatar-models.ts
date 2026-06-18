// Catalogues de modèles pour le Studio Avatar : voix (TTS) et avatar (lip-sync).
// Chaque entrée mappe les clés d'entrée attendues par le modèle Replicate, ce
// qui permet d'en proposer plusieurs au choix de l'utilisateur.

export interface VoiceModel {
  id: string;
  label: string;
  /** clé du texte à dire dans l'input Replicate. */
  textKey: string;
  /** clé optionnelle de la voix/locuteur. */
  voiceKey?: string;
  /** entrées additionnelles fixes. */
  extra?: Record<string, unknown>;
  note?: string;
}

export interface AvatarModel {
  id: string;
  label: string;
  /** clé de l'image/vidéo du visage. */
  faceKey: string;
  /** clé de l'audio. */
  audioKey: string;
  /** entrées additionnelles fixes. */
  extra?: Record<string, unknown>;
  /** true = exige une VIDÉO source (doublage) ; échoue avec une simple photo. */
  needsVideo?: boolean;
  note?: string;
}

export const VOICE_MODELS: VoiceModel[] = [
  { id: "jaaari/kokoro-82m", label: "Kokoro 82M — rapide, multi-voix", textKey: "text", voiceKey: "voice", note: "Léger et rapide." },
  { id: "minimax/speech-02-hd", label: "MiniMax Speech 02 HD — multilingue", textKey: "text", voiceKey: "voice_id", note: "Très naturel, multilingue." },
  { id: "minimax/speech-02-turbo", label: "MiniMax Speech 02 Turbo — rapide", textKey: "text", voiceKey: "voice_id" },
];

// Modèles haut de gamme de la collection Replicate « lipsync » (clés d'entrée
// auto-détectées côté serveur, donc faceKey/audioKey ne sont qu'indicatifs).
export const AVATAR_MODELS: AvatarModel[] = [
  { id: "bytedance/omni-human", label: "OmniHuman (ByteDance) — qualité studio · photo", faceKey: "image", audioKey: "audio", note: "Photo + voix → vidéo professionnelle. Recommandé." },
  { id: "veed/fabric-1.0", label: "VEED Fabric 1.0 — photo → vidéo parlante", faceKey: "image", audioKey: "audio", note: "Transforme une image en avatar parlant." },
  { id: "sync/lipsync-2-pro", label: "Sync Lipsync 2 Pro — studio (vidéo source requise)", faceKey: "video", audioKey: "audio", needsVideo: true, note: "Top qualité ; nécessite une vidéo source." },
  { id: "heygen/lipsync-precision", label: "HeyGen Lipsync Precision — doublage vidéo", faceKey: "video", audioKey: "audio", needsVideo: true, note: "Haute précision ; nécessite une vidéo source." },
  { id: "cjwbw/sadtalker", label: "SadTalker — basique (photo, rapide)", faceKey: "source_image", audioKey: "driven_audio", extra: { preprocess: "full" }, note: "Repli léger." },
];

export const DEFAULT_VOICE_MODEL = VOICE_MODELS[0].id;
export const DEFAULT_AVATAR_MODEL = AVATAR_MODELS[0].id;

// ── Voix qualitative : Langue × Genre (via MiniMax Speech-02-HD, multilingue) ──
export interface AvatarLang {
  code: string;     // code court (script + UI)
  label: string;    // libellé affiché
  claude: string;   // nom de langue pour le prompt Claude
  xtts: string;     // code langue XTTS-v2 (multilingue)
  boost?: string;   // language_boost MiniMax (FR/EN seulement)
  native?: boolean; // true = voix preset MiniMax dispo (FR/EN)
}

// FR/EN via MiniMax (voix preset). Les autres via XTTS-v2 (nécessite un
// échantillon de voix = voix clonée) pour une vraie prononciation native.
export const AVATAR_LANGS: AvatarLang[] = [
  { code: "fr", label: "Français", claude: "français", xtts: "fr", boost: "French", native: true },
  { code: "en", label: "English", claude: "anglais", xtts: "en", boost: "English", native: true },
  // Créole mauricien : script rédigé en kreol morisien ; prononciation via la
  // voix française (base lexicale francophone) — utile notamment pour Tibok.
  { code: "mfe", label: "Kreol morisien", claude: "créole mauricien (kreol morisien)", xtts: "fr", boost: "French" },
  { code: "es", label: "Español", claude: "espagnol", xtts: "es" },
  { code: "de", label: "Deutsch", claude: "allemand", xtts: "de" },
  { code: "it", label: "Italiano", claude: "italien", xtts: "it" },
  { code: "pt", label: "Português", claude: "portugais", xtts: "pt" },
  { code: "nl", label: "Nederlands", claude: "néerlandais", xtts: "nl" },
  { code: "pl", label: "Polski", claude: "polonais", xtts: "pl" },
  { code: "ru", label: "Русский", claude: "russe", xtts: "ru" },
  { code: "ar", label: "العربية", claude: "arabe", xtts: "ar" },
  { code: "tr", label: "Türkçe", claude: "turc", xtts: "tr" },
  { code: "zh-cn", label: "中文", claude: "chinois", xtts: "zh-cn" },
  { code: "ja", label: "日本語", claude: "japonais", xtts: "ja" },
  { code: "ko", label: "한국어", claude: "coréen", xtts: "ko" },
  { code: "hi", label: "हिन्दी", claude: "hindi", xtts: "hi" },
];

/** Modèle XTTS-v2 (multilingue + clonage à partir d'un échantillon). */
export const XTTS_MODEL = "lucataco/xtts-v2";

/** Modèle TTS multilingue de référence + voix par genre. */
export const TTS_MULTILINGUAL_MODEL = "minimax/speech-02-hd";
export const VOICE_BY_GENDER: Record<"female" | "male", string> = {
  female: "Wise_Woman",
  male: "Deep_Voice_Man",
};

/** Catalogue de voix (MiniMax) — écoutables avant choix, toutes multilingues. */
export interface AvatarVoice {
  id: string;       // voice_id MiniMax
  fr: string;       // libellé FR
  en: string;       // libellé EN
  g: "female" | "male" | "neutral";
}
export const VOICES: AvatarVoice[] = [
  { id: "Wise_Woman", fr: "Posée — femme", en: "Composed — woman", g: "female" },
  { id: "Calm_Woman", fr: "Douce — femme", en: "Gentle — woman", g: "female" },
  { id: "Lovely_Girl", fr: "Chaleureuse — femme", en: "Warm — woman", g: "female" },
  { id: "Exuberant_Girl", fr: "Dynamique — femme", en: "Energetic — woman", g: "female" },
  { id: "Inspirational_girl", fr: "Inspirante — femme", en: "Inspiring — woman", g: "female" },
  { id: "Deep_Voice_Man", fr: "Grave — homme", en: "Deep — man", g: "male" },
  { id: "Elegant_Man", fr: "Posée — homme", en: "Composed — man", g: "male" },
  { id: "Casual_Guy", fr: "Décontractée — homme", en: "Casual — man", g: "male" },
  { id: "Determined_Man", fr: "Assurée — homme", en: "Confident — man", g: "male" },
  { id: "Friendly_Person", fr: "Amicale — neutre", en: "Friendly — neutral", g: "neutral" },
];
export const DEFAULT_VOICE_ID = "Wise_Woman";
export function getVoice(id?: string): AvatarVoice {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}

export function getLang(code?: string): AvatarLang {
  return AVATAR_LANGS.find((l) => l.code === code) ?? AVATAR_LANGS[0];
}

export function getVoiceModel(id?: string): VoiceModel {
  return VOICE_MODELS.find((m) => m.id === id) ?? VOICE_MODELS[0];
}
export function getAvatarModel(id?: string): AvatarModel {
  return AVATAR_MODELS.find((m) => m.id === id) ?? AVATAR_MODELS[0];
}
