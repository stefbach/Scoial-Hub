// Formats médias requis par réceptacle (réseau) — pour générer images/vidéos
// aux bonnes dimensions/ratios selon Facebook, Instagram, LinkedIn, TikTok.

export type SocialPlatform = "facebook" | "instagram" | "linkedin" | "tiktok";

export interface MediaFormat {
  id: string;
  label: string;
  aspect: string;        // ratio passé au générateur ("1:1","4:5","9:16","16:9","1.91:1")
  width: number;
  height: number;
  kind: "image" | "video";
  placement: string;     // feed | story | reel | cover
}

export const SOCIAL_FORMATS: Record<SocialPlatform, MediaFormat[]> = {
  facebook: [
    { id: "fb_feed", label: "Feed paysage 1.91:1", aspect: "1.91:1", width: 1200, height: 628, kind: "image", placement: "feed" },
    { id: "fb_square", label: "Feed carré 1:1", aspect: "1:1", width: 1080, height: 1080, kind: "image", placement: "feed" },
    { id: "fb_story", label: "Story 9:16", aspect: "9:16", width: 1080, height: 1920, kind: "image", placement: "story" },
    { id: "fb_video", label: "Vidéo 16:9", aspect: "16:9", width: 1280, height: 720, kind: "video", placement: "feed" },
    { id: "fb_reel", label: "Reel 9:16", aspect: "9:16", width: 1080, height: 1920, kind: "video", placement: "reel" },
  ],
  instagram: [
    { id: "ig_square", label: "Feed carré 1:1", aspect: "1:1", width: 1080, height: 1080, kind: "image", placement: "feed" },
    { id: "ig_portrait", label: "Feed portrait 4:5", aspect: "4:5", width: 1080, height: 1350, kind: "image", placement: "feed" },
    { id: "ig_story", label: "Story 9:16", aspect: "9:16", width: 1080, height: 1920, kind: "image", placement: "story" },
    { id: "ig_reel", label: "Reel 9:16", aspect: "9:16", width: 1080, height: 1920, kind: "video", placement: "reel" },
  ],
  linkedin: [
    { id: "li_feed", label: "Feed 1.91:1", aspect: "1.91:1", width: 1200, height: 627, kind: "image", placement: "feed" },
    { id: "li_square", label: "Feed carré 1:1", aspect: "1:1", width: 1080, height: 1080, kind: "image", placement: "feed" },
    { id: "li_video", label: "Vidéo 16:9", aspect: "16:9", width: 1280, height: 720, kind: "video", placement: "feed" },
  ],
  tiktok: [
    { id: "tt_video", label: "Vidéo 9:16", aspect: "9:16", width: 1080, height: 1920, kind: "video", placement: "feed" },
    { id: "tt_cover", label: "Couverture 9:16", aspect: "9:16", width: 1080, height: 1920, kind: "image", placement: "cover" },
  ],
};

export function isSocialPlatform(x: string): x is SocialPlatform {
  return x === "facebook" || x === "instagram" || x === "linkedin" || x === "tiktok";
}

export function formatsForPlatform(p: SocialPlatform): MediaFormat[] {
  return SOCIAL_FORMATS[p] ?? [];
}

export function primaryImageFormat(p: SocialPlatform): MediaFormat {
  return SOCIAL_FORMATS[p].find((f) => f.kind === "image")!;
}

export function primaryVideoFormat(p: SocialPlatform): MediaFormat | undefined {
  return SOCIAL_FORMATS[p].find((f) => f.kind === "video");
}

/** Résout l'aspect ratio à partir d'un réseau (+ placement optionnel) pour une image. */
export function resolveImageAspect(platform?: string, placement?: string): string {
  if (platform && isSocialPlatform(platform)) {
    const list = SOCIAL_FORMATS[platform].filter((f) => f.kind === "image");
    const match = placement ? list.find((f) => f.placement === placement) : undefined;
    return (match ?? list[0]).aspect;
  }
  return "1:1";
}

/** Résout l'aspect ratio vidéo selon le réseau (TikTok/IG → 9:16, FB/LinkedIn → 16:9). */
export function resolveVideoAspect(platform?: string): string {
  if (platform && isSocialPlatform(platform)) {
    const v = primaryVideoFormat(platform);
    if (v) return v.aspect;
  }
  return "9:16";
}
