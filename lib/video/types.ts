// Types du Studio Créatif — assemblage & marketing automatique d'images ET vidéos.

export type VideoPlatform =
  | "tiktok"
  | "instagram_reels"
  | "instagram_story"
  | "instagram_feed"
  | "instagram_portrait"
  | "youtube_shorts"
  | "youtube"
  | "facebook"
  | "facebook_portrait"
  | "facebook_story"
  | "facebook_landscape"
  | "linkedin"
  | "linkedin_square"
  | "twitter"
  | "pinterest";

export interface PlatformMeta {
  id: VideoPlatform;
  label: string;
  aspect: string; // "9:16" | "1:1" | "16:9" | "4:5" | "2:3"
  maxSeconds: number;
}

// Tous les formats publiables (couvre tous les ratios + réseaux).
export const VIDEO_PLATFORMS: PlatformMeta[] = [
  { id: "tiktok", label: "TikTok · 9:16", aspect: "9:16", maxSeconds: 60 },
  { id: "instagram_reels", label: "Instagram Reels · 9:16", aspect: "9:16", maxSeconds: 90 },
  { id: "instagram_story", label: "Instagram Story · 9:16", aspect: "9:16", maxSeconds: 60 },
  { id: "instagram_feed", label: "Instagram Feed · 1:1", aspect: "1:1", maxSeconds: 60 },
  { id: "instagram_portrait", label: "Instagram Portrait · 4:5", aspect: "4:5", maxSeconds: 60 },
  { id: "facebook", label: "Facebook · 1:1", aspect: "1:1", maxSeconds: 90 },
  { id: "facebook_portrait", label: "Facebook Portrait · 4:5", aspect: "4:5", maxSeconds: 90 },
  { id: "facebook_story", label: "Facebook Story · 9:16", aspect: "9:16", maxSeconds: 60 },
  { id: "facebook_landscape", label: "Facebook Paysage · 16:9", aspect: "16:9", maxSeconds: 120 },
  { id: "youtube_shorts", label: "YouTube Shorts · 9:16", aspect: "9:16", maxSeconds: 60 },
  { id: "youtube", label: "YouTube · 16:9", aspect: "16:9", maxSeconds: 600 },
  { id: "linkedin", label: "LinkedIn · 16:9", aspect: "16:9", maxSeconds: 120 },
  { id: "linkedin_square", label: "LinkedIn · 1:1", aspect: "1:1", maxSeconds: 120 },
  { id: "twitter", label: "X / Twitter · 16:9", aspect: "16:9", maxSeconds: 140 },
  { id: "pinterest", label: "Pinterest · 2:3", aspect: "2:3", maxSeconds: 60 },
];

// ── Médias source ─────────────────────────────────────────────────────────────

export type MediaKind = "image" | "video";

export interface MediaAsset {
  url: string;
  kind: MediaKind;
  name?: string;
}

/** Mode d'assemblage demandé pour produire le livrable. */
export type AssemblyMode =
  | "auto" // l'IA choisit le meilleur format
  | "carousel" // post multi-images (slides)
  | "slideshow" // diaporama animé (images → vidéo)
  | "collage" // visuel unique composé de plusieurs images
  | "single" // un seul visuel mis en marque
  | "video" // ré-édition d'une vidéo
  | "video_montage"; // montage de plusieurs clips

export const ASSEMBLY_MODES: { id: AssemblyMode; labelFr: string; labelEn: string; descFr: string; descEn: string }[] = [
  { id: "auto", labelFr: "Automatique", labelEn: "Automatic", descFr: "L'IA choisit le meilleur format selon vos médias.", descEn: "AI picks the best format for your media." },
  { id: "carousel", labelFr: "Carrousel", labelEn: "Carousel", descFr: "Post multi-images avec texte par slide.", descEn: "Multi-image post with per-slide text." },
  { id: "slideshow", labelFr: "Diaporama vidéo", labelEn: "Slideshow video", descFr: "Vos photos animées en vidéo rythmée.", descEn: "Your photos animated into a paced video." },
  { id: "collage", labelFr: "Collage", labelEn: "Collage", descFr: "Plusieurs images en un seul visuel.", descEn: "Several images into one visual." },
  { id: "single", labelFr: "Visuel unique", labelEn: "Single visual", descFr: "Une image mise en marque (titre, logo).", descEn: "One branded image (headline, logo)." },
  { id: "video", labelFr: "Vidéo (ré-édition)", labelEn: "Video (re-edit)", descFr: "Retraite une vidéo existante.", descEn: "Reprocess an existing video." },
  { id: "video_montage", labelFr: "Montage vidéo", labelEn: "Video montage", descFr: "Assemble plusieurs clips en un montage.", descEn: "Assemble several clips into one montage." },
];

/** Sous-titre incrusté (burned-in caption). */
export interface CaptionSegment {
  start: number; // secondes
  end: number;
  text: string;
}

/** Texte affiché à l'écran (hook, lower-third, CTA). */
export interface TextOverlay {
  atSecond: number;
  text: string;
  style: "hook" | "lower_third" | "cta";
}

/** Une slide (carrousel / diaporama / collage). */
export interface Slide {
  index: number;
  onImageText: string; // texte incrusté sur l'image
  note: string; // rôle / ce qu'il faut montrer
}

/** Déclinaison professionnelle d'un livrable pour un réseau précis. */
export interface PlatformCut {
  platform: VideoPlatform;
  label: string;
  aspect: string;
  /** Type de livrable réellement produit pour ce réseau. */
  assemblyType: AssemblyMode;
  /** Durée cible (vidéo/diaporama). 0 pour les formats statiques. */
  targetDurationSec: number;
  hook: string;
  hookVariants: string[];
  /** Slides pour carrousel / diaporama / collage. */
  slides: Slide[];
  overlays: TextOverlay[];
  musicMood: string;
  pacing: string;
  editNotes: string[];
  caption: string;
  hashtags: string[];
  cta: string;
  thumbnailText: string;
  /** URL d'une piste musicale à incruster (vidéo/diaporama). */
  musicUrl?: string;
  renderStatus: "ready" | "queued" | "simulated";
}

/** Pistes musicales libres de droits (publiques, exploitables par le rendu). */
export const MUSIC_TRACKS: { id: string; labelFr: string; labelEn: string; url: string }[] = [
  { id: "none", labelFr: "Aucune", labelEn: "None", url: "" },
  { id: "energetic", labelFr: "Énergique", labelEn: "Energetic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: "inspiring", labelFr: "Inspirant", labelEn: "Inspiring", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "chill", labelFr: "Chill / posé", labelEn: "Chill", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: "corporate", labelFr: "Corporate", labelEn: "Corporate", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3" },
  { id: "punchy", labelFr: "Punchy / urbain", labelEn: "Punchy", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
];

/** Paquet marketing complet produit à partir des médias bruts. */
export interface VideoMarketingPackage {
  assets: MediaAsset[];
  assembly: AssemblyMode;
  title: string;
  summary: string;
  transcriptSummary: string;
  brandSafe: boolean;
  captions: CaptionSegment[];
  cuts: PlatformCut[];
  aiGenerated: boolean;
  renderConfigured: boolean;
  createdAt: string;
}

export interface MarketizeInput {
  assets: MediaAsset[];
  assembly: AssemblyMode;
  objective: string;
  platforms: VideoPlatform[];
  brandVoice: string;
  lang: "fr" | "en";
  durationHintSec?: number;
}
