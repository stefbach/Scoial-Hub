import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getMemoryContext } from "@/lib/memory";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Strategy {
  positioning: string;
  cadence: string;
  angles: string[];
  postIdeas: { title: string; hook: string }[];
  dos: string[];
  donts: string[];
  aiGenerated: boolean;
}

// POST /api/linkedin/strategy { companyId } → stratégie de contenu LinkedIn.
export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json();
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const uuid = await resolveCompanyUuid(companyId);
    let name = "", voice = "", positioning = "", audience = "", themes: string[] = [];
    try {
      const sb = createAdminClient();
      if (sb) {
        const { data: c } = await sb.from("sh_companies").select("name, brand_voice").eq("id", uuid).maybeSingle();
        if (c) { name = String(c.name ?? ""); voice = String(c.brand_voice ?? ""); }
        const { data: p } = await sb.from("sh_brand_profiles").select("positioning, audience, themes, summary").eq("company_id", uuid).maybeSingle();
        if (p) {
          positioning = String(p.positioning ?? p.summary ?? "");
          audience = String(p.audience ?? "");
          themes = Array.isArray(p.themes) ? (p.themes as string[]) : [];
        }
      }
    } catch { /* dégradation */ }
    const memory = await getMemoryContext(companyId, 10).catch(() => "");

    const empty: Strategy = {
      positioning: positioning || `Stratégie LinkedIn pour ${name || "votre marque"}.`,
      cadence: "2–3 publications/semaine, en semaine, 8h–10h.",
      angles: themes.length ? themes.slice(0, 5) : ["Expertise", "Coulisses", "Cas client", "Tendances", "Conseils pratiques"],
      postIdeas: [],
      dos: ["Apporter de la valeur avant de vendre", "Accroche forte en 1re ligne", "Format aéré, une idée par paragraphe"],
      donts: ["Jargon creux", "Promesses non étayées", "Trop de hashtags"],
      aiGenerated: false,
    };

    if (!isAiConfigured) return NextResponse.json({ strategy: empty });

    const prompt = `Tu es directeur de la stratégie LinkedIn B2B. Élabore une stratégie de contenu LinkedIn pour « ${name || "la marque"} ».
${voice ? `Voix de marque : ${voice}` : ""}
${positioning ? `Positionnement : ${positioning}` : ""}
${audience ? `Audience : ${audience}` : ""}
${themes.length ? `Thèmes : ${themes.join(", ")}` : ""}
${memory ? `Mémoire stratégique :\n${memory}` : ""}

Retourne STRICTEMENT ce JSON :
{
  "positioning": "1-2 phrases : l'angle d'autorité unique sur LinkedIn",
  "cadence": "rythme et créneaux recommandés",
  "angles": ["4-6 piliers éditoriaux"],
  "postIdeas": [{"title":"idée de post","hook":"accroche 1re ligne"}],
  "dos": ["3-5 bonnes pratiques"],
  "donts": ["3-5 erreurs à éviter"]
}
Max 6 idées de posts. Base-toi sur le contexte fourni.`;

    const parsed = await callClaudeJSON<Partial<Strategy>>(prompt, { maxTokens: 1600 });
    if (!parsed) return NextResponse.json({ strategy: empty });

    return NextResponse.json({
      strategy: {
        positioning: parsed.positioning ?? empty.positioning,
        cadence: parsed.cadence ?? empty.cadence,
        angles: (parsed.angles ?? empty.angles).slice(0, 6),
        postIdeas: (parsed.postIdeas ?? []).slice(0, 6),
        dos: (parsed.dos ?? empty.dos).slice(0, 5),
        donts: (parsed.donts ?? empty.donts).slice(0, 5),
        aiGenerated: true,
      } satisfies Strategy,
    });
  } catch (e) {
    console.error("[POST /api/linkedin/strategy]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
