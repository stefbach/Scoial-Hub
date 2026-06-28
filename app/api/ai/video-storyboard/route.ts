/**
 * POST /api/ai/video-storyboard
 *
 * Découpe un brief visuel en N scènes COHÉRENTES (continuité narrative) pour
 * générer plusieurs clips qui s'enchaînent et atteindre une durée plus longue
 * (Veo 3 ≈ 8 s/clip → 2-3 scènes pour ~16-24 s).
 *
 * Consigne : aucun texte à l'écran (il sera incrusté ensuite via l'éditeur).
 *
 * Retour : { scenes: string[] }  (un prompt vidéo par scène)
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClaudeMessage } from "@/lib/ai/anthropic";
import { env, isAiConfigured } from "@/lib/env";

interface Body {
  brief?: string;
  scenes?: number;
}

const NO_TEXT = "Aucun texte, sous-titre, logo ou filigrane à l'écran.";

function mockScenes(brief: string, n: number): string[] {
  const b = brief.trim() || "scène de marque";
  return Array.from({ length: n }, (_, i) =>
    `Scène ${i + 1}/${n} — ${b}. Plan ${i === 0 ? "d'ouverture accrocheur" : i === n - 1 ? "de clôture avec produit en valeur" : "intermédiaire dynamique"}, caméra fluide, lumière soignée. ${NO_TEXT}`,
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const brief = body.brief ?? "";
  const n = Math.max(1, Math.min(body.scenes ?? 2, 4));
  try {
    if (n === 1) {
      return NextResponse.json({ scenes: [`${brief}. ${NO_TEXT}`] });
    }
    if (!isAiConfigured) {
      return NextResponse.json({ scenes: mockScenes(brief, n) });
    }

    const client = new Anthropic({ apiKey: env.anthropicKey });
    const prompt = `Tu es réalisateur. À partir de ce brief visuel, écris un storyboard de ${n} scènes qui s'ENCHAÎNENT avec une CONTINUITÉ visuelle et narrative (même univers, même style, même sujet ; progression logique du début à la fin). Chaque scène fait ~8 secondes.

Brief : """${brief.slice(0, 800)}"""

Contraintes pour CHAQUE prompt de scène :
- décris le plan, le mouvement de caméra, l'ambiance et la lumière ;
- garde une cohérence totale entre les scènes (couleurs, sujet, style) ;
- ${NO_TEXT}

Réponds STRICTEMENT en JSON : {"scenes": ["prompt scène 1", "prompt scène 2", ...]} (exactement ${n} éléments, en français).`;

    const msg = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as { scenes?: string[] };
    const scenes = (parsed.scenes ?? []).filter((s) => typeof s === "string" && s.trim());
    if (scenes.length === 0) throw new Error("empty");
    // Sécurise la consigne « pas de texte » sur chaque scène.
    return NextResponse.json({
      scenes: scenes.slice(0, n).map((s) => (s.includes("texte") ? s : `${s} ${NO_TEXT}`)),
    });
  } catch (err) {
    console.warn("[video-storyboard] fallback:", err);
    return NextResponse.json({ scenes: mockScenes(brief, n) });
  }
}
