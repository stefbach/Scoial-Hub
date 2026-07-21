// POST /api/ai/consultant  { companyId, messages, lock?, reset?, dna? }
// « Consultant IA » : un directeur de marque senior qui MÈNE un véritable
// entretien stratégique pour construire — puis verrouiller — l'ADN de la marque
// AVANT le démarrage guidé. Il S'APPUIE sur la mémoire stratégique (RAG :
// veille, pubs, Page, agents) ET réinjecte tout ce qu'il en tire et conseille
// DANS le RAG, afin que toute la suite (contenus, campagnes) en bénéficie.
// Il définit une stratégie DISTINCTE par réseau (Instagram/Facebook/TikTok/
// LinkedIn) — chacun a ses codes. Au verrouillage (lock=true), l'ADN + les
// stratégies réseau sont persistés dans le profil de marque et écrits en mémoire.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getBrandProfile, saveBrandProfile } from "@/lib/repositories/onboarding";
import { getBrandKit } from "@/lib/repositories/brand-kit";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { getMemoryContext, appendMemory, type MemoryEntry, type MemoryKind } from "@/lib/memory";
import { isAiConfigured } from "@/lib/env";
import {
  BrandProfile,
  NetworkStrategy,
  SocialNetwork,
  ALL_NETWORKS,
  makeEmptyBrandProfile,
} from "@/lib/onboarding/types";

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
  networkStrategies?: NetworkStrategy[];
}

/** Note à mémoriser dans le RAG (ce que le consultant récupère/conseille). */
interface MemoryNote {
  kind?: string;
  title?: string;
  content?: string;
  network?: string;
}

interface ConsultantResult {
  reply?: string;
  readyToLock?: boolean;
  dna?: BrandDna;
  /** 0-3 prompts d'image EN ANGLAIS (sans texte incrusté) pour tester la direction artistique. */
  visualPrompts?: string[];
  /** Insights/recommandations à écrire dans la mémoire stratégique (RAG). */
  memoryNotes?: MemoryNote[];
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];

const MEMORY_KINDS: MemoryKind[] = [
  "insight", "format", "angle", "competitor", "keyword", "recommendation", "brief",
];
const coerceKind = (v: unknown): MemoryKind =>
  MEMORY_KINDS.includes(v as MemoryKind) ? (v as MemoryKind) : "recommendation";

function coerceNetwork(v: unknown): SocialNetwork | null {
  const s = str(v).toLowerCase();
  return (ALL_NETWORKS as string[]).includes(s) ? (s as SocialNetwork) : null;
}

/** Valide/normalise les stratégies réseau renvoyées par l'IA. */
function coerceNetStrats(v: unknown): NetworkStrategy[] {
  if (!Array.isArray(v)) return [];
  const out: NetworkStrategy[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const network = coerceNetwork(o.network);
    if (!network || out.some((s) => s.network === network)) continue;
    out.push({
      network,
      angle: str(o.angle),
      formats: arr(o.formats),
      tone: str(o.tone),
      contentPillars: arr(o.contentPillars),
      cadence: str(o.cadence),
      cta: str(o.cta),
    });
  }
  return out;
}

/** Fusionne les stratégies réseau : remplace celles fournies, conserve les autres. */
function mergeNetStrats(cur: NetworkStrategy[], next: NetworkStrategy[]): NetworkStrategy[] {
  if (!next.length) return cur;
  const byNet = new Map<SocialNetwork, NetworkStrategy>();
  for (const s of cur) byNet.set(s.network, s);
  for (const s of next) byNet.set(s.network, s);
  return Array.from(byNet.values());
}

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
    networkStrategies: mergeNetStrats(
      profile.networkStrategies ?? [],
      coerceNetStrats(dna.networkStrategies)
    ),
  };
}

/** Écrit dans le RAG l'ADN verrouillé + les stratégies réseau (socle réutilisé partout). */
async function persistDnaToMemory(companyId: string, p: BrandProfile): Promise<void> {
  const entries: MemoryEntry[] = [];
  const adn = [
    p.positioning && `Positionnement : ${p.positioning}`,
    p.mission && `Mission : ${p.mission}`,
    p.keyMessage && `Message clé : ${p.keyMessage}`,
    p.audience && `Cible : ${p.audience}`,
    p.tone && `Ton de voix : ${p.tone}`,
    p.values?.length && `Valeurs : ${p.values.join(", ")}`,
    p.personality?.length && `Personnalité : ${p.personality.join(", ")}`,
    p.visualDirection && `Direction artistique : ${p.visualDirection}`,
  ].filter(Boolean).join("\n");
  if (adn) {
    entries.push({ source: "manual", kind: "brief", title: "ADN de marque (verrouillé)", content: adn, score: 4, tags: ["adn", "identité"] });
  }
  for (const s of p.networkStrategies ?? []) {
    const body = [
      s.angle && `Angle : ${s.angle}`,
      s.formats?.length && `Formats : ${s.formats.join(", ")}`,
      s.tone && `Ton : ${s.tone}`,
      s.contentPillars?.length && `Piliers : ${s.contentPillars.join(", ")}`,
      s.cadence && `Rythme : ${s.cadence}`,
      s.cta && `CTA : ${s.cta}`,
    ].filter(Boolean).join("\n");
    if (body) {
      entries.push({ source: "manual", kind: "angle", title: `Stratégie ${s.network}`, content: body, score: 3, tags: [s.network, "stratégie-réseau"] });
    }
  }
  if (entries.length) await appendMemory(companyId, entries).catch(() => {});
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      messages?: ChatMsg[];
      lock?: boolean;
      reset?: boolean;
      dna?: BrandDna;
      language?: "fr" | "en";
    };
    const companyId = body.companyId;
    const lang: "fr" | "en" = body.language === "en" ? "en" : "fr";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const existing = (await getBrandProfile(companyId)) ?? makeEmptyBrandProfile(companyId);

    // ── Remise à zéro : on efface l'ADN/philosophie (rien n'est figé) ────────
    if (body.reset) {
      const profile: BrandProfile = {
        ...existing,
        summary: "",
        positioning: "",
        mission: "",
        keyMessage: "",
        tone: "",
        audience: "",
        visualDirection: "",
        values: [],
        personality: [],
        themes: [],
        networkStrategies: [],
        philosophyLocked: false,
        analyzedAt: null,
      };
      await saveBrandProfile(profile);
      return NextResponse.json({ reset: true, profile });
    }

    // ── Verrouillage : on persiste l'ADN comme socle + on l'écrit dans le RAG ─
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
      await persistDnaToMemory(companyId, profile);
      return NextResponse.json({ locked: true, profile });
    }

    // ── Tour de conversation ─────────────────────────────────────────────────
    const messages: ChatMsg[] = Array.isArray(body.messages) ? body.messages.filter((m) => str(m?.content)) : [];
    if (!isAiConfigured) {
      return NextResponse.json(
        {
          error: lang === "en"
            ? "AI not configured (ANTHROPIC_API_KEY)."
            : "IA non configurée (ANTHROPIC_API_KEY).",
        },
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
    // RAG : mémoire stratégique accumulée (veille, pubs, Page, agents…).
    // Contexte allégé (12) pour réduire la latence des tours de conversation.
    const memoryContext = await getMemoryContext(companyId, 12).catch(() => "");

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
      networkStrategies: existing.networkStrategies,
      website: existing.website,
    };

    const transcript = messages.length
      ? messages.map((m) => `${m.role === "user" ? "CLIENT" : "CONSULTANT"} : ${m.content}`).join("\n")
      : "(la conversation commence)";

    const prompt = `# RÔLE
Tu es Directeur·rice de Marque (Chief Brand Officer) de niveau international : à la fois stratège de marque, planneur stratégique et directeur artistique. Tu as accompagné des marques premium et des startups. Tu es chaleureux·se, lucide et exigeant·e — tu écoutes vraiment, tu reformules, tu challenges avec tact, et tu apportes une vraie valeur de conseil à chaque prise de parole. Tu ne fais JAMAIS de remplissage générique : chaque phrase est spécifique à CETTE marque.

# MISSION
Mener un entretien de découverte de marque avec le CLIENT pour co-construire, puis verrouiller, l'ADN de la marque AVANT le lancement des campagnes : raison d'être, public, positionnement, message clé, valeurs, personnalité, ton, univers visuel — ET une stratégie social media DISTINCTE par réseau.

# CONTEXTE MARQUE
Nom : ${brandName || "(non précisé)"}${brandVoice ? `\nVoix déclarée : ${brandVoice}` : ""}
${kit?.summary ? `Identité visuelle connue : ${kit.summary}` : ""}
${kit?.chart?.palette?.length ? `Palette : ${kit.chart.palette.map((c) => c.hex).join(", ")}` : ""}

# CE QUI EST DÉJÀ CONNU (enrichir, ne PAS redemander si rempli)
${JSON.stringify(known, null, 2)}

# MÉMOIRE STRATÉGIQUE — RAG (veille concurrents, pubs, Page, agents)
${memoryContext ? memoryContext : "(mémoire vide pour l'instant — elle se construira au fil des analyses)"}
→ EXPLOITE cette mémoire : appuie tes hypothèses et recommandations sur ces insights réels (concurrents, formats gagnants, angles, audience). Cite-les quand c'est pertinent ("vu la veille, le format X performe chez vos concurrents…").

# CONVERSATION
${transcript}

# MÉTHODE (comportement de consultant)
1. Au démarrage (conversation qui commence) : accueille en une phrase, puis pose UNE question ouverte et inspirante sur l'essence de la marque. Pas de laïus.
2. Ensuite : UNE seule question à la fois, courte et concrète, qui REBONDIT sur la dernière réponse (montre que tu écoutes). Formule des hypothèses à valider plutôt que des questionnaires froids.
3. Couvre progressivement, dans un ordre logique : raison d'être/mission → public cible précis → promesse/positionnement différenciant → LE message clé → valeurs → personnalité → ton de voix → univers visuel (style, couleurs, lumière, matières).
4. STRATÉGIE PAR RÉSEAU : chaque plateforme a ses codes. Quand tu as assez de matière, propose une stratégie DIFFÉRENTE et adaptée pour chaque réseau pertinent parmi instagram, facebook, tiktok, linkedin (angle, formats, ton, piliers de contenu, rythme, CTA). Ex. TikTok = spontané/vertical/tendances ; LinkedIn = expertise/preuve/posé ; Instagram = esthétique/communauté ; Facebook = proximité/offres/communauté locale. N'inclus que les réseaux pertinents pour la marque.
5. VISUELS : dès qu'une direction artistique se dessine, propose 1 à 3 "visualPrompts" en ANGLAIS, photographiques/cinématographiques, premium, SANS texte incrusté. Affine-les quand la direction évolue.
6. MÉMOIRE : à chaque tour, renvoie dans "memoryNotes" les insights et recommandations STRATÉGIQUES nouveaux et durables que tu produis (à conserver dans la mémoire de la marque). Sois sélectif : 0 à 3 notes vraiment utiles, jamais de banalités.
7. Mets à jour "dna" à CHAQUE tour avec tout ce que tu as compris (même partiel). N'invente pas : laisse vide ce que tu ignores encore.
8. Quand l'ADN est riche et cohérent (mission + cible + positionnement + message clé + ton + direction visuelle + au moins une stratégie réseau), passe "readyToLock" à true et invite à verrouiller.

# STYLE DE "reply"
Prise de parole naturelle, humaine, ${lang === "en" ? "EN ANGLAIS (the client's interface is in English — reply in English)" : "EN FRANÇAIS"}, 1 à 4 phrases, jamais de listes à puces froides. Ton de vrai consultant : précis, inspirant, utile. La langue de "reply" DOIT être ${lang === "en" ? "l'anglais" : "le français"} ; les champs "dna" peuvent rester en français.

# FORMAT DE SORTIE — STRICTEMENT du JSON, sans aucun texte autour :
{
  "reply": "ta prise de parole de consultant",
  "readyToLock": true|false,
  "dna": {
    "summary": "synthèse 2-3 phrases de qui est la marque",
    "positioning": "", "mission": "", "keyMessage": "",
    "values": [], "personality": [], "tone": "",
    "audience": "", "themes": [],
    "visualDirection": "mots-clés FR de direction artistique",
    "keywords": [],
    "networkStrategies": [
      { "network": "instagram|facebook|tiktok|linkedin", "angle": "", "formats": [], "tone": "", "contentPillars": [], "cadence": "", "cta": "" }
    ]
  },
  "visualPrompts": ["english premium art-direction image prompt", "..."],
  "memoryNotes": [ { "kind": "insight|angle|format|recommendation|competitor|keyword", "title": "", "content": "", "network": "(optionnel) instagram|facebook|tiktok|linkedin" } ]
}`;

    // Modèle rapide, budget de tokens suffisant pour le JSON complet (un budget
    // trop court tronquait la réponse → JSON invalide → « reformulez » en boucle),
    // et un ré-essai automatique : un échec ponctuel ne doit pas bloquer l'entretien.
    let result: ConsultantResult | null = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      result = await callClaudeJSON<ConsultantResult>(prompt, {
        model: "claude-sonnet-4-6",
        maxTokens: 3000,
        temperature: 0.7,
        timeoutMs: 25_000,
      });
    }
    if (!result) {
      return NextResponse.json(
        {
          error: lang === "en"
            ? "The AI consultant could not reply. Please try again."
            : "Le consultant IA n'a pas pu répondre. Reformulez ou réessayez.",
        },
        { status: 502 }
      );
    }

    // Sauvegarde du brouillon d'ADN (sans verrouiller) pour reprise ultérieure.
    const draft = mergeDna(existing, result.dna);
    if (messages.length) {
      // On ne marque PAS analyzedAt : la philosophie n'est pas encore verrouillée.
      await saveBrandProfile({ ...draft, companyId, philosophyLocked: false }).catch(() => {});
    }

    // Réinjection dans le RAG : tout ce que le consultant récupère et conseille.
    const notes = Array.isArray(result.memoryNotes) ? result.memoryNotes : [];
    const memEntries: MemoryEntry[] = notes
      .filter((n) => str(n?.content))
      .slice(0, 3)
      .map((n) => {
        const net = coerceNetwork(n.network);
        return {
          source: "manual" as const,
          kind: coerceKind(n.kind),
          title: str(n.title) || undefined,
          content: str(n.content),
          score: 2,
          tags: net ? [net, "consultant"] : ["consultant"],
        };
      });
    if (memEntries.length) await appendMemory(companyId, memEntries).catch(() => {});

    return NextResponse.json({
      reply: str(result.reply) || (lang === "en"
        ? "Tell me about your brand — what makes it unique?"
        : "Parlez-moi de votre marque : qu'est-ce qui la rend unique ?"),
      readyToLock: Boolean(result.readyToLock),
      dna: { ...(result.dna ?? {}), networkStrategies: coerceNetStrats(result.dna?.networkStrategies) },
      visualPrompts: arr(result.visualPrompts).slice(0, 3),
    });
  } catch (e) {
    console.error("[POST /api/ai/consultant]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
