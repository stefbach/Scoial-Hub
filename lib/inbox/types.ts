// Types métier de la messagerie sociale & des agents de réponse.
// Un agent répond aux messages (commentaires, DM, mentions) dans la voix de la
// marque (« son maître ») et sait escalader vers un humain quand il le faut.

export type InboxChannel =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "telegram"
  | "twitter"
  | "other";

export type AgentScope = "all" | "channel";
/** 'suggest' : rédige un brouillon à valider. 'auto' : envoie seul si confiant. */
export type AgentAutonomy = "suggest" | "auto";
export type AgentLanguage = "auto" | "fr" | "en" | "kreol";

export interface InboxAgent {
  id: string;
  companyId?: string;
  name: string;
  scope: AgentScope;
  channels: InboxChannel[];
  enabled: boolean;
  autonomy: AgentAutonomy;
  persona: string;
  language: AgentLanguage;
  confidenceThreshold: number;
  escalationKeywords: string[];
  signature: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InboxMessageKind = "comment" | "dm" | "mention" | "review";
export type InboxMessageStatus = "pending" | "answered" | "needs_human" | "ignored";
export type InboxSentiment = "positive" | "neutral" | "negative" | "question";

export interface InboxMessage {
  id: string;
  companyId?: string;
  channel: InboxChannel;
  externalId?: string;
  kind: InboxMessageKind;
  authorName: string;
  authorHandle?: string;
  text: string;
  permalink?: string;
  status: InboxMessageStatus;
  sentiment?: InboxSentiment;
  receivedAt: string;
  raw?: Record<string, unknown>;
  /** Joint à la lecture : la dernière réponse suggérée/envoyée pour ce message. */
  reply?: InboxReply | null;
}

export type ReplyGeneratedBy = "ai" | "human";
export type ReplyStatus = "suggested" | "sent" | "rejected";

export interface InboxReply {
  id: string;
  messageId: string;
  companyId?: string;
  agentId?: string | null;
  body: string;
  generatedBy: ReplyGeneratedBy;
  confidence?: number;
  needsHuman: boolean;
  reason?: string;
  status: ReplyStatus;
  createdAt?: string;
  sentAt?: string | null;
}

export const CHANNEL_LABELS: Record<InboxChannel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  telegram: "Telegram",
  twitter: "X / Twitter",
  other: "Autre",
};
