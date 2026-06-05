// Repository de la messagerie sociale (agents, messages, réponses).
// Dégradation gracieuse : magasin mémoire local si Supabase absent. Ne throw pas
// pour les lectures ; les écritures throw avec un message clair.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import type {
  InboxAgent,
  InboxChannel,
  InboxMessage,
  InboxMessageStatus,
  InboxReply,
} from "@/lib/inbox/types";

// ── Magasins mémoire (mode démo sans Supabase) ──────────────────────────────
const AGENTS = new Map<string, InboxAgent[]>();
const MESSAGES = new Map<string, InboxMessage[]>();
const REPLIES = new Map<string, InboxReply[]>(); // clé = messageId

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Mappers ─────────────────────────────────────────────────────────────────
function rowToAgent(r: Record<string, unknown>): InboxAgent {
  return {
    id: String(r.id ?? ""),
    companyId: r.company_id ? String(r.company_id) : undefined,
    name: String(r.name ?? "Agent"),
    scope: (r.scope as InboxAgent["scope"]) ?? "all",
    channels: Array.isArray(r.channels) ? (r.channels as InboxChannel[]) : [],
    enabled: r.enabled !== false,
    autonomy: (r.autonomy as InboxAgent["autonomy"]) ?? "suggest",
    persona: r.persona ? String(r.persona) : "",
    language: (r.language as InboxAgent["language"]) ?? "auto",
    confidenceThreshold: r.confidence_threshold != null ? Number(r.confidence_threshold) : 0.7,
    escalationKeywords: Array.isArray(r.escalation_keywords) ? (r.escalation_keywords as string[]) : [],
    signature: r.signature ? String(r.signature) : "",
    createdAt: r.created_at ? String(r.created_at) : undefined,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined,
  };
}

function rowToMessage(r: Record<string, unknown>): InboxMessage {
  return {
    id: String(r.id ?? ""),
    companyId: r.company_id ? String(r.company_id) : undefined,
    channel: (r.channel as InboxChannel) ?? "other",
    externalId: r.external_id ? String(r.external_id) : undefined,
    kind: (r.kind as InboxMessage["kind"]) ?? "comment",
    authorName: r.author_name ? String(r.author_name) : "Utilisateur",
    authorHandle: r.author_handle ? String(r.author_handle) : undefined,
    text: String(r.text ?? ""),
    permalink: r.permalink ? String(r.permalink) : undefined,
    status: (r.status as InboxMessageStatus) ?? "pending",
    sentiment: (r.sentiment as InboxMessage["sentiment"]) ?? undefined,
    receivedAt: r.received_at ? String(r.received_at) : new Date().toISOString(),
    raw: (r.raw as Record<string, unknown>) ?? {},
  };
}

function rowToReply(r: Record<string, unknown>): InboxReply {
  return {
    id: String(r.id ?? ""),
    messageId: String(r.message_id ?? ""),
    companyId: r.company_id ? String(r.company_id) : undefined,
    agentId: r.agent_id ? String(r.agent_id) : null,
    body: String(r.body ?? ""),
    generatedBy: (r.generated_by as InboxReply["generatedBy"]) ?? "ai",
    confidence: r.confidence != null ? Number(r.confidence) : undefined,
    needsHuman: r.needs_human === true,
    reason: r.reason ? String(r.reason) : undefined,
    status: (r.status as InboxReply["status"]) ?? "suggested",
    createdAt: r.created_at ? String(r.created_at) : undefined,
    sentAt: r.sent_at ? String(r.sent_at) : null,
  };
}

// ── AGENTS ──────────────────────────────────────────────────────────────────

export async function listAgents(companyId: string): Promise<InboxAgent[]> {
  if (!isSupabaseConfigured) return [...(AGENTS.get(companyId) ?? [])];
  const supabase = createClient();
  if (!supabase) return [...(AGENTS.get(companyId) ?? [])];
  const uuid = await resolveCompanyUuid(companyId);
  const { data, error } = await supabase
    .from("sh_inbox_agents")
    .select("*")
    .eq("company_id", uuid)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToAgent);
}

export async function createAgent(
  companyId: string,
  input: Partial<InboxAgent> & { name: string }
): Promise<InboxAgent> {
  const base: InboxAgent = {
    id: uid("agt"),
    companyId,
    name: input.name,
    scope: input.scope ?? "all",
    channels: input.channels ?? [],
    enabled: input.enabled ?? true,
    autonomy: input.autonomy ?? "suggest",
    persona: input.persona ?? "",
    language: input.language ?? "auto",
    confidenceThreshold: input.confidenceThreshold ?? 0.7,
    escalationKeywords: input.escalationKeywords ?? [],
    signature: input.signature ?? "",
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    const arr = AGENTS.get(companyId) ?? [];
    arr.push(base);
    AGENTS.set(companyId, arr);
    return base;
  }
  const supabase = createClient();
  if (!supabase) {
    const arr = AGENTS.get(companyId) ?? [];
    arr.push(base);
    AGENTS.set(companyId, arr);
    return base;
  }
  const uuid = await resolveCompanyUuid(companyId);
  const { data, error } = await supabase
    .from("sh_inbox_agents")
    .insert({
      company_id: uuid,
      name: base.name,
      scope: base.scope,
      channels: base.channels,
      enabled: base.enabled,
      autonomy: base.autonomy,
      persona: base.persona || null,
      language: base.language,
      confidence_threshold: base.confidenceThreshold,
      escalation_keywords: base.escalationKeywords,
      signature: base.signature || null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "create agent failed");
  return rowToAgent(data as Record<string, unknown>);
}

export async function updateAgent(id: string, patch: Partial<InboxAgent>): Promise<InboxAgent> {
  if (!isSupabaseConfigured || !createClient()) {
    for (const arr of AGENTS.values()) {
      const i = arr.findIndex((a) => a.id === id);
      if (i >= 0) {
        arr[i] = { ...arr[i], ...patch, updatedAt: new Date().toISOString() };
        return arr[i];
      }
    }
    throw new Error("agent not found");
  }
  const supabase = createClient()!;
  const db: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) db.name = patch.name;
  if (patch.scope !== undefined) db.scope = patch.scope;
  if (patch.channels !== undefined) db.channels = patch.channels;
  if (patch.enabled !== undefined) db.enabled = patch.enabled;
  if (patch.autonomy !== undefined) db.autonomy = patch.autonomy;
  if (patch.persona !== undefined) db.persona = patch.persona || null;
  if (patch.language !== undefined) db.language = patch.language;
  if (patch.confidenceThreshold !== undefined) db.confidence_threshold = patch.confidenceThreshold;
  if (patch.escalationKeywords !== undefined) db.escalation_keywords = patch.escalationKeywords;
  if (patch.signature !== undefined) db.signature = patch.signature || null;
  const { data, error } = await supabase
    .from("sh_inbox_agents")
    .update(db)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "update agent failed");
  return rowToAgent(data as Record<string, unknown>);
}

export async function deleteAgent(id: string): Promise<void> {
  if (!isSupabaseConfigured || !createClient()) {
    for (const arr of AGENTS.values()) {
      const i = arr.findIndex((a) => a.id === id);
      if (i >= 0) arr.splice(i, 1);
    }
    return;
  }
  const supabase = createClient()!;
  await supabase.from("sh_inbox_agents").delete().eq("id", id);
}

/** Choisit l'agent en charge d'un canal donné (par canal > « pour tout »). */
export function pickAgentForChannel(agents: InboxAgent[], channel: InboxChannel): InboxAgent | null {
  const enabled = agents.filter((a) => a.enabled);
  const dedicated = enabled.find((a) => a.scope === "channel" && a.channels.includes(channel));
  if (dedicated) return dedicated;
  const all = enabled.find((a) => a.scope === "all");
  return all ?? null;
}

// ── MESSAGES ─────────────────────────────────────────────────────────────────

export async function listMessages(
  companyId: string,
  opts: { status?: InboxMessageStatus; channel?: InboxChannel; limit?: number } = {}
): Promise<InboxMessage[]> {
  const limit = opts.limit ?? 100;
  let messages: InboxMessage[];

  if (!isSupabaseConfigured || !createClient()) {
    messages = [...(MESSAGES.get(companyId) ?? [])];
    if (opts.status) messages = messages.filter((m) => m.status === opts.status);
    if (opts.channel) messages = messages.filter((m) => m.channel === opts.channel);
    messages = messages.slice(0, limit);
    for (const m of messages) {
      const reps = REPLIES.get(m.id) ?? [];
      m.reply = reps[reps.length - 1] ?? null;
    }
    return messages;
  }

  const supabase = createClient()!;
  const uuid = await resolveCompanyUuid(companyId);
  let q = supabase
    .from("sh_inbox_messages")
    .select("*")
    .eq("company_id", uuid)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.channel) q = q.eq("channel", opts.channel);
  const { data, error } = await q;
  if (error || !data) return [];
  messages = (data as Record<string, unknown>[]).map(rowToMessage);

  // Joint la dernière réponse de chaque message.
  const ids = messages.map((m) => m.id);
  if (ids.length) {
    const { data: reps } = await supabase
      .from("sh_inbox_replies")
      .select("*")
      .in("message_id", ids)
      .order("created_at", { ascending: false });
    const byMsg = new Map<string, InboxReply>();
    for (const r of (reps as Record<string, unknown>[]) ?? []) {
      const rep = rowToReply(r);
      if (!byMsg.has(rep.messageId)) byMsg.set(rep.messageId, rep);
    }
    for (const m of messages) m.reply = byMsg.get(m.id) ?? null;
  }
  return messages;
}

export async function getMessage(id: string): Promise<InboxMessage | null> {
  if (!isSupabaseConfigured || !createClient()) {
    for (const arr of MESSAGES.values()) {
      const m = arr.find((x) => x.id === id);
      if (m) return m;
    }
    return null;
  }
  const supabase = createClient()!;
  const { data } = await supabase.from("sh_inbox_messages").select("*").eq("id", id).maybeSingle();
  return data ? rowToMessage(data as Record<string, unknown>) : null;
}

export interface IngestMessageInput {
  channel: InboxChannel;
  text: string;
  authorName?: string;
  authorHandle?: string;
  externalId?: string;
  kind?: InboxMessage["kind"];
  permalink?: string;
  raw?: Record<string, unknown>;
}

/** Insère un message entrant (idempotent sur externalId). Retourne null si doublon. */
export async function ingestMessage(
  companyId: string,
  input: IngestMessageInput
): Promise<InboxMessage | null> {
  const msg: InboxMessage = {
    id: uid("msg"),
    companyId,
    channel: input.channel,
    externalId: input.externalId,
    kind: input.kind ?? "comment",
    authorName: input.authorName ?? "Utilisateur",
    authorHandle: input.authorHandle,
    text: input.text,
    permalink: input.permalink,
    status: "pending",
    receivedAt: new Date().toISOString(),
    raw: input.raw ?? {},
  };

  if (!isSupabaseConfigured || !createClient()) {
    const arr = MESSAGES.get(companyId) ?? [];
    if (input.externalId && arr.some((m) => m.externalId === input.externalId && m.channel === input.channel)) {
      return null;
    }
    arr.unshift(msg);
    MESSAGES.set(companyId, arr);
    return msg;
  }

  const supabase = createClient()!;
  const uuid = await resolveCompanyUuid(companyId);
  if (input.externalId) {
    const { data: existing } = await supabase
      .from("sh_inbox_messages")
      .select("id")
      .eq("company_id", uuid)
      .eq("channel", input.channel)
      .eq("external_id", input.externalId)
      .maybeSingle();
    if (existing) return null;
  }
  const { data, error } = await supabase
    .from("sh_inbox_messages")
    .insert({
      company_id: uuid,
      channel: msg.channel,
      external_id: msg.externalId ?? null,
      kind: msg.kind,
      author_name: msg.authorName,
      author_handle: msg.authorHandle ?? null,
      text: msg.text,
      permalink: msg.permalink ?? null,
      status: "pending",
      raw: msg.raw ?? {},
    })
    .select()
    .single();
  if (error || !data) {
    // Conflit d'unicité (course) → considéré comme doublon.
    if (error?.code === "23505") return null;
    throw new Error(error?.message ?? "ingest failed");
  }
  return rowToMessage(data as Record<string, unknown>);
}

export async function setMessageStatus(id: string, status: InboxMessageStatus): Promise<void> {
  if (!isSupabaseConfigured || !createClient()) {
    for (const arr of MESSAGES.values()) {
      const m = arr.find((x) => x.id === id);
      if (m) m.status = status;
    }
    return;
  }
  const supabase = createClient()!;
  await supabase.from("sh_inbox_messages").update({ status }).eq("id", id);
}

export async function setMessageSentiment(id: string, sentiment: string): Promise<void> {
  if (!isSupabaseConfigured || !createClient()) {
    for (const arr of MESSAGES.values()) {
      const m = arr.find((x) => x.id === id);
      if (m) m.sentiment = sentiment as InboxMessage["sentiment"];
    }
    return;
  }
  const supabase = createClient()!;
  await supabase.from("sh_inbox_messages").update({ sentiment }).eq("id", id);
}

// ── REPLIES ──────────────────────────────────────────────────────────────────

export async function createReply(
  companyId: string,
  input: Omit<InboxReply, "id" | "companyId" | "createdAt">
): Promise<InboxReply> {
  const reply: InboxReply = {
    id: uid("rep"),
    companyId,
    createdAt: new Date().toISOString(),
    ...input,
  };

  if (!isSupabaseConfigured || !createClient()) {
    const arr = REPLIES.get(input.messageId) ?? [];
    arr.push(reply);
    REPLIES.set(input.messageId, arr);
    return reply;
  }
  const supabase = createClient()!;
  const uuid = await resolveCompanyUuid(companyId);
  const { data, error } = await supabase
    .from("sh_inbox_replies")
    .insert({
      message_id: input.messageId,
      company_id: uuid,
      agent_id: input.agentId ?? null,
      body: input.body,
      generated_by: input.generatedBy,
      confidence: input.confidence ?? null,
      needs_human: input.needsHuman,
      reason: input.reason ?? null,
      status: input.status,
      sent_at: input.sentAt ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "create reply failed");
  return rowToReply(data as Record<string, unknown>);
}

export async function getReply(id: string): Promise<InboxReply | null> {
  if (!isSupabaseConfigured || !createClient()) {
    for (const arr of REPLIES.values()) {
      const r = arr.find((x) => x.id === id);
      if (r) return r;
    }
    return null;
  }
  const supabase = createClient()!;
  const { data } = await supabase.from("sh_inbox_replies").select("*").eq("id", id).maybeSingle();
  return data ? rowToReply(data as Record<string, unknown>) : null;
}

export async function updateReply(id: string, patch: Partial<InboxReply>): Promise<InboxReply> {
  if (!isSupabaseConfigured || !createClient()) {
    for (const arr of REPLIES.values()) {
      const i = arr.findIndex((x) => x.id === id);
      if (i >= 0) {
        arr[i] = { ...arr[i], ...patch };
        return arr[i];
      }
    }
    throw new Error("reply not found");
  }
  const supabase = createClient()!;
  const db: Record<string, unknown> = {};
  if (patch.body !== undefined) db.body = patch.body;
  if (patch.status !== undefined) db.status = patch.status;
  if (patch.needsHuman !== undefined) db.needs_human = patch.needsHuman;
  if (patch.reason !== undefined) db.reason = patch.reason ?? null;
  if (patch.sentAt !== undefined) db.sent_at = patch.sentAt ?? null;
  if (patch.generatedBy !== undefined) db.generated_by = patch.generatedBy;
  const { data, error } = await supabase
    .from("sh_inbox_replies")
    .update(db)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "update reply failed");
  return rowToReply(data as Record<string, unknown>);
}

/** Compteurs pour les badges (en attente / à traiter par un humain). */
export async function inboxCounts(companyId: string): Promise<{ pending: number; needsHuman: number }> {
  const msgs = await listMessages(companyId, { limit: 500 });
  return {
    pending: msgs.filter((m) => m.status === "pending").length,
    needsHuman: msgs.filter((m) => m.status === "needs_human").length,
  };
}
