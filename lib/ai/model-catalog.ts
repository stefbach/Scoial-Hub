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
  buildInput: (prompt: string, opts: { aspect?: string; seconds?: number }) => Record<string, unknown>;
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
