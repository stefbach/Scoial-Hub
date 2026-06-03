// Types du Studio Vidéo — retraitement & marketing automatique d'une vidéo brute.

export type VideoPlatform =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "facebook"
  | "linkedin";

export interface PlatformMeta {
  id: VideoPlatform;
  label: string;
  aspect: string; // "9:16" | "1:1" | "16:9"
  maxSeconds: number;
}

export const VIDEO_PLATFORMS: PlatformMeta[] = [
  { id: "tiktok", label: "TikTok", aspect: "9:16", maxSeconds: 60 },
  { id: "instagram_reels", label: "Instagram Reels", aspect: "9:16", maxSeconds: 90 },
  { id: "youtube_shorts", label: "YouTube Shorts", aspect: "9:16", maxSeconds: 60 },
  { id: "facebook", label: "Facebook", aspect: "1:1", maxSeconds: 90 },
  { id: "linkedin", label: "LinkedIn", aspect: "16:9", maxSeconds: 120 },
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

/** Déclinaison professionnelle d'une vidéo pour un réseau précis. */
export interface PlatformCut {
  platform: VideoPlatform;
  label: string;
  aspect: string;
  targetDurationSec: number;
  hook: string;
  hookVariants: string[];
  overlays: TextOverlay[];
  musicMood: string;
  pacing: string;
  editNotes: string[];
  caption: string;
  hashtags: string[];
  cta: string;
  thumbnailText: string;
  renderStatus: "ready" | "queued" | "simulated";
}

/** Paquet marketing complet produit à partir d'une vidéo brute. */
export interface VideoMarketingPackage {
  sourceUrl: string;
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
  sourceUrl: string;
  objective: string;
  platforms: VideoPlatform[];
  brandVoice: string;
  lang: "fr" | "en";
  durationHintSec?: number;
}
