import { ImageResponse } from "next/og";
import { axonIconSvg } from "@/lib/brand/pwa-icon";

export const runtime = "edge";

// Icône PWA (manifest) 512×512, purpose "any" — référencée par app/manifest.ts.
export function GET() {
  return new ImageResponse(axonIconSvg(512, true), { width: 512, height: 512 });
}
