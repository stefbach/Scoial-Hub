// ============================================================
// STUB — Image Generation Route
// ============================================================
// This endpoint is intentionally a mock until an image-generation
// provider is configured. See instructions below to activate.
//
// ── OPTION A: Replicate (Flux) ───────────────────────────────
// 1. Add REPLICATE_API_TOKEN to your .env.local
// 2. npm install replicate
// 3. Replace the handler body with:
//
// import Replicate from "replicate";
// const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
// const output = await replicate.run(
//   "black-forest-labs/flux-schnell",           // or flux-dev for higher quality
//   { input: { prompt, num_outputs: 4, aspect_ratio: "1:1" } }
// );
// // output is an array of ReadableStream or URL strings depending on the version
// const images = (output as string[]).map((url) => ({ url }));
// return NextResponse.json({ images });
//
// ── OPTION B: OpenAI Images (DALL·E 3) ─────────────────────
// 1. Add OPENAI_API_KEY to your .env.local
// 2. npm install openai
// 3. Replace the handler body with:
//
// import OpenAI from "openai";
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// const result = await openai.images.generate({
//   model: "dall-e-3",
//   prompt,
//   n: 1,                     // DALL·E 3 supports n=1 only
//   size: "1024x1024",
//   style: style === "photo" ? "natural" : "vivid",
//   response_format: "url",
// });
// const images = result.data.map((d) => ({ url: d.url! }));
// return NextResponse.json({ images });
//
// ── COST REFERENCE ──────────────────────────────────────────
// Flux Schnell (Replicate): ~$0.003 / image
// Flux Dev (Replicate):     ~$0.025 / image
// DALL·E 3 (OpenAI):        ~$0.04–0.08 / image depending on size
// ============================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

interface RequestBody {
  prompt?: string;
  format?: string; // "image" | "video"
  style?: string;  // "photo" | "illustration" | "poster" | "cinematic" | "animated"
}

export async function POST(req: NextRequest) {
  // Consume the body so Next.js doesn't complain about an unconsumed stream
  const _body: RequestBody = await req.json().catch(() => ({}));
  void _body;

  return NextResponse.json({
    images: [],
    mock: true,
    message:
      "Configurer REPLICATE_API_TOKEN ou OPENAI_API_KEY (voir commentaires dans app/api/ai/generate-image/route.ts)",
  });
}
