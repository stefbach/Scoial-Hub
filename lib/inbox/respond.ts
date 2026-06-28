// Moteur de réponse des agents conversationnels.
// L'agent rédige une réponse dans la voix de la marque (« son maître »), estime
// sa confiance, détecte le sentiment et SAIT dire quand un humain doit reprendre
// la main (plainte sérieuse, juridique/médical sensible, demande de remboursement,
// hors de son périmètre, ou simplement confiance insuffisante).
//
// Dégradation gracieuse : sans clé IA, on renvoie une réponse neutre et on
// escalade par prudence. Ne throw jamais.

import { isAiConfigured, env } from "@/lib/env";
import { getMemoryContext } from "@/lib/memory";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { getCompanyName } from "@/lib/connectors/meta-pages";
import type { InboxAgent, InboxMessage, InboxSentiment } from "@/lib/inbox/types";

export interface DraftedReply {
  body: string;
  confidence: number;
  needsHuman: boolean;
  reason: string;
  sentiment: InboxSentiment;
}

// Mots déclencheurs d'escalade « universels » (en plus de ceux de l'agent).
const DEFAULT_ESCALATION = [
  "remboursement", "refund", "avocat", "lawyer", "plainte", "juridique", "legal",
  "scandale", "arnaque", "scam", "dangereux", "danger", "urgence", "urgent",
  "porter plainte", "presse", "journaliste", "rgpd", "données personnelles",
  "effet secondaire", "hospitalis", "décès", "mort", "suicide",
];

function keywordHit(text: string, words: string[]): string | null {
  const low = text.toLowerCase();
  for (const w of words) {
    if (w && low.includes(w.toLowerCase())) return w;
  }
  return null;
}

async function loadBrandVoice(companyUuid: string): Promise<string> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const sb = createAdminClient();
    if (!sb) return "";
    const { data } = await sb
      .from("sh_companies")
      .select("brand_voice")
      .eq("id", companyUuid)
      .maybeSingle();
    return data?.brand_voice ? String(data.brand_voice) : "";
  } catch {
    return "";
  }
}

/** Rédige (ou escalade) une réponse pour un message donné. */
export async function draftReply(
  companyId: string,
  message: InboxMessage,
  agent: InboxAgent | null
): Promise<DraftedReply> {
  const uuid = await resolveCompanyUuid(companyId);
  const [companyName, brandVoice, memory] = await Promise.all([
    getCompanyName(uuid).catch(() => ""),
    loadBrandVoice(uuid),
    getMemoryContext(companyId, 12).catch(() => ""),
  ]);

  const escWords = [...DEFAULT_ESCALATION, ...(agent?.escalationKeywords ?? [])];
  const hit = keywordHit(message.text, escWords);
  const signature = agent?.signature?.trim();

  // Garde-fou déterministe : certains sujets passent TOUJOURS à un humain.
  if (hit) {
    return {
      body: signature
        ? `Merci pour votre message, nous tenons à bien vous répondre. Un membre de l'équipe vous recontacte très vite.\n${signature}`
        : "Merci pour votre message, nous tenons à bien vous répondre. Un membre de l'équipe vous recontacte très vite.",
      confidence: 0.2,
      needsHuman: true,
      reason: `Sujet sensible détecté (« ${hit} ») — transmis à un humain.`,
      sentiment: "negative",
    };
  }

  if (!isAiConfigured) {
    // Sans IA : on propose un accusé de réception neutre, à valider par un humain.
    const body = [
      `Bonjour ${message.authorName?.split(" ")[0] ?? ""}`.trim() + ",",
      "merci pour votre message ! Nous revenons vers vous au plus vite.",
      signature || "",
    ].filter(Boolean).join("\n");
    return {
      body,
      confidence: 0.3,
      needsHuman: true,
      reason: "IA non configurée — brouillon neutre à valider par un humain.",
      sentiment: "neutral",
    };
  }

  const lang = agent?.language === "fr" ? "français"
    : agent?.language === "en" ? "anglais"
    : agent?.language === "kreol" ? "kreol morisien (créole mauricien)"
    : "la même langue que le message";

  const persona = agent?.persona?.trim()
    || "Tu es le/la community manager de la marque : chaleureux, professionnel, utile, jamais robotique.";

  const threshold = agent?.confidenceThreshold ?? 0.7;

  const prompt = `Tu réponds aux messages sur les réseaux sociaux pour « ${companyName || "la marque"} ».

CONSIGNES DU MAÎTRE (à respecter strictement) :
${persona}
${brandVoice ? `\nVOIX DE MARQUE : ${brandVoice}` : ""}
${memory ? `\nCONTEXTE STRATÉGIQUE (mémoire de la marque) :\n${memory}` : ""}

MESSAGE REÇU (${message.channel}, ${message.kind}) de ${message.authorName} :
"""${message.text}"""

Rédige une réponse PUBLIQUE courte (1-3 phrases), dans ${lang}, fidèle à la voix de marque.
Tu DOIS demander une reprise humaine (needsHuman=true) si : plainte sérieuse, sujet juridique/médical/santé sensible, demande de remboursement ou geste commercial, données personnelles, crise/réputation, ou si tu n'as pas l'information fiable pour répondre.
Évalue ta confiance entre 0 et 1 (1 = certain que la réponse est juste et sûre).
Détecte le sentiment du message : positive | neutral | negative | question.

Réponds STRICTEMENT en JSON :
{"reply": "...", "confidence": 0.0, "needsHuman": false, "reason": "courte justification", "sentiment": "neutral"}`;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const { createClaudeMessage } = await import("@/lib/ai/anthropic");
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const msg = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as {
      reply?: string; confidence?: number; needsHuman?: boolean; reason?: string; sentiment?: string;
    };

    let body = (parsed.reply ?? "").trim();
    if (signature && body && !body.includes(signature)) body = `${body}\n${signature}`;
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5)));
    const lowConfidence = confidence < threshold;
    const needsHuman = Boolean(parsed.needsHuman) || lowConfidence || !body;
    const sentiment = (["positive", "neutral", "negative", "question"].includes(String(parsed.sentiment))
      ? parsed.sentiment
      : "neutral") as InboxSentiment;

    return {
      body: body || "Merci pour votre message ! Un membre de l'équipe vous répond très vite.",
      confidence,
      needsHuman,
      reason: parsed.reason
        ? (lowConfidence ? `${parsed.reason} (confiance ${Math.round(confidence * 100)}% < seuil)` : parsed.reason)
        : (needsHuman ? "Confiance insuffisante — à valider par un humain." : "Réponse prête."),
      sentiment,
    };
  } catch (err) {
    console.warn("[inbox] draftReply fallback:", err);
    return {
      body: "Merci pour votre message ! Un membre de l'équipe vous répond très vite.",
      confidence: 0.3,
      needsHuman: true,
      reason: "Échec de génération IA — à traiter par un humain.",
      sentiment: "neutral",
    };
  }
}
