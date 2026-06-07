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
  note?: string;
}

export const VOICE_MODELS: VoiceModel[] = [
  { id: "jaaari/kokoro-82m", label: "Kokoro 82M — rapide, multi-voix", textKey: "text", voiceKey: "voice", note: "Léger et rapide." },
  { id: "minimax/speech-02-hd", label: "MiniMax Speech 02 HD — multilingue", textKey: "text", voiceKey: "voice_id", note: "Très naturel, multilingue." },
  { id: "minimax/speech-02-turbo", label: "MiniMax Speech 02 Turbo — rapide", textKey: "text", voiceKey: "voice_id" },
];

export const AVATAR_MODELS: AvatarModel[] = [
  { id: "cjwbw/sadtalker", label: "SadTalker — photo → tête parlante", faceKey: "source_image", audioKey: "driven_audio", extra: { preprocess: "full" }, note: "Idéal à partir d'une simple photo." },
  { id: "devxpy/cog-wav2lip", label: "Wav2Lip — lip-sync rapide", faceKey: "face", audioKey: "audio", note: "Rapide ; accepte image ou vidéo." },
  { id: "sync/lipsync", label: "Sync Lipsync — HD", faceKey: "video", audioKey: "audio", note: "Meilleure qualité ; idéalement une vidéo source." },
];

export const DEFAULT_VOICE_MODEL = VOICE_MODELS[0].id;
export const DEFAULT_AVATAR_MODEL = AVATAR_MODELS[0].id;

export function getVoiceModel(id?: string): VoiceModel {
  return VOICE_MODELS.find((m) => m.id === id) ?? VOICE_MODELS[0];
}
export function getAvatarModel(id?: string): AvatarModel {
  return AVATAR_MODELS.find((m) => m.id === id) ?? AVATAR_MODELS[0];
}
