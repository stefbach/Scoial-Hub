/**
 * POST /api/ai/tts — synthèse vocale premium MiniMax.
 *
 * Voie privilégiée : MiniMax Speech-02 HD via Replicate (REPLICATE_API_TOKEN
 * déjà configuré pour images/vidéos — aucune autre clé requise).
 * Voie secondaire : API MiniMax directe (MINIMAX_API_KEY + MINIMAX_GROUP_ID).
 * Sinon : { fallback:true } → le client utilise la voix du navigateur.
 *
 * Body  : { text, voiceId?, language? }
 * Retour: { audioBase64, mime }  ou  { fallback:true }
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { generateSpeech, isReplicateConfigured } from "@/lib/ai/replicate";

interface Body {
  text?: string;
  voiceId?: string;
  language?: string;
}

// Mappe la langue d'affichage vers le language_boost MiniMax.
function languageBoost(language?: string): string {
  const l = (language || "").toLowerCase();
  if (l.startsWith("fran")) return "French";
  if (l.startsWith("eng") || l.startsWith("angl")) return "English";
  if (l.startsWith("esp") || l.startsWith("spa")) return "Spanish";
  if (l.startsWith("deu") || l.startsWith("ger") || l.startsWith("alle")) return "German";
  if (l.startsWith("ita")) return "Italian";
  if (l.startsWith("por")) return "Portuguese";
  return "Automatic";
}

export async function POST(req: NextRequest) {
  const { text = "", voiceId, language }: Body = await req.json().catch(() => ({}));
  if (!text.trim()) return NextResponse.json({ error: "text requis" }, { status: 400 });

  // 1) MiniMax Speech-02 HD via Replicate (voix féminine posée par défaut).
  if (isReplicateConfigured) {
    try {
      const voice = voiceId || process.env.MINIMAX_VOICE_ID || "Calm_Woman";
      const { url } = await generateSpeech(text, voice, { languageBoost: languageBoost(language) });
      if (url) {
        const audioRes = await fetch(url);
        const mime = audioRes.headers.get("content-type") || "audio/mpeg";
        const buf = Buffer.from(await audioRes.arrayBuffer());
        return NextResponse.json({ audioBase64: buf.toString("base64"), mime });
      }
    } catch (err) {
      console.warn("[tts] Replicate MiniMax failed, trying direct API:", err);
    }
  }

  // 2) API MiniMax directe (nécessite MINIMAX_API_KEY + MINIMAX_GROUP_ID).
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;
  if (apiKey && groupId) {
    try {
      const base = process.env.MINIMAX_API_BASE || "https://api.minimaxi.chat";
      const res = await fetch(`${base}/v1/t2a_v2?GroupId=${encodeURIComponent(groupId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "speech-02-hd",
          text: text.slice(0, 2000),
          stream: false,
          voice_setting: { voice_id: voiceId || process.env.MINIMAX_VOICE_ID || "female-yujie", speed: 0.96, vol: 1, pitch: 0 },
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: { audio?: string } };
        const hex = data?.data?.audio;
        if (hex) {
          return NextResponse.json({ audioBase64: Buffer.from(hex, "hex").toString("base64"), mime: "audio/mpeg" });
        }
      } else {
        console.warn("[tts] MiniMax direct HTTP", res.status);
      }
    } catch (err) {
      console.warn("[tts] MiniMax direct error:", err);
    }
  }

  // 3) Repli : voix du navigateur côté client.
  return NextResponse.json({ fallback: true });
}
