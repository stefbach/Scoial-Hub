// POST /api/video/director
// « Réalisateur IA » : à partir d'un brief, planifie un STORYBOARD multi-scènes
// (prompts vidéo, durées, textes à l'écran, voix off) prêt à être généré clip par
// clip puis assemblé. Dégradation gracieuse : storyboard de secours si l'IA n'est
// pas configurée.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSONRetry } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

export interface DirectorScene {
  index: number;
  prompt: string;        // prompt visuel EN pour le modèle texte→vidéo
  seconds: number;       // durée du clip
  onScreenText: string;  // texte incrusté (langue UI)
  voiceover?: string;    // réplique voix off (langue UI)
}
export interface Storyboard {
  title: string;
  summary: string;
  aspect: string;
  musicMood: string;
  caption: string;
  hashtags: string[];
  scenes: DirectorScene[];
  aiGenerated: boolean;
}

const ASPECTS: Record<string, string> = {
  tiktok: "9:16", instagram: "9:16", instagram_reels: "9:16", story: "9:16",
  youtube: "16:9", linkedin: "16:9", facebook: "16:9", square: "1:1",
};

function clampInt(n: unknown, min: number, max: number, dflt: number): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string; brief?: string; network?: string; aspect?: string;
      durationSec?: number; sceneCount?: number; language?: "fr" | "en"; brandVoice?: string; brandName?: string;
    };
    const { companyId, brief } = body;
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!brief?.trim()) return NextResponse.json({ error: "Brief requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const en = body.language === "en";
    const aspect = body.aspect || ASPECTS[body.network ?? "tiktok"] || "9:16";
    const sceneCount = clampInt(body.sceneCount, 3, 6, 4);
    const totalSec = clampInt(body.durationSec, 10, 60, 20);
    const perClip = Math.max(5, Math.min(10, Math.round(totalSec / sceneCount)));

    // ── Storyboard de secours (déterministe) ────────────────────────────────
    const fallback = (): Storyboard => {
      const scenes: DirectorScene[] = Array.from({ length: sceneCount }, (_, i) => ({
        index: i + 1,
        prompt: `${brief.trim()} — cinematic shot ${i + 1}, dynamic camera, professional lighting, high detail, social-media ready`,
        seconds: perClip,
        onScreenText: i === 0 ? brief.trim().slice(0, 40) : "",
      }));
      return {
        title: brief.trim().slice(0, 60),
        summary: en ? "Auto storyboard (AI not configured)." : "Storyboard automatique (IA non configurée).",
        aspect, musicMood: en ? "upbeat, modern" : "énergique, moderne",
        caption: brief.trim(), hashtags: [], scenes, aiGenerated: false,
      };
    };

    if (!isAiConfigured) return NextResponse.json(fallback());

    const langRule = en
      ? "ABSOLUTE RULE: write \"onScreenText\", \"voiceover\", \"title\", \"summary\", \"caption\" and \"hashtags\" in ENGLISH. The scene \"prompt\" MUST always be in ENGLISH (for the video model)."
      : "RÈGLE : rédige \"onScreenText\", \"voiceover\", \"title\", \"summary\", \"caption\" et \"hashtags\" en FRANÇAIS. Le \"prompt\" de scène doit TOUJOURS être en ANGLAIS (pour le modèle vidéo).";

    const prompt = `${langRule}

Tu es un réalisateur senior de vidéos courtes pour les réseaux sociaux.
BRIEF : ${brief.trim()}
MARQUE : ${body.brandName || "(non précisée)"}${body.brandVoice ? ` — voix : ${body.brandVoice}` : ""}
RÉSEAU : ${body.network || "tiktok"} (format ${aspect}) — durée totale visée ~${totalSec}s, en ${sceneCount} scènes (~${perClip}s/scène).

Conçois un STORYBOARD cohérent et vendeur. Pour CHAQUE scène :
- "prompt" : prompt visuel EN ANGLAIS pour un modèle texte→vidéo (sujet, action, décor, mouvement de caméra, lumière, ambiance ; PAS de texte incrusté dans l'image).
- "seconds" : durée du clip (5 à 10).
- "onScreenText" : courte accroche à incruster (≤ 6 mots), peut être vide.
- "voiceover" : une phrase de voix off (optionnelle).

Réponds STRICTEMENT en JSON :
{
 "title": "...", "summary": "...", "musicMood": "...",
 "caption": "légende du post", "hashtags": ["#..."],
 "scenes": [ { "index":1, "prompt":"...", "seconds":7, "onScreenText":"...", "voiceover":"..." } ]
}
${langRule}`;

    const result = await callClaudeJSONRetry<Partial<Storyboard>>(prompt, { maxTokens: 1500 }, 1);
    if (!result || !Array.isArray(result.scenes) || result.scenes.length === 0) {
      return NextResponse.json(fallback());
    }

    const scenes: DirectorScene[] = result.scenes.slice(0, sceneCount).map((s, i) => ({
      index: i + 1,
      prompt: String(s?.prompt || `${brief.trim()} cinematic shot ${i + 1}`).slice(0, 600),
      seconds: clampInt(s?.seconds, 5, 10, perClip),
      onScreenText: String(s?.onScreenText || "").slice(0, 60),
      voiceover: s?.voiceover ? String(s.voiceover).slice(0, 200) : undefined,
    }));

    return NextResponse.json({
      title: String(result.title || brief.trim().slice(0, 60)),
      summary: String(result.summary || ""),
      aspect,
      musicMood: String(result.musicMood || (en ? "upbeat, modern" : "énergique, moderne")),
      caption: String(result.caption || brief.trim()),
      hashtags: Array.isArray(result.hashtags) ? result.hashtags.filter((h) => typeof h === "string").slice(0, 6) : [],
      scenes,
      aiGenerated: true,
    } satisfies Storyboard);
  } catch (e) {
    console.error("[POST /api/video/director]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
