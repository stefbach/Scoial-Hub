// Analyse IA (vision) d'un visuel de marque — LOGO ou CHARTE GRAPHIQUE — pour en
// extraire l'identite (palette, couleur de texte lisible, style, ton) AVANT de
// construire l'affiche. Les "promptHints" enrichissent ensuite le prompt d'image
// pour rester coherent avec la marque.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { isAiConfigured, env } from "@/lib/env";
import { normalizeLang, langName, langRule, pick } from "@/lib/ai/lang";

interface BrandVisual {
  palette: string[];
  recommendedTextColor: string;
  style: string;
  tone: string;
  promptHints: string;
  summary: string;
  aiGenerated: boolean;
}

// Decoupe une data URL "data:image/png;base64,XXXX" -> { mediaType, data }.
function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

function normHex(c: string | undefined, fallback: string): string {
  if (!c || !/^#?[0-9a-fA-F]{3,8}$/.test(c)) return fallback;
  return c.startsWith("#") ? c : `#${c}`;
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, imageDataUrl, kind, lang: rawLang } = (await req.json()) as {
      companyId?: string; imageDataUrl?: string; kind?: "logo" | "charte"; lang?: string;
    };
    const lang = normalizeLang(rawLang);
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!imageDataUrl) return NextResponse.json({ error: "image requise" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const parsed = parseDataUrl(imageDataUrl);
    if (!parsed) return NextResponse.json({ error: "Format d'image invalide" }, { status: 400 });
    if (parsed.data.length > 8_000_000) return NextResponse.json({ error: "Image trop lourde (max ~6 Mo)" }, { status: 413 });

    // Claude vision n'accepte que png/jpeg/gif/webp ; le client rasterise déjà
    // en PNG, mais on garde-fou ici contre tout autre type (ex. SVG).
    const SUPPORTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    const mediaType = SUPPORTED.includes(parsed.mediaType) ? parsed.mediaType : "image/png";

    const empty: BrandVisual = {
      palette: [], recommendedTextColor: "#ffffff", style: "", tone: "", promptHints: "",
      summary: pick(
        lang,
        "Analyse IA non configurée — importez votre logo/charte et choisissez les couleurs manuellement.",
        "AI analysis is not configured — upload your logo/brand chart and pick the colors manually."
      ),
      aiGenerated: false,
    };
    if (!isAiConfigured) return NextResponse.json({ visual: empty });

    // « style », « tone » et « summary » sont affichés tels quels : ils suivent
    // la langue de l'interface. Seul "promptHints" reste en anglais (contrainte
    // des modèles d'image).
    const L = langName(lang);
    const what = kind === "charte" ? "cette charte graphique" : "ce logo";
    const prompt = `Tu es directeur artistique. Analyse ${what} et extrais l'identite visuelle de la marque.
${langRule(lang)} Seul le champ "promptHints" reste EN ANGLAIS (contrainte des modeles d'image).
Retourne STRICTEMENT ce JSON :
{
  "palette": ["#hex", "..."],
  "recommendedTextColor": "#hex",
  "style": "style en ${L} (ex. minimaliste, medical, premium, moderne...)",
  "tone": "ton en ${L} (ex. rassurant, expert, dynamique...)",
  "promptHints": "indications de style EN ANGLAIS a integrer dans un prompt d'image pour rester coherent avec cette marque (palette, ambiance, matieres, lumiere)",
  "summary": "1-2 phrases en ${L} resumant l'identite visuelle"
}`;

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const { createClaudeMessage } = await import("@/lib/ai/anthropic");
      const client = new Anthropic({ apiKey: env.anthropicKey });
      const msg = await createClaudeMessage(client, {
        model: env.anthropicModel,
        max_tokens: 700,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as "image/png", data: parsed.data } },
            { type: "text", text: prompt },
          ],
        }],
      });
      const raw = msg.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ visual: empty });
      const p = JSON.parse(match[0]) as Partial<BrandVisual>;
      const visual: BrandVisual = {
        palette: (p.palette ?? []).map((c) => normHex(c, "")).filter(Boolean).slice(0, 6),
        recommendedTextColor: normHex(p.recommendedTextColor, "#ffffff"),
        style: p.style ?? "",
        tone: p.tone ?? "",
        promptHints: p.promptHints ?? "",
        summary: p.summary ?? "",
        aiGenerated: true,
      };
      return NextResponse.json({ visual });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.warn("[analyze-brand-visual] fallback:", detail);
      // On signale la vraie raison (au lieu de « non configuré ») pour le débogage.
      return NextResponse.json({
        visual: {
          ...empty,
          summary: pick(
            lang,
            `Analyse indisponible : ${detail}. Réessayez ou choisissez les couleurs manuellement.`,
            `Analysis unavailable: ${detail}. Try again or pick the colors manually.`
          ),
        },
      });
    }
  } catch (e) {
    console.error("[POST /api/ai/analyze-brand-visual]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
