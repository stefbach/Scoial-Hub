// Génère un PROMPT d'image professionnel (dans la langue de l'UI si `language`
// est fourni, sinon anglais — optimisé pour les modèles text-to-image) à partir
// d'un brief court + du contexte de marque. C'est le « prompt généré par l'IA »
// qui alimente ensuite l'IA d'image.
//
// Option `wantCopy` : en plus du prompt visuel, génère aussi un titre et un
// sous-titre (texte de l'affiche) — pour les studios qui affichent du texte
// sur le visuel (Studio Affiches). Rétrocompatible : sans ce paramètre, la
// réponse reste { prompt } comme avant.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { isAiConfigured, env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const { companyId, brief, format, kind, language, wantCopy } = (await req.json()) as {
      companyId?: string; brief?: string; format?: string; kind?: string;
      /** Langue de l'UI ("fr" | "en") — optionnelle : sans elle, anglais comme avant. */
      language?: string;
      /** Si vrai, renvoie aussi { headline, subtitle } en plus du prompt. */
      wantCopy?: boolean;
    };
    const wantFr = language === "fr";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    let name = "", voice = "", positioning = "";
    try {
      const uuid = await resolveCompanyUuid(companyId);
      const sb = createAdminClient();
      if (sb) {
        const { data: c } = await sb.from("sh_companies").select("name, brand_voice").eq("id", uuid).maybeSingle();
        if (c) { name = String(c.name ?? ""); voice = String(c.brand_voice ?? ""); }
        const { data: p } = await sb.from("sh_brand_profiles").select("positioning, summary").eq("company_id", uuid).maybeSingle();
        if (p) positioning = String(p.positioning ?? p.summary ?? "");
      }
    } catch { /* dégradation */ }

    const fallback = wantFr
      ? [
          (brief || `${kind || "affiche"} professionnelle pour ${name || "la marque"}`).trim(),
          "visuel publicitaire haut de gamme, composition épurée, point focal fort, lumière premium,",
          "large espace négatif pour le titre, étalonnage moderne, photoréaliste, 4k, net.",
        ].join(" ")
      : [
          (brief || `professional ${kind || "poster"} for ${name || "the brand"}`).trim(),
          "high-end advertising visual, clean composition, strong focal point, premium lighting,",
          "ample negative space for headline text, modern color grading, photorealistic, 4k, sharp.",
        ].join(" ");

    if (!isAiConfigured) {
      return NextResponse.json(
        wantCopy
          ? { prompt: fallback, headline: (brief || "").trim().slice(0, 60), subtitle: "", aiGenerated: false }
          : { prompt: fallback, aiGenerated: false }
      );
    }

    const copyInstructions = wantCopy
      ? `\n- rédige aussi un TITRE (5 mots max, percutant) et un SOUS-TITRE (10 mots max, optionnel) pour ce visuel, dans la langue demandée.
Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour, pas de bloc \`\`\`) :
{"prompt":"le prompt image (en ${wantFr ? "français" : "anglais"})","headline":"titre court (en ${wantFr ? "français" : "anglais"})","subtitle":"sous-titre court, ou chaîne vide"}`
      : `Réponds UNIQUEMENT par le prompt (une à trois phrases, en ${wantFr ? "français" : "anglais"}), sans guillemets ni préface.`;

    const meta = `Tu es directeur artistique. Rédige UN SEUL prompt en ${wantFr ? "FRANÇAIS" : "ANGLAIS"} pour un modèle text-to-image (Flux/Ideogram/Imagen), destiné à créer un visuel ${kind || "affiche"} PROFESSIONNEL${format ? ` au format ${format}` : ""}.
Marque : ${name || "(non précisée)"}${voice ? ` — voix : ${voice}` : ""}${positioning ? ` — positionnement : ${positioning}` : ""}.
Demande de l'utilisateur : "${brief || "(libre)"}".

Contraintes du prompt :
- décris la SCÈNE, le style, la lumière, la composition, la palette ;
- prévois un ESPACE NÉGATIF pour le titre (le texte sera ajouté ensuite, n'inclus PAS de texte dans l'image) ;
- qualité publicitaire haut de gamme, photoréaliste ou design selon le besoin.${copyInstructions}`;

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const { createClaudeMessage } = await import("@/lib/ai/anthropic");
      const client = new Anthropic({ apiKey: env.anthropicKey });
      const res = await createClaudeMessage(client, {
        model: env.anthropicModel,
        max_tokens: 400,
        messages: [{ role: "user", content: meta }],
      });
      const text = res.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("").trim();
      if (wantCopy) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const p = JSON.parse(match[0]) as { prompt?: string; headline?: string; subtitle?: string };
            return NextResponse.json({
              prompt: p.prompt || fallback,
              headline: p.headline || "",
              subtitle: p.subtitle || "",
              aiGenerated: true,
            });
          } catch { /* JSON invalide → repli ci-dessous */ }
        }
        return NextResponse.json({ prompt: text || fallback, headline: "", subtitle: "", aiGenerated: Boolean(text) });
      }
      return NextResponse.json({ prompt: text || fallback, aiGenerated: Boolean(text) });
    } catch {
      return NextResponse.json(
        wantCopy ? { prompt: fallback, headline: "", subtitle: "", aiGenerated: false } : { prompt: fallback, aiGenerated: false }
      );
    }
  } catch (e) {
    console.error("[POST /api/ai/suggest-image-prompt]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
