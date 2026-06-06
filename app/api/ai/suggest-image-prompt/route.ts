// Génère un PROMPT d'image professionnel (en anglais, optimisé pour les modèles
// text-to-image) à partir d'un brief court + du contexte de marque. C'est le
// « prompt généré par l'IA » qui alimente ensuite l'IA d'image.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { isAiConfigured, env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const { companyId, brief, format, kind } = (await req.json()) as {
      companyId?: string; brief?: string; format?: string; kind?: string;
    };
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

    const fallback = [
      (brief || `professional ${kind || "poster"} for ${name || "the brand"}`).trim(),
      "high-end advertising visual, clean composition, strong focal point, premium lighting,",
      "ample negative space for headline text, modern color grading, photorealistic, 4k, sharp.",
    ].join(" ");

    if (!isAiConfigured) return NextResponse.json({ prompt: fallback, aiGenerated: false });

    const meta = `Tu es directeur artistique. Rédige UN SEUL prompt en ANGLAIS pour un modèle text-to-image (Flux/Ideogram/Imagen), destiné à créer un visuel ${kind || "affiche"} PROFESSIONNEL${format ? ` au format ${format}` : ""}.
Marque : ${name || "(non précisée)"}${voice ? ` — voix : ${voice}` : ""}${positioning ? ` — positionnement : ${positioning}` : ""}.
Demande de l'utilisateur : "${brief || "(libre)"}".

Contraintes du prompt :
- décris la SCÈNE, le style, la lumière, la composition, la palette ;
- prévois un ESPACE NÉGATIF pour le titre (le texte sera ajouté ensuite, n'inclus PAS de texte dans l'image) ;
- qualité publicitaire haut de gamme, photoréaliste ou design selon le besoin.
Réponds UNIQUEMENT par le prompt (une à trois phrases, en anglais), sans guillemets ni préface.`;

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: env.anthropicKey });
      const res = await client.messages.create({
        model: env.anthropicModel,
        max_tokens: 400,
        messages: [{ role: "user", content: meta }],
      });
      const text = res.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("").trim();
      return NextResponse.json({ prompt: text || fallback, aiGenerated: Boolean(text) });
    } catch {
      return NextResponse.json({ prompt: fallback, aiGenerated: false });
    }
  } catch (e) {
    console.error("[POST /api/ai/suggest-image-prompt]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
