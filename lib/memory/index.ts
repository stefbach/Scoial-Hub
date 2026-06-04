// Mémoire stratégique persistante (RAG-lite).
// - appendMemory : conserve les insights (veille, pubs, page, agents…)
// - listMemory   : relit la mémoire (triée par importance puis récence)
// - synthesizeBrief : l'IA synthétise toute la mémoire en un brief stratégique
// - getMemoryContext : texte compact injecté dans la construction de campagnes
// Dégradation gracieuse : magasin mémoire local si Supabase absent. Ne throw jamais.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, isAiConfigured, env } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";

export type MemorySource = "veille" | "ads" | "page" | "agent" | "manual";
export type MemoryKind =
  | "insight" | "format" | "angle" | "competitor" | "keyword" | "recommendation" | "brief";

export interface MemoryEntry {
  id?: string;
  companyId?: string;
  source: MemorySource;
  kind: MemoryKind;
  title?: string;
  content: string;
  tags?: string[];
  score?: number;
  meta?: Record<string, unknown>;
  createdAt?: string;
}

export interface StrategyBrief {
  resume: string;
  opportunites: string[];
  anglesPrioritaires: string[];
  formatsGagnants: string[];
  concurrentsCles: string[];
  recommandations: string[];
  aiGenerated: boolean;
  generatedAt: string;
}

const MEM_STORE = new Map<string, MemoryEntry[]>();

function rowToEntry(r: Record<string, unknown>, companyId: string): MemoryEntry {
  return {
    id: String(r.id ?? ""),
    companyId,
    source: (r.source as MemorySource) ?? "manual",
    kind: (r.kind as MemoryKind) ?? "insight",
    title: r.title ? String(r.title) : undefined,
    content: String(r.content ?? ""),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    score: Number(r.score ?? 1),
    meta: (r.meta as Record<string, unknown>) ?? {},
    createdAt: r.created_at ? String(r.created_at) : undefined,
  };
}

/** Ajoute des entrées à la mémoire (en évitant les doublons source+title récents). */
export async function appendMemory(companyId: string, entries: MemoryEntry[]): Promise<number> {
  const clean = entries.filter((e) => e.content && e.content.trim());
  if (clean.length === 0) return 0;

  if (!isSupabaseConfigured) {
    const arr = MEM_STORE.get(companyId) ?? [];
    arr.unshift(...clean.map((e) => ({ ...e, companyId, createdAt: new Date().toISOString() })));
    MEM_STORE.set(companyId, arr.slice(0, 500));
    return clean.length;
  }

  try {
    const supabase = createClient();
    if (!supabase) return 0;
    const uuid = await resolveCompanyUuid(companyId);

    // Anti-doublon léger : on retire les entrées de même source+title avant réinsertion.
    const titles = clean.map((e) => e.title).filter(Boolean) as string[];
    if (titles.length > 0) {
      await supabase.from("sh_strategy_memory").delete().eq("company_id", uuid).in("title", titles);
    }

    const rows = clean.map((e) => ({
      company_id: uuid,
      source: e.source,
      kind: e.kind,
      title: e.title ?? null,
      content: e.content,
      tags: e.tags ?? [],
      score: e.score ?? 1,
      meta: e.meta ?? {},
    }));
    const { error } = await supabase.from("sh_strategy_memory").insert(rows);
    if (error) {
      console.error("[memory] appendMemory error:", error);
      return 0;
    }
    return rows.length;
  } catch (err) {
    console.error("[memory] appendMemory exception:", err);
    return 0;
  }
}

export async function listMemory(
  companyId: string,
  opts: { limit?: number; kind?: MemoryKind } = {}
): Promise<MemoryEntry[]> {
  const limit = opts.limit ?? 60;
  if (!isSupabaseConfigured) {
    let arr = MEM_STORE.get(companyId) ?? [];
    if (opts.kind) arr = arr.filter((e) => e.kind === opts.kind);
    return arr.slice(0, limit);
  }
  try {
    const supabase = createClient();
    if (!supabase) return [];
    const uuid = await resolveCompanyUuid(companyId);
    let q = supabase
      .from("sh_strategy_memory")
      .select("*")
      .eq("company_id", uuid)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts.kind) q = q.eq("kind", opts.kind);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => rowToEntry(r, companyId));
  } catch {
    return [];
  }
}

export async function getBrief(companyId: string): Promise<StrategyBrief | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createClient();
    if (!supabase) return null;
    const uuid = await resolveCompanyUuid(companyId);
    const { data } = await supabase.from("sh_strategy_brief").select("*").eq("company_id", uuid).maybeSingle();
    if (!data?.brief) return null;
    return { ...(data.brief as StrategyBrief), aiGenerated: Boolean(data.ai_generated), generatedAt: String(data.generated_at) };
  } catch {
    return null;
  }
}

async function saveBrief(companyId: string, brief: StrategyBrief): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = createClient();
    if (!supabase) return;
    const uuid = await resolveCompanyUuid(companyId);
    await supabase.from("sh_strategy_brief").upsert(
      { company_id: uuid, brief, ai_generated: brief.aiGenerated, generated_at: brief.generatedAt },
      { onConflict: "company_id" }
    );
  } catch {
    /* non bloquant */
  }
}

/** Régénère le brief stratégique à partir de toute la mémoire (analyse continue). */
export async function synthesizeBrief(companyId: string, companyName = "la marque"): Promise<StrategyBrief> {
  const mem = await listMemory(companyId, { limit: 80 });
  const now = new Date().toISOString();

  const empty: StrategyBrief = {
    resume: mem.length === 0
      ? "Aucune donnée de veille pour le moment. Lancez une analyse de veille, de pubs concurrentes ou de votre Page pour alimenter la mémoire stratégique."
      : `${mem.length} signaux stratégiques collectés. Synthèse en attente de l'IA.`,
    opportunites: [], anglesPrioritaires: [], formatsGagnants: [], concurrentsCles: [], recommandations: [],
    aiGenerated: false, generatedAt: now,
  };

  if (!isAiConfigured || mem.length === 0) {
    await saveBrief(companyId, empty);
    return empty;
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const compact = mem.map((m) => ({ source: m.source, kind: m.kind, title: m.title, content: m.content.slice(0, 200) }));
    const prompt = `Tu es directeur de la stratégie social media. À partir de la MÉMOIRE d'analyses accumulée pour ${companyName}, produis un brief stratégique actionnable.

MÉMOIRE (veille concurrentielle, pubs, analyse de Page) :
${JSON.stringify(compact, null, 2)}

Retourne STRICTEMENT ce JSON (français, concret) :
{
  "resume": "3-4 phrases : où en est le marché, où se situe l'opportunité pour cette marque",
  "opportunites": ["opportunités concrètes à saisir"],
  "anglesPrioritaires": ["angles éditoriaux à exploiter en priorité"],
  "formatsGagnants": ["formats qui performent sur ce marché"],
  "concurrentsCles": ["concurrents à surveiller/dépasser et pourquoi"],
  "recommandations": ["actions stratégiques priorisées pour les prochaines campagnes"]
}
Max 5 éléments par liste. Base-toi UNIQUEMENT sur la mémoire fournie.`;
    const msg = await client.messages.create({ model: env.anthropicModel, max_tokens: 1600, messages: [{ role: "user", content: prompt }] });
    const raw = msg.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as Partial<StrategyBrief>;
    const brief: StrategyBrief = {
      resume: parsed.resume ?? empty.resume,
      opportunites: (parsed.opportunites ?? []).slice(0, 5),
      anglesPrioritaires: (parsed.anglesPrioritaires ?? []).slice(0, 5),
      formatsGagnants: (parsed.formatsGagnants ?? []).slice(0, 5),
      concurrentsCles: (parsed.concurrentsCles ?? []).slice(0, 5),
      recommandations: (parsed.recommandations ?? []).slice(0, 5),
      aiGenerated: true,
      generatedAt: now,
    };
    await saveBrief(companyId, brief);
    // On conserve aussi le brief dans la mémoire (trace historique).
    await appendMemory(companyId, [{ source: "agent", kind: "brief", title: "Brief stratégique", content: brief.resume, score: 5 }]);
    return brief;
  } catch (err) {
    console.warn("[memory] synthesizeBrief fallback:", err);
    await saveBrief(companyId, empty);
    return empty;
  }
}

/** Texte compact de la mémoire pour injection dans les prompts de campagne. */
export async function getMemoryContext(companyId: string, limit = 25): Promise<string> {
  const mem = await listMemory(companyId, { limit });
  if (mem.length === 0) return "";
  return mem.map((m) => `- [${m.source}/${m.kind}] ${m.title ? m.title + ": " : ""}${m.content}`).join("\n");
}
