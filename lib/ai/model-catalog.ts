/**
 * Catalogue des modèles de génération (image & vidéo) disponibles via Replicate.
 * Sélection des meilleurs modèles des collections text-to-image / text-to-video.
 *
 * Chaque entrée fournit un `buildInput` qui construit le payload adapté au
 * schéma du modèle (les paramètres diffèrent d'un modèle à l'autre). Module pur
 * (aucun import serveur) : utilisable côté client (libellés) et serveur (inputs).
 */

export interface GenModel {
  id: string;
  label: string;
  note?: string;
  buildInput: (prompt: string, opts: { aspect?: string; seconds?: number; imageUrl?: string; voice?: string }) => Record<string, unknown>;
}

/* ── Helpers ratio ─────────────────────────────────────────────────────────── */

function imgRatio(fmt?: string): string {
  const map: Record<string, string> = {
    square: "1:1", portrait: "4:5", landscape: "16:9", story: "9:16",
    "1:1": "1:1", "4:5": "4:5", "16:9": "16:9", "9:16": "9:16", "1.91:1": "16:9",
  };
  return map[fmt ?? "square"] ?? "1:1";
}
// Imagen ne supporte pas 4:5 → on rabat sur 3:4.
function imagenRatio(fmt?: string): string {
  const r = imgRatio(fmt);
  return r === "4:5" ? "3:4" : r;
}
function sizeFromRatio(fmt?: string): string {
  switch (imgRatio(fmt)) {
    case "9:16": return "1024x1820";
    case "16:9": return "1820x1024";
    case "4:5": return "1024x1280";
    default: return "1024x1024";
  }
}
function vidRatio(fmt?: string): string {
  const map: Record<string, string> = {
    square: "1:1", portrait: "9:16", story: "9:16", landscape: "16:9",
    "1:1": "1:1", "9:16": "9:16", "16:9": "16:9", "4:5": "9:16",
  };
  return map[fmt ?? "9:16"] ?? "9:16";
}

/* ── Images ────────────────────────────────────────────────────────────────── */

export const IMAGE_MODELS: GenModel[] = [
  {
    id: "google/nano-banana",
    label: "Nano Banana (Gemini)",
    note: "Google — top qualité & cohérence",
    buildInput: (p) => ({ prompt: p, output_format: "png" }),
  },
  {
    id: "black-forest-labs/flux-1.1-pro",
    label: "Flux 1.1 Pro",
    note: "Photoréaliste, polyvalent",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imgRatio(o.aspect), output_format: "webp", output_quality: 90, safety_tolerance: 5 }),
  },
  {
    id: "black-forest-labs/flux-1.1-pro-ultra",
    label: "Flux 1.1 Pro Ultra",
    note: "Ultra-net (jusqu'à 4 MP)",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imgRatio(o.aspect), output_format: "webp", safety_tolerance: 5 }),
  },
  {
    id: "black-forest-labs/flux-schnell",
    label: "Flux Schnell",
    note: "Rapide & économique",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imgRatio(o.aspect), output_format: "webp", num_outputs: 1 }),
  },
  {
    id: "google/imagen-4",
    label: "Google Imagen 4",
    note: "Très haute qualité",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imagenRatio(o.aspect) }),
  },
  {
    id: "google/imagen-4-ultra",
    label: "Imagen 4 Ultra",
    note: "Qualité max Google",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imagenRatio(o.aspect) }),
  },
  {
    id: "ideogram-ai/ideogram-v3-quality",
    label: "Ideogram v3",
    note: "Excellent pour texte/affiches",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imgRatio(o.aspect) }),
  },
  {
    id: "recraft-ai/recraft-v3",
    label: "Recraft v3",
    note: "Design & illustration",
    buildInput: (p, o) => ({ prompt: p, size: sizeFromRatio(o.aspect) }),
  },
  {
    id: "stability-ai/stable-diffusion-3.5-large",
    label: "Stable Diffusion 3.5",
    note: "Open, polyvalent",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imgRatio(o.aspect), output_format: "webp" }),
  },
  {
    id: "bytedance/seedream-3",
    label: "Seedream 3",
    note: "Rendu riche et net",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imgRatio(o.aspect) }),
  },
  {
    id: "qwen/qwen-image",
    label: "Qwen-Image",
    note: "Texte net dans l'image",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imgRatio(o.aspect) }),
  },
  {
    id: "luma/photon",
    label: "Luma Photon",
    note: "Photoréalisme cinématique",
    buildInput: (p, o) => ({ prompt: p, aspect_ratio: imgRatio(o.aspect) }),
  },
];

/* ── Édition d'image (image + prompt → image) ─────────────────────────────── */
// Modèles « instruct » : on fournit une image source ET une consigne d'édition.
// L'appelant passe l'URL source ; buildInput place la clé image attendue.
export const EDIT_MODELS: GenModel[] = [
  {
    id: "black-forest-labs/flux-kontext-pro",
    label: "Flux Kontext Pro",
    note: "Édition guidée (garde le sujet)",
    // Flux Kontext n'accepte que jpg|png pour output_format (webp → 422).
    buildInput: (p, o) => ({ prompt: p, input_image: o.imageUrl, aspect_ratio: imgRatio(o.aspect), output_format: "png" }),
  },
  {
    id: "black-forest-labs/flux-kontext-max",
    label: "Flux Kontext Max",
    note: "Édition qualité max",
    // Flux Kontext n'accepte que jpg|png pour output_format (webp → 422).
    buildInput: (p, o) => ({ prompt: p, input_image: o.imageUrl, aspect_ratio: imgRatio(o.aspect), output_format: "png" }),
  },
  {
    id: "qwen/qwen-image-edit",
    label: "Qwen Image Edit",
    note: "Édition + texte précis",
    buildInput: (p, o) => ({ prompt: p, image: o.imageUrl }),
  },
  {
    id: "google/nano-banana",
    label: "Nano Banana (édition)",
    note: "Retouche cohérente Google",
    buildInput: (p, o) => ({ prompt: p, image_input: o.imageUrl ? [o.imageUrl] : [], output_format: "png" }),
  },
];

/* ── Amélioration (upscale / restauration) ────────────────────────────────── */
export const UPSCALE_MODELS: GenModel[] = [
  {
    id: "nightmareai/real-esrgan",
    label: "Real-ESRGAN ×4",
    note: "Upscale net ×4",
    buildInput: (_p, o) => ({ image: o.imageUrl, scale: 4 }),
  },
  {
    id: "philz1337x/clarity-upscaler",
    label: "Clarity Upscaler",
    note: "Upscale créatif HD",
    buildInput: (_p, o) => ({ image: o.imageUrl, scale_factor: 2 }),
  },
];

/* ── Musique (texte → musique) ────────────────────────────────────────────── */
export const MUSIC_MODELS: GenModel[] = [
  {
    id: "meta/musicgen",
    label: "MusicGen (Meta)",
    note: "Musique sur description",
    buildInput: (p, o) => ({ prompt: p, duration: Math.min(30, Math.max(5, o.seconds ?? 15)), model_version: "stereo-large", output_format: "mp3" }),
  },
  {
    id: "lucataco/ace-step",
    label: "ACE-Step",
    note: "Musique + structure",
    buildInput: (p, o) => ({ tags: p, duration: Math.min(60, Math.max(10, o.seconds ?? 20)) }),
  },
  {
    id: "stackadoc/stable-audio-open-1.0",
    label: "Stable Audio Open",
    note: "Boucles & ambiances",
    buildInput: (p, o) => ({ prompt: p, seconds_total: Math.min(30, Math.max(5, o.seconds ?? 12)) }),
  },
];

/* ── Voix (texte → parole) ────────────────────────────────────────────────── */
export const VOICE_MODELS: GenModel[] = [
  {
    id: "minimax/speech-02-hd",
    label: "MiniMax Speech 02 HD",
    note: "Voix très naturelle (multi-langues)",
    buildInput: (p, o) => ({ text: p, voice_id: o.voice || "Wise_Woman", speed: 1, emotion: "neutral" }),
  },
  {
    id: "jaaari/kokoro-82m",
    label: "Kokoro 82M",
    note: "TTS rapide & léger",
    buildInput: (p, o) => ({ text: p, voice: o.voice || "af_bella", speed: 1 }),
  },
  {
    id: "lucataco/xtts-v2",
    label: "XTTS v2",
    note: "Clonage de voix (multi-langues)",
    buildInput: (p) => ({ text: p, language: "fr" }),
  },
];

/* ── Vidéos ────────────────────────────────────────────────────────────────── */

export const VIDEO_MODELS: GenModel[] = [
  {
    id: "google/veo-3",
    label: "Google Veo 3",
    note: "Qualité max + son (~8 s)",
    buildInput: (p) => ({ prompt: p }),
  },
  {
    id: "google/veo-3-fast",
    label: "Veo 3 Fast",
    note: "Veo 3 plus rapide/éco",
    buildInput: (p) => ({ prompt: p }),
  },
  {
    id: "kwaivgi/kling-v2.1",
    label: "Kling v2.1",
    note: "Très bonne qualité (5/10 s)",
    buildInput: (p, o) => ({ prompt: p, duration: o.seconds && o.seconds >= 10 ? 10 : 5, aspect_ratio: vidRatio(o.aspect) }),
  },
  {
    id: "bytedance/seedance-1-pro",
    label: "Seedance 1 Pro",
    note: "Excellent mouvement (5-10 s)",
    buildInput: (p, o) => ({ prompt: p, duration: o.seconds && o.seconds >= 10 ? 10 : 5, aspect_ratio: vidRatio(o.aspect), resolution: "1080p" }),
  },
  {
    id: "bytedance/seedance-1-lite",
    label: "Seedance 1 Lite",
    note: "Plus économique",
    buildInput: (p, o) => ({ prompt: p, duration: o.seconds && o.seconds >= 10 ? 10 : 5, aspect_ratio: vidRatio(o.aspect) }),
  },
  {
    id: "minimax/hailuo-02",
    label: "Hailuo 02 (MiniMax)",
    note: "Bon rapport qualité/prix (6/10 s)",
    buildInput: (p, o) => ({ prompt: p, duration: o.seconds && o.seconds >= 10 ? 10 : 6 }),
  },
  {
    id: "minimax/video-01",
    label: "MiniMax Video-01",
    note: "Économique (~6 s)",
    buildInput: (p) => ({ prompt: p, prompt_optimizer: true }),
  },
  {
    id: "wan-video/wan-2.2-t2v-fast",
    label: "Wan 2.2 (rapide)",
    note: "Open, rapide",
    buildInput: (p) => ({ prompt: p }),
  },
];

/* ── Lookups ───────────────────────────────────────────────────────────────── */

// Défaut explicite = Flux 1.1 Pro (ne dépend pas de l'ordre du tableau, pour ne
// pas changer le comportement des autres écrans quand un modèle est ajouté en tête).
export const DEFAULT_IMAGE_MODEL_ID = "black-forest-labs/flux-1.1-pro";
export const DEFAULT_VIDEO_MODEL_ID = VIDEO_MODELS[0].id;

const FALLBACK_IMAGE_MODEL =
  IMAGE_MODELS.find((m) => m.id === DEFAULT_IMAGE_MODEL_ID) ?? IMAGE_MODELS[0];

export function getImageModel(id?: string): GenModel {
  return IMAGE_MODELS.find((m) => m.id === id) ?? FALLBACK_IMAGE_MODEL;
}
export function getVideoModel(id?: string): GenModel {
  return VIDEO_MODELS.find((m) => m.id === id) ?? VIDEO_MODELS[0];
}

export const DEFAULT_EDIT_MODEL_ID = EDIT_MODELS[0].id;
export const DEFAULT_MUSIC_MODEL_ID = MUSIC_MODELS[0].id;
export const DEFAULT_VOICE_MODEL_ID = VOICE_MODELS[0].id;
export function getEditModel(id?: string): GenModel {
  return EDIT_MODELS.find((m) => m.id === id) ?? EDIT_MODELS[0];
}
export function getAudioModel(id?: string): GenModel {
  return [...MUSIC_MODELS, ...VOICE_MODELS].find((m) => m.id === id) ?? MUSIC_MODELS[0];
}

/** Voix disponibles par modèle TTS (toutes les voix Replicate exposées). */
export const VOICE_PRESETS: Record<string, { id: string; label: string }[]> = {
  "minimax/speech-02-hd": [
    { id: "Wise_Woman", label: "Femme sage (posée)" },
    { id: "Calm_Woman", label: "Femme calme" },
    { id: "Lovely_Girl", label: "Jeune femme douce" },
    { id: "Lively_Girl", label: "Jeune femme pétillante" },
    { id: "Inspirational_girl", label: "Femme inspirante" },
    { id: "Sweet_Girl_2", label: "Voix sucrée" },
    { id: "Exuberant_Girl", label: "Femme exubérante" },
    { id: "Abbess", label: "Femme mûre (autorité douce)" },
    { id: "Deep_Voice_Man", label: "Homme voix grave" },
    { id: "Elegant_Man", label: "Homme élégant" },
    { id: "Imposing_Manner", label: "Homme imposant" },
    { id: "Patient_Man", label: "Homme posé" },
    { id: "Determined_Man", label: "Homme déterminé" },
    { id: "Casual_Guy", label: "Homme décontracté" },
    { id: "Friendly_Person", label: "Voix amicale" },
    { id: "Young_Knight", label: "Jeune homme héroïque" },
    { id: "Decent_Boy", label: "Jeune homme propre" },
  ],
  "jaaari/kokoro-82m": [
    { id: "ff_siwis", label: "Siwis — Français (F)" },
    { id: "af_bella", label: "Bella — EN (F)" },
    { id: "af_heart", label: "Heart — EN (F)" },
    { id: "af_nicole", label: "Nicole — EN (F, chuchotée)" },
    { id: "af_sarah", label: "Sarah — EN (F)" },
    { id: "af_sky", label: "Sky — EN (F)" },
    { id: "af_nova", label: "Nova — EN (F)" },
    { id: "af_alloy", label: "Alloy — EN (F)" },
    { id: "af_aoede", label: "Aoede — EN (F)" },
    { id: "af_jessica", label: "Jessica — EN (F)" },
    { id: "af_river", label: "River — EN (F)" },
    { id: "am_adam", label: "Adam — EN (H)" },
    { id: "am_michael", label: "Michael — EN (H)" },
    { id: "am_echo", label: "Echo — EN (H)" },
    { id: "am_eric", label: "Eric — EN (H)" },
    { id: "am_liam", label: "Liam — EN (H)" },
    { id: "am_onyx", label: "Onyx — EN (H, grave)" },
    { id: "am_puck", label: "Puck — EN (H)" },
    { id: "bf_emma", label: "Emma — EN britannique (F)" },
    { id: "bf_isabella", label: "Isabella — EN britannique (F)" },
    { id: "bf_alice", label: "Alice — EN britannique (F)" },
    { id: "bf_lily", label: "Lily — EN britannique (F)" },
    { id: "bm_george", label: "George — EN britannique (H)" },
    { id: "bm_lewis", label: "Lewis — EN britannique (H)" },
    { id: "bm_daniel", label: "Daniel — EN britannique (H)" },
    { id: "bm_fable", label: "Fable — EN britannique (H)" },
    { id: "if_sara", label: "Sara — Italien (F)" },
    { id: "im_nicola", label: "Nicola — Italien (H)" },
    { id: "ef_dora", label: "Dora — Espagnol (F)" },
    { id: "em_alex", label: "Alex — Espagnol (H)" },
  ],
};

/** Tous les modèles, par catégorie — pour les sélecteurs de studio. */
export const MODEL_GROUPS = {
  image: IMAGE_MODELS,
  edit: EDIT_MODELS,
  upscale: UPSCALE_MODELS,
  video: VIDEO_MODELS,
  music: MUSIC_MODELS,
  voice: VOICE_MODELS,
} as const;
