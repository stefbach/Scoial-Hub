import { NextResponse } from "next/server";

// Diagnostic : indique quelles variables d'environnement sont PRÉSENTES
// en production (booléens uniquement — aucune valeur secrète n'est exposée).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    present: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      REPLICATE_API_TOKEN: Boolean(process.env.REPLICATE_API_TOKEN),
      YOUTUBE_API_KEY: Boolean(process.env.YOUTUBE_API_KEY),
      XPOZ_API_KEY: Boolean(process.env.XPOZ_API_KEY),
      CLOUDINARY: Boolean(process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL),
      META_AD_LIBRARY_TOKEN: Boolean(process.env.META_AD_LIBRARY_TOKEN),
      META_APP_ID: Boolean(process.env.META_APP_ID),
      LINKEDIN_CLIENT_ID: Boolean(process.env.LINKEDIN_CLIENT_ID),
      SHOTSTACK_API_KEY: Boolean(process.env.SHOTSTACK_API_KEY),
      TELEGRAM_BOT_TOKEN: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      TELEGRAM_BOT_USERNAME: Boolean(process.env.TELEGRAM_BOT_USERNAME),
    },
    config: {
      // Valeur non secrète — utile pour diagnostiquer le rendu Shotstack.
      SHOTSTACK_ENV: process.env.SHOTSTACK_ENV === "v1" ? "v1" : "stage",
    },
  });
}
