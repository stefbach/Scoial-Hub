// POST /api/meta/ads/assist  { companyId, brief }
// « Assistant pub » : à partir d'un brief en langage naturel + du contexte de
// marque + du compte Meta, l'IA produit un PLAN DE CAMPAGNE complet et conforme
// aux règles Meta (objectif, budget, ciblage, créative, formulaire…), qui
// pré-remplit l'écran de création. Les centres d'intérêt sont résolus en vrais
// ids Meta (Graph adinterest). Aucune publication ici — uniquement le plan.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { getMetaContext } from "@/lib/connectors/meta-pages";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";

const V = process.env.META_API_VERSION ?? "v21.0";

interface AdPlan {
  adType: "traffic" | "lead";
  objective: string;
  budgetType: "daily" | "lifetime";
  dailyBudget?: number;
  lifetimeBudget?: number;
  startDate?: string;
  endDate?: string;
  countries: string[];
  gender: "all" | "male" | "female";
  ageMin: number;
  ageMax: number;
  interestKeywords?: string[];
  interests?: { id: string; name: string }[];
  placement: "auto" | "manual";
  primaryText: string;
  headline: string;
  cta: string;
  link: string;
  visualPrompt: string;
  variants: string[];
  conversionEvent?: string;
  leadForm?: { formName: string; privacyUrl: string; intro?: string; fields: string[]; thankYouTitle?: string; thankYouBody?: string };
  rationale: string;
}

async function resolveInterests(keywords: string[], token: string): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  for (const kw of keywords.slice(0, 6)) {
    try {
      const url = `https://graph.facebook.com/${V}/search?type=adinterest&q=${encodeURIComponent(kw)}&limit=1&access_token=${encodeURIComponent(token)}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as { data?: Array<{ id?: string; name?: string }> };
      const top = j.data?.[0];
      if (top?.id && top?.name && !out.some((x) => x.id === top.id)) out.push({ id: String(top.id), name: String(top.name) });
    } catch { /* ignore */ }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, brief } = (await req.json()) as { companyId?: string; brief?: string };
    if (!companyId || !brief?.trim()) return NextResponse.json({ error: "companyId et brief requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });
    if (!isAiConfigured) return NextResponse.json({ error: "IA non configurée (ANTHROPIC_API_KEY)." }, { status: 503 });

    // Contexte marque + compte.
    let brandName = "", brandVoice = "";
    const site = "";
    try {
      const uuid = await resolveCompanyUuid(companyId);
      const sb = createAdminClient();
      if (sb) {
        const { data } = await sb.from("sh_companies").select("name, brand_voice").eq("id", uuid).maybeSingle();
        if (data) { brandName = String(data.name ?? ""); brandVoice = String(data.brand_voice ?? ""); }
      }
    } catch { /* ignore */ }

    const ctx = await getMetaContext(companyId);
    const today = new Date().toISOString().slice(0, 10);

    const prompt = `Tu es un media buyer Meta (Facebook/Instagram) senior. À partir du BRIEF, produis un PLAN DE CAMPAGNE complet, précis et CONFORME aux règles Meta, prêt à pré-remplir un formulaire de création. Date du jour : ${today}.

MARQUE : ${brandName || "(non précisée)"}${brandVoice ? ` — voix : ${brandVoice}` : ""}${site ? ` — site : ${site}` : ""}

BRIEF DE L'UTILISATEUR :
"""${brief}"""

RÈGLES :
- "adType" = "lead" si l'objectif est de collecter des contacts/prospects via formulaire, sinon "traffic".
- "objective" ∈ ["notoriété","trafic","engagement","ventes","conversions"] (ignoré si adType="lead").
- Budget : propose un montant réaliste. "budgetType" "daily" (défaut) avec "dailyBudget" en EUR, ou "lifetime" avec "lifetimeBudget" + "endDate".
- Ciblage : "countries" (codes ISO2), "gender" ("all"/"male"/"female"), "ageMin","ageMax". "interestKeywords" : 3 à 6 intérêts pertinents (en anglais de préférence pour le matching Meta). "placement" "auto" sauf demande contraire.
- Créative : "primaryText" (accrocheur, conforme — pas de promesses médicales trompeuses ni d'attributs personnels interdits par Meta), "headline" court, "cta" (un type Meta : LEARN_MORE, SIGN_UP, BOOK_TRAVEL, CONTACT_US, SHOP_NOW…), "link" (utilise le site de la marque si pertinent, sinon laisse vide), "visualPrompt" (prompt EN ANGLAIS pour générer un visuel pro, sans texte incrusté), "variants" (1 à 2 textes alternatifs pour test A/B).
- Si adType="lead" : remplis "leadForm" { formName, privacyUrl (utilise le site/мarque, sinon laisse vide), intro, fields (sous-ensemble de ["FULL_NAME","EMAIL","PHONE"]), thankYouTitle, thankYouBody }.
- Si objectif "conversions"/"ventes" et pertinent : "conversionEvent" ∈ ["LEAD","PURCHASE","COMPLETE_REGISTRATION","CONTACT","ADD_TO_CART","SCHEDULE"].
- Secteur régulé (santé) : langage mesuré, pas de ciblage par état de santé (interdit Meta).

Réponds STRICTEMENT en JSON :
{
 "adType","objective","budgetType","dailyBudget","lifetimeBudget","startDate","endDate",
 "countries":[],"gender","ageMin","ageMax","interestKeywords":[],"placement",
 "primaryText","headline","cta","link","visualPrompt","variants":[],
 "conversionEvent","leadForm":{...} ou null,
 "rationale":"2-3 phrases expliquant les choix"
}`;

    const plan = await callClaudeJSON<AdPlan>(prompt, { maxTokens: 1800 });
    if (!plan) return NextResponse.json({ error: "L'IA n'a pas pu produire de plan. Reformulez le brief." }, { status: 502 });

    // Résout les intérêts en vrais ids Meta si un token est disponible.
    if (ctx.userToken && Array.isArray(plan.interestKeywords) && plan.interestKeywords.length) {
      plan.interests = await resolveInterests(plan.interestKeywords, ctx.userToken);
    }

    return NextResponse.json({ plan });
  } catch (e) {
    console.error("[POST /api/meta/ads/assist]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
