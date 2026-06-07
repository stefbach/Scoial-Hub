// /api/ai/avatar — Studio Avatar : script (Claude) puis vidéo d'avatar parlant
// (TTS + lip-sync via Replicate).
//   POST { companyId, mode: "script" | "video", ... }
//     mode "script" : { topic, language?, tone?, seconds? } → { script }
//     mode "video"  : { script, faceUrl, voice? }           → { videoUrl, audioUrl, simulated }

export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { generateAvatarVideo, isReplicateConfigured } from "@/lib/ai/replicate";
import { isAiConfigured } from "@/lib/env";

interface Body {
  companyId?: string;
  mode?: "script" | "video";
  topic?: string;
  language?: string;
  tone?: string;
  seconds?: number;
  script?: string;
  faceUrl?: string;
  voice?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  // ── Génération du script (Claude) ──────────────────────────────────────────
  if (body.mode === "script") {
    const topic = (body.topic ?? "").trim();
    if (!topic) return NextResponse.json({ error: "Sujet requis" }, { status: 400 });
    const lang = body.language === "en" ? "anglais" : "français";
    const seconds = Math.min(Math.max(body.seconds ?? 20, 8), 90);
    // ~2,5 mots/seconde de parole → borne la longueur.
    const words = Math.round(seconds * 2.5);

    if (!isAiConfigured) {
      return NextResponse.json({
        script: `(${lang}) ${topic} — script de démonstration (IA non configurée).`,
        aiGenerated: false,
      });
    }

    const data = await callClaudeJSON<{ script: string }>(
      `Tu écris le SCRIPT PARLÉ d'un avatar vidéo pour les réseaux sociaux.
Sujet : "${topic}".
Langue : ${lang}. Ton : ${body.tone || "naturel, dynamique, professionnel"}.
Contraintes : ~${words} mots (≈ ${seconds}s à l'oral), une accroche en première phrase, phrases courtes faciles à dire à voix haute, pas d'emojis, pas de didascalies, pas de hashtags. Juste le texte à dire.
Réponds en JSON: { "script": "..." }`,
      { maxTokens: 700, temperature: 0.7 }
    );
    const script = data?.script?.trim();
    if (!script) return NextResponse.json({ error: "Échec de génération du script." }, { status: 502 });
    return NextResponse.json({ script, aiGenerated: true });
  }

  // ── Génération de la vidéo d'avatar (TTS + lip-sync) ───────────────────────
  const script = (body.script ?? "").trim();
  const faceUrl = (body.faceUrl ?? "").trim();
  if (!script) return NextResponse.json({ error: "Script requis" }, { status: 400 });
  if (!faceUrl) return NextResponse.json({ error: "Image de visage (URL) requise" }, { status: 400 });
  if (!isReplicateConfigured) {
    return NextResponse.json({ simulated: true });
  }

  try {
    const result = await generateAvatarVideo({ text: script, faceUrl, voice: body.voice });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/ai/avatar]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec de génération de l'avatar." },
      { status: 502 }
    );
  }
}
