// /api/ai/avatar — Studio Avatar : script (Claude) puis vidéo d'avatar parlant
// (TTS + lip-sync via Replicate).
//   POST { companyId, mode: "script" | "video", ... }
//     mode "script" : { topic, language?, tone?, seconds? } → { script }
//     mode "video"  : { script, faceUrl, voice? }           → { videoUrl, audioUrl, simulated }

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { runReplicateUrl, generateImageModel, startAvatarLipsync, startSubtitles, cloneVoiceMiniMax, getReplicatePrediction, isReplicateConfigured } from "@/lib/ai/replicate";
import { getAvatarModel, getLang, TTS_MULTILINGUAL_MODEL, XTTS_MODEL, VOICE_BY_GENDER } from "@/lib/ai/avatar-models";

/**
 * Synthèse vocale routée : FR/EN → MiniMax (voix preset/clonée) ; autres langues
 * → XTTS-v2 (multilingue natif) à partir d'un échantillon de voix (speakerUrl).
 */
async function synthesizeTTS(
  text: string,
  langCode: string | undefined,
  voiceId: string | undefined,
  speakerUrl: string | undefined
): Promise<string | null> {
  const lang = getLang(langCode);
  if (lang.native) {
    return runReplicateUrl(TTS_MULTILINGUAL_MODEL, {
      text,
      voice_id: voiceId || VOICE_BY_GENDER.female,
      language_boost: lang.boost,
    });
  }
  if (!speakerUrl) {
    throw new Error("Pour cette langue, téléversez un échantillon de voix (clonage) : XTTS s'en sert de référence.");
  }
  return runReplicateUrl(XTTS_MODEL, { text, speaker: speakerUrl, language: lang.xtts });
}
import { isAiConfigured } from "@/lib/env";

interface Body {
  companyId?: string;
  mode?: "script" | "video" | "subtitle" | "voice-preview" | "clone-voice" | "persist";
  videoUrl?: string;
  audioUrl?: string;
  topic?: string;
  language?: string;
  tone?: string;
  seconds?: number;
  script?: string;
  faceUrl?: string;
  gender?: "male" | "female";
  voiceId?: string;
  speakerUrl?: string;
  text?: string;
  lipsyncModel?: string;
  environment?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

  // ── Génération du script (Claude) ──────────────────────────────────────────
  if (body.mode === "script") {
    const topic = (body.topic ?? "").trim();
    if (!topic) return NextResponse.json({ error: "Sujet requis" }, { status: 400 });
    const lang = getLang(body.language).claude;
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

  // ── Persistance : télécharge la vidéo (URL Replicate éphémère) → stockage ──
  if (body.mode === "persist") {
    const url = (body.videoUrl ?? "").trim();
    if (!url) return NextResponse.json({ error: "videoUrl requise" }, { status: 400 });
    const { persistRemoteMedia } = await import("@/lib/repositories/media");
    return NextResponse.json({ url: await persistRemoteMedia(body.companyId!, url, "video") });
  }

  // ── Clonage de voix : échantillon audio → voice_id réutilisable ────────────
  if (body.mode === "clone-voice") {
    const audioUrl = (body.audioUrl ?? "").trim();
    if (!audioUrl) return NextResponse.json({ error: "Échantillon audio requis" }, { status: 400 });
    if (!isReplicateConfigured) return NextResponse.json({ simulated: true });
    const res = await cloneVoiceMiniMax(audioUrl);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 502 });
    return NextResponse.json({ voiceId: res.voiceId });
  }

  // ── Écoute d'une voix : synthétise un court extrait (synchrone) ─────────────
  if (body.mode === "voice-preview") {
    if (!isReplicateConfigured) return NextResponse.json({ simulated: true });
    const lang = getLang(body.language);
    const voiceId = body.voiceId || VOICE_BY_GENDER[body.gender === "male" ? "male" : "female"];
    // Extrait court (≈ 1ʳᵉ phrase) pour un aperçu rapide et peu coûteux.
    const raw = (body.text ?? "").trim();
    const sample = (raw ? raw.split(/(?<=[.!?])\s/)[0] : "")
      .slice(0, 160) || (lang.code === "en" ? "Hello, here is a preview of this voice." : "Bonjour, voici un aperçu de cette voix.");
    try {
      const audioUrl = await synthesizeTTS(sample, body.language, voiceId, body.speakerUrl);
      if (!audioUrl) return NextResponse.json({ error: "Aperçu indisponible." }, { status: 502 });
      return NextResponse.json({ audioUrl });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Échec de l'aperçu." }, { status: 502 });
    }
  }

  // ── Sous-titres : incruste les sous-titres sur une vidéo existante ─────────
  if (body.mode === "subtitle") {
    const videoUrl = (body.videoUrl ?? "").trim();
    if (!videoUrl) return NextResponse.json({ error: "videoUrl requis" }, { status: 400 });
    if (!isReplicateConfigured) return NextResponse.json({ simulated: true });
    try {
      const started = await startSubtitles(videoUrl);
      if (started.error) throw new Error(started.error);
      if (started.videoUrl) return NextResponse.json({ videoUrl: started.videoUrl });
      if (!started.id) throw new Error("Démarrage des sous-titres impossible.");
      return NextResponse.json({ pending: true, predictionId: started.id });
    } catch (e) {
      console.error("[avatar subtitle]", e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Échec des sous-titres." }, { status: 502 });
    }
  }

  // ── Génération de la vidéo d'avatar (environnement → TTS → lip-sync) ───────
  const script = (body.script ?? "").trim();
  const faceUrl = (body.faceUrl ?? "").trim();
  if (!script) return NextResponse.json({ error: "Script requis" }, { status: 400 });
  if (!faceUrl) return NextResponse.json({ error: "Image de visage (URL) requise" }, { status: 400 });
  if (!isReplicateConfigured) return NextResponse.json({ simulated: true });

  const voiceId = body.voiceId || VOICE_BY_GENDER[body.gender === "male" ? "male" : "female"];
  const avatarSpec = getAvatarModel(body.lipsyncModel);

  try {
    // 0) Environnement (optionnel) : remplace le fond du portrait via Flux Kontext,
    //    en conservant la personne. Haute qualité, photoréaliste.
    let sourceImage = faceUrl;
    const env = (body.environment ?? "").trim();
    if (env) {
      try {
        const edit = await generateImageModel(
          "black-forest-labs/flux-kontext-pro",
          {
            prompt: `Garde EXACTEMENT la même personne et le même visage. Remplace uniquement l'arrière-plan par : ${env}. Rendu photoréaliste, éclairage cohérent et professionnel, haute qualité.`,
            input_image: faceUrl,
            aspect_ratio: "match_input_image",
            output_format: "jpg",
            safety_tolerance: 2,
          },
          1
        );
        if (edit.images?.[0]?.url) sourceImage = edit.images[0].url;
      } catch (e) {
        console.warn("[avatar] environnement Kontext échoué, portrait d'origine conservé:", e);
      }
    }

    // 1) Voix (TTS) — FR/EN via MiniMax, autres langues via XTTS (voix clonée).
    const audioUrl = await synthesizeTTS(script, body.language, voiceId, body.speakerUrl);
    if (!audioUrl) throw new Error("Échec de la génération de la voix (TTS).");

    // 2) Lip-sync : DÉMARRE la prédiction sans attendre (les modèles avatar
    //    prennent plusieurs minutes → on évite le timeout serverless).
    const started = await startAvatarLipsync(avatarSpec.id, sourceImage, audioUrl);
    if (started.error) throw new Error(started.error);
    if (started.videoUrl) {
      return NextResponse.json({ videoUrl: started.videoUrl, audioUrl, sourceImage });
    }
    if (!started.id) throw new Error("Démarrage du lip-sync impossible.");
    // Le client interroge GET /api/ai/avatar?id=… jusqu'au résultat.
    return NextResponse.json({ pending: true, predictionId: started.id, audioUrl, sourceImage });
  } catch (e) {
    console.error("[POST /api/ai/avatar]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec de génération de l'avatar." },
      { status: 502 }
    );
  }
}

// GET /api/ai/avatar?id=… → statut de la prédiction lip-sync (polling client).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const r = await getReplicatePrediction(id);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ status: "failed", error: e instanceof Error ? e.message : "Erreur" });
  }
}
