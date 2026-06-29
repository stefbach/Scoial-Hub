import type { Platform } from "@/lib/types";

const MAP: Record<Platform, { short: string; bg: string; text: string }> = {
  facebook: { short: "FB", bg: "#e7f0fe", text: "#1877f2" },
  instagram: { short: "IG", bg: "#fce7f1", text: "#d62976" },
  linkedin: { short: "in", bg: "#e6f0f9", text: "#0a66c2" },
  tiktok: { short: "TT", bg: "#111111", text: "#ffffff" },
  twitter: { short: "X", bg: "#111111", text: "#ffffff" },
};

export function PlatformTag({ platform }: { platform: Platform }) {
  const m = MAP[platform];
  return (
    <span
      className="inline-flex h-5 w-7 items-center justify-center rounded text-2xs font-bold"
      style={{ backgroundColor: m.bg, color: m.text }}
    >
      {m.short}
    </span>
  );
}
