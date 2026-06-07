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

// Modèles haut de gamme de la collection Replicate « lipsync » (clés d'entrée
// auto-détectées côté serveur, donc faceKey/audioKey ne sont qu'indicatifs).
export const AVATAR_MODELS: AvatarModel[] = [
  { id: "bytedance/omni-human", label: "OmniHuman (ByteDance) — qualité studio · photo", faceKey: "image", audioKey: "audio", note: "Photo + voix → vidéo professionnelle. Recommandé." },
  { id: "veed/fabric-1.0", label: "VEED Fabric 1.0 — photo → vidéo parlante", faceKey: "image", audioKey: "audio", note: "Transforme une image en avatar parlant." },
  { id: "sync/lipsync-2-pro", label: "Sync Lipsync 2 Pro — studio (idéal vidéo source)", faceKey: "video", audioKey: "audio", note: "Top qualité ; idéalement une vidéo source." },
  { id: "heygen/lipsync-precision", label: "HeyGen Lipsync Precision — doublage vidéo", faceKey: "video", audioKey: "audio", note: "Haute précision ; source vidéo recommandée." },
  { id: "cjwbw/sadtalker", label: "SadTalker — basique (photo, rapide)", faceKey: "source_image", audioKey: "driven_audio", extra: { preprocess: "full" }, note: "Repli léger." },
];

export const DEFAULT_VOICE_MODEL = VOICE_MODELS[0].id;
export const DEFAULT_AVATAR_MODEL = AVATAR_MODELS[0].id;

export function getVoiceModel(id?: string): VoiceModel {
  return VOICE_MODELS.find((m) => m.id === id) ?? VOICE_MODELS[0];
}
export function getAvatarModel(id?: string): AvatarModel {
  return AVATAR_MODELS.find((m) => m.id === id) ?? AVATAR_MODELS[0];
}
