/**
 * POST /api/ai/avatar-chat
 *
 * Cerveau conversationnel de l'avatar : Claude + mémoire stratégique du Hub
 * (RAG). Réponses courtes, naturelles, « à l'oral » (l'avatar les vocalise).
 *
 * Body : { companyId?, message, history?: {role:"user"|"assistant", content}[], language? }
 * Retour : { reply, mock? }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "@/lib/env";

interface Turn {
  role: "user" | "assistant";
  content: string;
}
interface Body {
  companyId?: string;
  message?: string;
  history?: Turn[];
  language?: string;
}

function mock(message: string, language?: string): string {
  const fr = !language || /fran/i.test(language);
  return fr
    ? `Bonne question ! Je suis votre assistant de marque. (Mode démo — configurez ANTHROPIC_API_KEY pour des réponses complètes.) Vous m'avez dit : « ${message.slice(0, 80)} ». Comment puis-je vous aider sur vos réseaux ?`
    : `Great question! I'm your brand assistant. (Demo mode — set ANTHROPIC_API_KEY for full answers.) You said: "${message.slice(0, 80)}". How can I help with your social media?`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const message = (body.message ?? "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const language = body.language ?? "Français";

  if (!message) {
    return NextResponse.json({ error: "message requis" }, { status: 400 });
  }
  if (!isAiConfigured) {
    return NextResponse.json({ reply: mock(message, language), mock: true });
  }

  try {
    // RAG : mémoire stratégique de la marque (veille, pubs, Page…).
    let memoryContext = "";
    if (body.companyId) {
      try {
        const { getMemoryContext } = await import("@/lib/memory");
        memoryContext = await getMemoryContext(body.companyId, 20);
      } catch {
        /* non bloquant */
      }
    }

    const system = `Tu es l'avatar-assistant IA de la marque sur sa plateforme social media. Tu PARLES (tes réponses sont lues à voix haute), donc :
- réponds en ${language}, de façon naturelle, chaleureuse et CONCISE (2 à 4 phrases à l'oral) ;
- évite les listes à puces et le markdown ; parle comme un humain ;
- tu as accès à la connaissance de la marque ci-dessous : exploite-la quand c'est pertinent ;
- si tu ne sais pas, dis-le simplement et propose une piste.
${memoryContext ? `\n[Mémoire stratégique de la marque]\n${memoryContext}\n` : ""}`;

    const client = new Anthropic({ apiKey: env.anthropicKey });
    const messages = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: message },
    ];

    const resp = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 600,
      system,
      messages,
    });
    const reply = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return NextResponse.json({ reply: reply || mock(message, language), mock: !reply });
  } catch (err) {
    console.error("[avatar-chat] error:", err);
    return NextResponse.json({ reply: mock(message, language), mock: true });
  }
}
