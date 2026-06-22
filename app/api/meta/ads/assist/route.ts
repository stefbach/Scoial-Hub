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
  name: string;
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

interface ChatMsg { role: "user" | "assistant"; content: string }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string; brief?: string; messages?: ChatMsg[]; language?: "fr" | "en" };
    const companyId = body.companyId;
    // Conversation : on accepte une liste de messages OU un brief unique (legacy).
    const messages: ChatMsg[] = Array.isArray(body.messages) && body.messages.length
      ? body.messages
      : body.brief?.trim()
      ? [{ role: "user", content: body.brief.trim() }]
      : [];
    if (!companyId || messages.length === 0) return NextResponse.json({ error: "companyId et message requis" }, { status: 400 });
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
    const transcript = messages.map((m) => `${m.role === "user" ? "UTILISATEUR" : "ASSISTANT"} : ${m.content}`).join("\n");

    const prompt = `${body.language === "en"
      ? "CRITICAL: The user's language is ENGLISH. You MUST write everything you output — \"reply\" and ALL ad copy (primaryText, headline, cta, variants…) — in ENGLISH ONLY, even though these instructions are in French. Never answer in French."
      : "IMPORTANT : La langue de l'utilisateur est le FRANÇAIS. Rédige tout en français."}

Tu es un media buyer Meta (Facebook/Instagram) senior et pédagogue. Tu construis une campagne AVEC l'utilisateur via une conversation. Date du jour : ${today}.

MARQUE : ${brandName || "(non précisée)"}${brandVoice ? ` — voix : ${brandVoice}` : ""}${site ? ` — site : ${site}` : ""}

CONVERSATION JUSQU'ICI :
${transcript}

TA MISSION :
- S'il MANQUE une information ESSENTIELLE pour une campagne pertinente (objectif/intention, budget approximatif, zone géographique, et — pour des prospects — la destination ou l'usage d'un formulaire), pose UNE seule question courte et claire (done=false). Une question à la fois.
- Pour tout le reste, fais des HYPOTHÈSES intelligentes (âge, intérêts, placements auto, textes) — n'embête pas l'utilisateur avec des détails secondaires.
- Dès que tu as l'essentiel, renvoie le PLAN COMPLET (done=true) et un court récap.

RÈGLES MÉTA :
- "adType"="lead" si collecte de contacts via formulaire, sinon "traffic".
- "objective" ∈ ["notoriété","trafic","engagement","ventes","conversions"] (ignoré si lead).
- Budget réaliste. "budgetType" "daily" (+"dailyBudget" EUR) ou "lifetime" (+"lifetimeBudget"+"endDate").
- Ciblage : "countries" (ISO2), "gender", "ageMin","ageMax", "interestKeywords" (3-6, en anglais), "placement" "auto" par défaut.
- Créative : "primaryText" conforme (santé = langage mesuré, pas de promesses trompeuses ni d'attributs personnels interdits), "headline" court, "cta" (LEARN_MORE/SIGN_UP/CONTACT_US/SHOP_NOW…), "link" (site marque si utile), "visualPrompt" (anglais, sans texte incrusté), "variants" (1-2).
- Lead : "leadForm" { formName, privacyUrl, intro, fields ⊂ ["FULL_NAME","EMAIL","PHONE"], thankYouTitle, thankYouBody }.
- Ventes/conversions : "conversionEvent" ∈ ["LEAD","PURCHASE","COMPLETE_REGISTRATION","CONTACT","ADD_TO_CART","SCHEDULE"].
- Pas de ciblage par état de santé (interdit Meta).

Réponds STRICTEMENT en JSON :
{
 "done": true|false,
 "reply": "ta question (si done=false) OU un court récap du plan (si done=true)",
 "plan": null | {
   "name":"nom court et clair de la campagne",
   "adType","objective","budgetType","dailyBudget","lifetimeBudget","startDate","endDate",
   "countries":[],"gender","ageMin","ageMax","interestKeywords":[],"placement",
   "primaryText","headline","cta","link","visualPrompt","variants":[],
   "conversionEvent","leadForm":{...}|null,"rationale":""
 }
}

${body.language === "en" ? "REMINDER: write \"reply\" and ALL ad copy (primaryText, headline, cta…) in ENGLISH ONLY." : "RAPPEL : rédige \"reply\" et tous les textes de l'annonce en français."}`;

    const result = await callClaudeJSON<{ done?: boolean; reply?: string; plan?: AdPlan | null }>(prompt, { maxTokens: 1900 });
    if (!result) return NextResponse.json({ error: "L'IA n'a pas pu répondre. Reformulez." }, { status: 502 });

    const done = Boolean(result.done && result.plan);
    const plan = done ? result.plan! : null;

    // Résout les intérêts en vrais ids Meta quand le plan est finalisé.
    if (plan && ctx.userToken && Array.isArray(plan.interestKeywords) && plan.interestKeywords.length) {
      plan.interests = await resolveInterests(plan.interestKeywords, ctx.userToken);
    }

    return NextResponse.json({
      done,
      reply: result.reply || (done ? "Voici votre campagne." : "Pouvez-vous préciser ?"),
      plan,
    });
  } catch (e) {
    console.error("[POST /api/meta/ads/assist]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
