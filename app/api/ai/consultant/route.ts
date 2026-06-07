// POST /api/ai/consultant  { companyId, messages, lock?, dna? }
// « Consultant IA » : un vrai stratège de marque qui DISCUTE avec le client
// pour construire — puis verrouiller — l'ADN de la marque (positionnement,
// mission, valeurs, message clé, personnalité, ton, audience, direction
// artistique) AVANT le démarrage guidé. Comportement de consultant senior :
// une question à la fois, des hypothèses intelligentes, des propositions de
// directions visuelles à tester. Quand le client valide (lock=true), l'ADN est
// persisté dans le profil de marque et sert de socle à toute la suite.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getBrandProfile, saveBrandProfile } from "@/lib/repositories/onboarding";
import { getBrandKit } from "@/lib/repositories/brand-kit";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";
import { BrandProfile, makeEmptyBrandProfile } from "@/lib/onboarding/types";

interface ChatMsg { role: "user" | "assistant"; content: string }

/** Champs d'ADN que l'IA renvoie/met à jour à chaque tour. */
interface BrandDna {
  summary?: string;
  positioning?: string;
  mission?: string;
  values?: string[];
  keyMessage?: string;
  personality?: string[];
  tone?: string;
  audience?: string;
  themes?: string[];
  visualDirection?: string;
  keywords?: string[];
}

interface ConsultantResult {
  reply?: string;
  readyToLock?: boolean;
  dna?: BrandDna;
  /** 0-3 prompts d'image EN ANGLAIS (sans texte incrusté) pour tester la direction artistique. */
  visualPrompts?: string[];
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];

/** Fusionne un ADN partiel dans un profil : n'écrase jamais avec du vide. */
function mergeDna(profile: BrandProfile, dna: BrandDna | undefined): BrandProfile {
  if (!dna) return profile;
  const pick = (cur: string, next?: unknown) => (str(next) ? str(next) : cur);
  const pickArr = (cur: string[], next?: unknown) => (arr(next).length ? arr(next) : cur);
  return {
    ...profile,
    summary: pick(profile.summary, dna.summary),
    positioning: pick(profile.positioning, dna.positioning),
    mission: pick(profile.mission, dna.mission),
    keyMessage: pick(profile.keyMessage, dna.keyMessage),
    tone: pick(profile.tone, dna.tone),
    audience: pick(profile.audience, dna.audience),
    visualDirection: pick(profile.visualDirection, dna.visualDirection),
    values: pickArr(profile.values, dna.values),
    personality: pickArr(profile.personality, dna.personality),
    themes: pickArr(profile.themes, dna.themes),
    keywords: pickArr(profile.keywords, dna.keywords),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      messages?: ChatMsg[];
      lock?: boolean;
      dna?: BrandDna;
    };
    const companyId = body.companyId;
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const existing = (await getBrandProfile(companyId)) ?? makeEmptyBrandProfile(companyId);

    // ── Verrouillage : on persiste l'ADN comme socle de marque ───────────────
    if (body.lock) {
      const merged = mergeDna(existing, body.dna);
      const profile: BrandProfile = {
        ...merged,
        companyId,
        philosophyLocked: true,
        aiGenerated: true,
        analyzedAt: new Date().toISOString(),
      };
      await saveBrandProfile(profile);
      return NextResponse.json({ locked: true, profile });
    }

    // ── Tour de conversation ─────────────────────────────────────────────────
    const messages: ChatMsg[] = Array.isArray(body.messages) ? body.messages.filter((m) => str(m?.content)) : [];
    if (!isAiConfigured) {
      return NextResponse.json(
        { error: "IA non configurée (ANTHROPIC_API_KEY)." },
        { status: 503 }
      );
    }

    // Contexte marque connu (nom + voix + kit visuel éventuel).
    let brandName = "";
    let brandVoice = "";
    try {
      const uuid = await resolveCompanyUuid(companyId);
      const sb = createAdminClient();
      if (sb) {
        const { data } = await sb
          .from("sh_companies")
          .select("name, brand_voice")
          .eq("id", uuid)
          .maybeSingle();
        if (data) {
          brandName = String(data.name ?? "");
          brandVoice = String(data.brand_voice ?? "");
        }
      }
    } catch { /* ignore */ }

    const kit = await getBrandKit(companyId).catch(() => null);
    const known = {
      positioning: existing.positioning,
      mission: existing.mission,
      values: existing.values,
      keyMessage: existing.keyMessage,
      personality: existing.personality,
      tone: existing.tone,
      audience: existing.audience,
      themes: existing.themes,
      visualDirection: existing.visualDirection,
      website: existing.website,
    };

    const transcript = messages.length
      ? messages.map((m) => `${m.role === "user" ? "CLIENT" : "CONSULTANT"} : ${m.content}`).join("\n")
      : "(la conversation commence)";

    const prompt = `Tu es un directeur de marque (brand strategist) senior, à la fois stratège et directeur artistique, chaleureux et incisif. Tu mènes un entretien de découverte de marque comme un VRAI consultant : tu écoutes, tu reformules, tu challenges gentiment, tu proposes. Ton objectif : co-construire avec le client l'ADN de sa marque AVANT qu'il ne lance ses campagnes, puis le verrouiller.

MARQUE : ${brandName || "(nom non précisé)"}${brandVoice ? ` — voix déclarée : ${brandVoice}` : ""}
${kit?.summary ? `IDENTITÉ VISUELLE CONNUE : ${kit.summary}` : ""}
CE QUI EST DÉJÀ CONNU (à enrichir, ne pas redemander si déjà rempli) :
${JSON.stringify(known, null, 2)}

CONVERSATION :
${transcript}

MÉTHODE (comportement) :
- Au tout début (conversation qui commence), accueille brièvement et pose UNE première question ouverte et inspirante sur l'essence de la marque (sa raison d'être, ce qui la rend unique, à qui elle s'adresse).
- Ensuite, UNE question à la fois, courte et concrète. Rebondis sur ce que le client vient de dire (montre que tu écoutes). Propose des hypothèses ("Je sens quelque chose comme… c'est juste ?") plutôt que des questionnaires froids.
- Couvre progressivement : raison d'être/mission, public cible, promesse/positionnement, LE message clé à faire passer, valeurs, personnalité de marque, ton de voix, univers visuel (style, couleurs, ambiance, matières, lumière).
- Dès que tu as une direction visuelle assez claire, propose 1 à 3 "visualPrompts" (en ANGLAIS, photographiques/cinématographiques, SANS texte incrusté) pour que le client TESTE l'identité en images. Renouvelle/affine-les quand la direction évolue.
- Mets à jour "dna" à CHAQUE tour avec tout ce que tu as compris (même partiel). N'invente pas : laisse vide ce que tu ignores encore.
- Quand l'ADN est suffisamment riche et cohérent (mission + cible + positionnement + message clé + ton + direction visuelle au minimum), passe "readyToLock" à true et invite le client à verrouiller la philosophie de marque.

STYLE DE RÉPONSE : "reply" est ta prise de parole, naturelle, humaine, en français, 1 à 4 phrases. Pas de listes à puces froides dans "reply".

Réponds STRICTEMENT en JSON, sans texte autour :
{
  "reply": "ta prise de parole de consultant",
  "readyToLock": true|false,
  "dna": {
    "summary": "synthèse 2-3 phrases de qui est la marque",
    "positioning": "", "mission": "", "keyMessage": "",
    "values": [], "personality": [], "tone": "",
    "audience": "", "themes": [], "visualDirection": "mots-clés FR de direction artistique", "keywords": []
  },
  "visualPrompts": ["english art-direction image prompt", "..."]
}`;

    const result = await callClaudeJSON<ConsultantResult>(prompt, { maxTokens: 1600, temperature: 0.8 });
    if (!result) {
      return NextResponse.json(
        { error: "Le consultant IA n'a pas pu répondre. Reformulez ou réessayez." },
        { status: 502 }
      );
    }

    // Sauvegarde du brouillon d'ADN (sans verrouiller) pour reprise ultérieure.
    const draft = mergeDna(existing, result.dna);
    if (messages.length) {
      // On ne marque PAS analyzedAt : la philosophie n'est pas encore verrouillée.
      await saveBrandProfile({ ...draft, companyId, philosophyLocked: false }).catch(() => {});
    }

    return NextResponse.json({
      reply: str(result.reply) || "Parlez-moi de votre marque : qu'est-ce qui la rend unique ?",
      readyToLock: Boolean(result.readyToLock),
      dna: result.dna ?? {},
      visualPrompts: arr(result.visualPrompts).slice(0, 3),
    });
  } catch (e) {
    console.error("[POST /api/ai/consultant]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
