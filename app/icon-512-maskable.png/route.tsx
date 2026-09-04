import { ImageResponse } from "next/og";
import { axonIconSvg } from "@/lib/brand/pwa-icon";

export const runtime = "edge";

// Icône PWA (manifest) 512×512, purpose "maskable" — fond plein bord-à-bord
// (les OS appliquent eux-mêmes le masque/l'arrondi), référencée par app/manifest.ts.
export function GET() {
  return new ImageResponse(axonIconSvg(512, false), { width: 512, height: 512 });
}
