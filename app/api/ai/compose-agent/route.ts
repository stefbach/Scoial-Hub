// POST /api/ai/compose-agent
// L'AGENT DE PUBLICATION de Compose : on lui dit ce qu'on veut poster, il
// rédige le texte ADAPTÉ À CHAQUE RÉSEAU (Facebook / Instagram / TikTok),
// propose le visuel idéal (prompt prêt pour la génération, photo ou vidéo),
// conseille — et s'appuie sur la mémoire stratégique (RAG) si demandé.
// Conversationnel : on itère (« plus court », « ajoute un emoji », …).

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { callClaudeJSON } from "@/lib/ai/claude-json";
import { isAiConfigured } from "@/lib/env";
import { getMemoryContext } from "@/lib/memory";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

type Net = "facebook" | "instagram" | "tiktok";

interface AgentResult {
  reply?: string;
  texts?: Partial<Record<Net, string>>;
  visualPrompt?: string;
  visualKind?: "image" | "video";
  visualAdvice?: string;
  tips?: string[];
}

const NET_RULES: Record<Net, string> = {
  facebook: "Facebook : 40-80 mots optimum, ton proche et communautaire, 2-3 hashtags discrets max, question d'engagement bienvenue.",
  instagram: "Instagram : accroche forte 1re ligne (avant le « plus »), 100-150 mots aérés avec emojis pertinents, 5-10 hashtags en fin.",
  tiktok: "TikTok : légende COURTE et percutante (< 150 caractères), ton parlé/énergique, 3-5 hashtags tendance. La VIDÉO porte le message — la légende teasse.",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      message?: string;
      networks?: Net[];
      useMemory?: boolean;
      language?: "fr" | "en";
      history?: { role: "user" | "assistant"; content: string }[];
      currentTexts?: Partial<Record<Net, string>>;
      hasMedia?: boolean;
    };
    const companyId = body.companyId;
    const message = (body.message ?? "").trim();
    const networks = (body.networks?.length ? body.networks : ["facebook", "instagram", "tiktok"]) as Net[];
    const lang = body.language === "en" ? "en" : "fr";
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "message requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    if (!isAiConfigured) {
      return NextResponse.json({ error: "IA non configurée (ANTHROPIC_API_KEY)." }, { status: 503 });
    }

    // Contexte marque (nom + voix) et mémoire stratégique (RAG opt-in).
    let brandName = "";
    let brandVoice = "";
    try {
      const uuid = await resolveCompanyUuid(companyId);
      const sb = createAdminClient();
      if (sb) {
        const { data } = await sb.from("sh_companies").select("name, brand_voice").eq("id", uuid).maybeSingle();
        if (data) { brandName = String(data.name ?? ""); brandVoice = String(data.brand_voice ?? ""); }
      }
    } catch { /* dégradation */ }
    const memory = body.useMemory ? await getMemoryContext(companyId, 10).catch(() => "") : "";

    const histText = (body.history ?? []).slice(-6)
      .map((m) => `${m.role === "user" ? "UTILISATEUR" : "AGENT"} : ${m.content}`).join("\n");

    const rules = networks.map((n) => `- ${NET_RULES[n]}`).join("\n");
    const textsSchema = networks.map((n) => `"${n}":"texte prêt à publier pour ${n}"`).join(",");

    const prompt = `# RÔLE
Tu es l'AGENT DE PUBLICATION d'une marque — un social media manager senior de niveau international. Tu transformes une idée en publications PRÊTES À PARTIR, adaptées aux codes de CHAQUE réseau, et tu conseilles le visuel idéal.

# MARQUE
${brandName || "(non précisée)"}${brandVoice ? ` — voix : ${brandVoice}` : ""}
${memory ? `\n# MÉMOIRE STRATÉGIQUE (RAG — appuie-toi dessus)\n${memory}` : ""}

${histText ? `# CONVERSATION\n${histText}\n` : ""}
# DEMANDE
${message}
${body.currentTexts && Object.keys(body.currentTexts).length ? `\n# TEXTES ACTUELS (à ajuster si la demande est une retouche)\n${JSON.stringify(body.currentTexts)}` : ""}
${body.hasMedia ? "\n(Un visuel est déjà attaché au post : ne propose un nouveau visuel QUE si on te le demande.)" : ""}

# RÉSEAUX CIBLES ET LEURS CODES
${rules}

# CE QUE TU PRODUIS
1. "reply" : réponse courte et humaine (1-3 phrases, langue : ${lang === "en" ? "anglais" : "français"}) — ce que tu as fait et un conseil.
2. "texts" : UN texte par réseau demandé, ADAPTÉ à ses codes (pas un copier-coller). Langue : ${lang === "en" ? "anglais" : "français"}. Jamais de tiret cadratin (—).
3. "visualPrompt" : prompt EN ANGLAIS, très détaillé et premium, pour générer le visuel idéal (sujet, composition, lumière, style, HD, AUCUN texte incrusté).
4. "visualKind" : "image" ou "video" (video si TikTok est central ou si le sujet s'y prête).
5. "visualAdvice" : 1 phrase (${lang === "en" ? "anglais" : "français"}) de conseil sur le visuel (cadrage, ambiance, pourquoi).
6. "tips" : 1-2 conseils brefs (meilleure heure, angle, CTA…).

# FORMAT — STRICTEMENT du JSON :
{"reply":"","texts":{${textsSchema}},"visualPrompt":"","visualKind":"image","visualAdvice":"","tips":[]}`;

    const result = await callClaudeJSON<AgentResult>(prompt, { model: "claude-sonnet-4-6", maxTokens: 1800, temperature: 0.7 });
    if (!result) {
      return NextResponse.json({ error: "L'agent n'a pas pu répondre. Réessayez." }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/ai/compose-agent]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
