import { ImageResponse } from "next/og";
import { axonIconSvg } from "@/lib/brand/pwa-icon";

export const runtime = "edge";

// Icône PWA (manifest) 192×192 — référencée par app/manifest.ts.
export function GET() {
  return new ImageResponse(axonIconSvg(192, true), { width: 192, height: 192 });
}
