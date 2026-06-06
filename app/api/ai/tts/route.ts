/**
 * POST /api/ai/tts  — synthèse vocale premium via MiniMax (T2A v2).
 *
 * Clé lue UNIQUEMENT depuis l'environnement (jamais en dur) :
 *   - MINIMAX_API_KEY   (obligatoire)
 *   - MINIMAX_GROUP_ID  (requis par l'API MiniMax)
 *   - MINIMAX_VOICE_ID  (optionnel — défaut : voix féminine posée "female-yujie")
 *   - MINIMAX_API_BASE  (optionnel — défaut international)
 *
 * Body  : { text, voiceId?, language? }
 * Retour: { audioBase64, format:"mp3" }  ou  { fallback:true } (→ voix navigateur)
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

interface Body {
  text?: string;
  voiceId?: string;
  language?: string;
}

export async function POST(req: NextRequest) {
  const { text = "", voiceId, language }: Body = await req.json().catch(() => ({}));
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;
  const base = process.env.MINIMAX_API_BASE || "https://api.minimaxi.chat";
  const voice = voiceId || process.env.MINIMAX_VOICE_ID || "female-yujie";

  if (!text.trim()) return NextResponse.json({ error: "text requis" }, { status: 400 });
  // Pas de clé → le client utilisera la voix du navigateur.
  if (!apiKey) return NextResponse.json({ fallback: true, reason: "no-key" });

  try {
    const url = groupId
      ? `${base}/v1/t2a_v2?GroupId=${encodeURIComponent(groupId)}`
      : `${base}/v1/t2a_v2`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "speech-02-hd",
        text: text.slice(0, 2000),
        stream: false,
        language_boost: language || "auto",
        voice_setting: { voice_id: voice, speed: 0.96, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[tts] MiniMax HTTP", res.status, txt.slice(0, 200));
      return NextResponse.json({ fallback: true, reason: `http-${res.status}` });
    }

    const data = (await res.json()) as {
      data?: { audio?: string };
      base_resp?: { status_code?: number; status_msg?: string };
    };
    const hex = data?.data?.audio;
    if (!hex) {
      console.warn("[tts] MiniMax no audio:", data?.base_resp?.status_msg);
      return NextResponse.json({ fallback: true, reason: "no-audio" });
    }

    // MiniMax renvoie l'audio en hexadécimal → base64 pour le client.
    const audioBase64 = Buffer.from(hex, "hex").toString("base64");
    return NextResponse.json({ audioBase64, format: "mp3" });
  } catch (err) {
    console.warn("[tts] error:", err);
    return NextResponse.json({ fallback: true, reason: "error" });
  }
}
